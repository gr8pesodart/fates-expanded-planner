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
  { id: 'statModifiers', label: 'Stat Modifiers', signed: true },
  { id: 'personalGrowths', label: 'Personal Growth Rates', signed: false },
  { id: 'effectiveGrowths', label: 'Effective Growth Rates', signed: false },
  { id: 'maxStats', label: 'Max Stats', signed: false },
  { id: 'effectivePairUp', label: 'Effective Pair Up Bonuses', signed: true },
  { id: 'personalPairUp', label: 'Personal Pair Up Bonuses', signed: true },
  { id: 'baseStats', label: 'Base Stats', signed: false },
  { id: 'classGrowths', label: 'Class Growth Rates', signed: false },
  { id: 'classPairUp', label: 'Class Pair Up Bonuses', signed: true },
]

export const CLASS_CARD_LENSES: readonly LensId[] = ['baseStats', 'maxStats', 'classGrowths', 'effectiveGrowths', 'classPairUp']

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
  switch (lens) {
    case 'statModifiers':
      return withoutHp(projectUnit(dataset, ctx.unit, undefined, ctx.projection).caps)
    case 'personalGrowths':
      return projectUnit(dataset, ctx.unit, undefined, ctx.projection).growths
    case 'effectiveGrowths':
      return projectUnit(dataset, ctx.unit, classId, ctx.projection).growths
    case 'maxStats':
      return classDef ? projectUnit(dataset, ctx.unit, classId, ctx.projection).caps : empty()
    case 'baseStats':
      return classDef ? [...classDef.baseStats] : empty()
    case 'classGrowths':
      return classDef ? [...classDef.growths] : empty()
    case 'classPairUp':
      return classDef ? withoutHp(classDef.pairUp) : empty()
    case 'personalPairUp': {
      const rank = ctx.pairPartner ? pairRank(dataset, run, ctx.unit.id, ctx.pairPartner.id) : 'S'
      return withoutHp(pairUpBonus(null, ctx.unit.supportBonuses, rank))
    }
    case 'effectivePairUp': {
      const rank = ctx.pairPartner ? pairRank(dataset, run, ctx.unit.id, ctx.pairPartner.id) : null
      return withoutHp(pairUpBonus(classDef?.pairUp, ctx.unit.supportBonuses, rank))
    }
  }
}

export function formatCell(value: number | null, signed: boolean): string {
  if (value === null) return '-'
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1)
  return signed && value > 0 ? `+${rounded}` : rounded
}
