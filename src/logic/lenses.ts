import type { Dataset } from '../data/types'
import type { RunPlan } from '../state/model'
import type { UnitContext } from './army'
import { pairRank, supportBonusesOf } from './army'
import { sexedClassId } from './classes'
import { hasUnisexDlcClasses } from '../data/modProfiles'
import { pairUpBonus } from './pairUp'
import { dlcClassesFor, expectedFinal } from './progression'
import { projectUnit } from './stats'

export type LensId =
  | 'statModifiers'
  | 'personalGrowths'
  | 'effectiveGrowths'
  | 'maxStats'
  | 'expectedFinal'
  | 'effectivePairUp'
  | 'personalPairUp'
  | 'baseStats'
  | 'classGrowths'
  | 'classPairUp'

/** A null cell renders as "-": the stat has no value in this lens (HP never has a cap mod or pair-up bonus). */
export type StatRow = (number | null)[]

export interface LensDef {
  id: LensId
  label: string
  signed: boolean
}

export const LENSES: readonly LensDef[] = [
  { id: 'statModifiers', label: 'Stat Modifiers (Personal)', signed: true },
  { id: 'personalGrowths', label: 'Growth Rates (Personal)', signed: false },
  { id: 'effectiveGrowths', label: 'Growth Rates (Effective)', signed: false },
  { id: 'maxStats', label: 'Max Stats (Effective)', signed: false },
  { id: 'expectedFinal', label: 'Expected Final Stats', signed: false },
  { id: 'effectivePairUp', label: 'Pair Up Bonuses (Effective)', signed: true },
  { id: 'personalPairUp', label: 'Pair Up Bonuses (Personal)', signed: true },
  { id: 'baseStats', label: 'Base Stats (Class)', signed: false },
  { id: 'classGrowths', label: 'Growth Rates (Class)', signed: false },
  { id: 'classPairUp', label: 'Pair Up Bonuses (Class)', signed: true },
]

export const CLASS_CARD_LENSES: readonly LensId[] = ['baseStats', 'maxStats', 'classGrowths', 'effectiveGrowths', 'classPairUp', 'effectivePairUp']

export function lensDef(id: LensId): LensDef {
  return LENSES.find((lens) => lens.id === id) ?? LENSES[0]
}

const HP_BLANK = new Set<LensId>(['statModifiers', 'classPairUp', 'personalPairUp', 'effectivePairUp'])

/** Columns this lens always renders as "-" (they can't be sorted on). */
export function blankColumns(lens: LensId): number[] {
  return HP_BLANK.has(lens) ? [0] : []
}

const withoutHp = (row: number[]): StatRow => row.map((value, index) => (index === 0 ? null : value))

/**
 * Pair-up blocks (class `pairUp` and personal support rows) are [Mov, Str, Mag, Skl, Spd, Lck,
 * Def, Res]: there is no HP bonus, and the first byte is the +1 Mov that mounted/flying classes
 * give (it matches Serenes Forest's Mov column for all 14 such classes). Returns a table row:
 * HP blank, Mov last.
 */
export function pairUpRow(block: readonly number[]): StatRow {
  return [null, ...block.slice(1, 8), block[0] ?? 0]
}

export function lensRow(dataset: Dataset, run: RunPlan, ctx: UnitContext, lens: LensId, classId = ctx.currentClassId): StatRow {
  const classDef = dataset.classesById.get(classId)
  const empty = (): StatRow => Array.from({ length: 8 }, () => null)
  let row: StatRow
  switch (lens) {
    case 'statModifiers':
      row = withoutHp(projectUnit(dataset, ctx.unit, undefined, ctx.projection).caps)
      break
    case 'personalGrowths':
      row = projectUnit(dataset, ctx.unit, undefined, ctx.projection).growths
      break
    case 'effectiveGrowths':
      row = projectUnit(dataset, ctx.unit, classId, ctx.projection).growths
      break
    case 'maxStats':
      row = classDef ? projectUnit(dataset, ctx.unit, classId, ctx.projection).caps : empty()
      break
    case 'baseStats':
      row = classDef ? [...classDef.baseStats] : empty()
      break
    case 'classGrowths':
      row = classDef ? [...classDef.growths] : empty()
      break
    case 'classPairUp':
      return classDef ? pairUpRow(classDef.pairUp) : [...empty(), null]
    case 'expectedFinal':
      return expectedFinal(dataset, run, ctx).row
    case 'personalPairUp': {
      const rank = ctx.pairPartner ? pairRank(dataset, run, ctx.unit.id, ctx.pairPartner.id) : 'S'
      return pairUpRow(pairUpBonus(null, supportBonusesOf(dataset, run, ctx), rank))
    }
    case 'effectivePairUp': {
      const rank = ctx.pairPartner ? pairRank(dataset, run, ctx.unit.id, ctx.pairPartner.id) : null
      return pairUpRow(pairUpBonus(classDef?.pairUp, supportBonusesOf(dataset, run, ctx), rank))
    }
  }
  // Mov has no growth or personal modifier.
  const movement = lens === 'maxStats' || lens === 'baseStats' ? classDef?.movement ?? null : null
  return [...row, movement]
}

export function formatCell(value: number | null, signed: boolean): string {
  if (value === null) return '-'
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1)
  return signed && value > 0 ? `+${rounded}` : rounded
}

const CLASS_LENSES: ReadonlySet<LensId> = new Set(['baseStats', 'classGrowths', 'classPairUp'])
const playableCache = new WeakMap<Dataset, number[]>()

/** Classes some playable unit can reach (own sets, reclass sets, their promotions, DLC); excludes enemy-only classes. */
export function playableClassIds(dataset: Dataset): number[] {
  const cached = playableCache.get(dataset)
  if (cached) return cached
  const ids = new Set<number>()
  const visit = (id: number) => {
    const def = dataset.classesById.get(id)
    if (!def || ids.has(id)) return
    ids.add(id)
    def.promotesTo.forEach(visit)
  }
  for (const unit of dataset.units) [...unit.classes, ...unit.reclasses].forEach(visit)
  for (const def of dataset.classes) if (def.dlc) ids.add(def.id)
  const list = [...ids]
  playableCache.set(dataset, list)
  return list
}

/**
 * Which classes a lens row is coloured against. Class lenses compare the class with every playable
 * class of its tier ("Nohr Princess against other base classes"); effective lenses compare the
 * unit's own options at that tier, since they fold in the unit's personal values.
 */
export function colourReferenceClassIds(dataset: Dataset, run: RunPlan, ctx: UnitContext, lens: LensId, classId: number, ownClassIds: readonly number[]): number[] {
  // DLC classes sit on the special track in the data but are reached from, and play at, advanced
  // level; colouring them only against each other (three classes) skewed their shades.
  const level = (id: number) => {
    const def = dataset.classesById.get(id)
    return def?.dlc ? 'promoted' : def?.tier
  }
  const tier = level(classId)
  if (!CLASS_LENSES.has(lens)) return ownClassIds.filter((id) => level(id) === tier)
  const ids = new Set<number>()
  const allowedDlc = new Set(dlcClassesFor(dataset, ctx.unit.gender, hasUnisexDlcClasses(run)).map((def) => def.id))
  for (const id of playableClassIds(dataset)) {
    const def = dataset.classesById.get(id)
    if (!def || level(id) !== tier || (def.dlc && !run.dlc)) continue
    const sexed = sexedClassId(dataset, id, ctx.unit.gender)
    if (def.dlc && !allowedDlc.has(sexed)) continue
    ids.add(sexed)
  }
  return [...ids]
}
