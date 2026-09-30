import type { Dataset, UnitDef } from '../data/types'
import type { RunPlan } from '../state/model'
import type { UnitContext } from './army'
import { supportBonusesOf, unitContext } from './army'
import type { StatRow } from './lenses'
import { lensRow, pairUpRow } from './lenses'
import { pairUpBonus } from './pairUp'
import { setVariableParent } from './relationships'
import type { RosterSort, SortDirection } from './rosterSort'

export type ParentSort =
  | { kind: 'recruit' | 'name'; direction?: SortDirection }
  | { kind: 'modifier' | 'growth'; column: number; direction?: SortDirection }

export const DEFAULT_PARENT_SORT: ParentSort = { kind: 'recruit', direction: 'asc' }

export function parentSortDirection(sort: ParentSort): SortDirection {
  return sort.direction ?? (sort.kind === 'recruit' || sort.kind === 'name' ? 'asc' : 'desc')
}

export interface ParentRows {
  modifiers: StatRow
  growths: StatRow
  pairUp: StatRow
}

/**
 * What a candidate Parent B passes on. `contribution` (the default view) shows the parent's own
 * share: their stat modifiers, their personal growths, and the B and S pair-up rows a variable
 * parent hands down. Otherwise it shows the child's resulting values with this parent.
 */
export function parentRows(dataset: Dataset, run: RunPlan, child: UnitContext, parent: UnitDef, contribution: boolean): ParentRows {
  if (contribution) {
    const parentCtx = unitContext(dataset, run, parent.id)
    if (!parentCtx) return { modifiers: [], growths: [], pairUp: [] }
    const rows = supportBonusesOf(dataset, run, parentCtx)
    const passed = [rows[1], rows[3]].reduce<number[]>((sum, row) => sum.map((value, index) => value + (row?.[index] ?? 0)), [0, 0, 0, 0, 0, 0, 0, 0])
    return {
      modifiers: lensRow(dataset, run, parentCtx, 'statModifiers'),
      growths: lensRow(dataset, run, parentCtx, 'personalGrowths'),
      pairUp: pairUpRow(passed),
    }
  }
  const candidateRun = setVariableParent(dataset, run, child.unit.id, parent.id)
  const candidateCtx = unitContext(dataset, candidateRun, child.unit.id)
  if (!candidateCtx) return { modifiers: [], growths: [], pairUp: [] }
  return {
    modifiers: lensRow(dataset, candidateRun, candidateCtx, 'statModifiers'),
    growths: lensRow(dataset, candidateRun, candidateCtx, 'personalGrowths'),
    pairUp: pairUpRow(pairUpBonus(null, supportBonusesOf(dataset, candidateRun, candidateCtx), 'S')),
  }
}

/** Compare two candidates; `recruit` is the caller's recruit-order comparison (the tiebreak). */
export function compareParents(
  a: { name: string; rows: ParentRows },
  b: { name: string; rows: ParentRows },
  sort: ParentSort,
  recruit: number,
): number {
  const direction = parentSortDirection(sort) === 'desc' ? -1 : 1
  if (!('column' in sort)) return sort.kind === 'name' ? a.name.localeCompare(b.name) * direction || recruit : recruit * direction
  const { kind, column } = sort
  const pick = (rows: ParentRows) => (kind === 'modifier' ? rows.modifiers : rows.growths)[column] ?? 0
  return (pick(a.rows) - pick(b.rows)) * direction || recruit
}

/** The Roster sort-icon equivalent (stat sorts show the stat's glyph). */
export function parentSortIcon(sort: ParentSort): RosterSort {
  const direction = parentSortDirection(sort)
  return 'column' in sort ? { kind: 'stat', column: sort.column, direction } : { kind: sort.kind, direction }
}
