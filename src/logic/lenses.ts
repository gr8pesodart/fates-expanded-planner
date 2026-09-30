import type { Dataset } from '../data/types'
import type { RunPlan } from '../state/model'
import type { UnitContext } from './army'
import { pairRank } from './army'
import { pairUpBonus } from './pairUp'
import { projectUnit } from './stats'

export type LensId =
  | 'statModifiers'
  | 'personalGrowths'
  | 'effectiveGrowths'
  | 'maxStats'
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
      row = classDef ? withoutHp(classDef.pairUp) : empty()
      break
    case 'personalPairUp': {
      const rank = ctx.pairPartner ? pairRank(dataset, run, ctx.unit.id, ctx.pairPartner.id) : 'S'
      row = withoutHp(pairUpBonus(null, ctx.unit.supportBonuses, rank))
      break
    }
    case 'effectivePairUp': {
      const rank = ctx.pairPartner ? pairRank(dataset, run, ctx.unit.id, ctx.pairPartner.id) : null
      row = withoutHp(pairUpBonus(classDef?.pairUp, ctx.unit.supportBonuses, rank))
      break
    }
  }
  // Mov has no growth or personal modifier. Pair-up Mov bonuses exist in-game but the class-table
  // byte is not decoded yet (docs/DATA.md › Open questions), so those lenses show "-" too.
  const movement = lens === 'maxStats' || lens === 'baseStats' ? classDef?.movement ?? null : null
  return [...row, movement]
}

export function formatCell(value: number | null, signed: boolean): string {
  if (value === null) return '-'
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1)
  return signed && value > 0 ? `+${rounded}` : rounded
}
