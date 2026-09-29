export type RosterSort =
  | { kind: 'recruit' }
  | { kind: 'name' }
  | { kind: 'stat'; column: number }

export const DEFAULT_ROSTER_SORT: RosterSort = { kind: 'recruit' }

export interface RosterSortEntry {
  unitId: string
  name: string
  favourite: boolean
  /** Position in the active route's recruitment order (recruitment.json); optional recruits sit at their chapter. */
  recruitIndex: number
  /** PID of the fixed parent for second-gen units, null for first-gen. */
  fixedParent: string | null
  /** Active roster lens row; null cells render as "-" and have no value to sort by. */
  lensRow: (number | null)[]
}

// Children trail every first-gen unit in recruit order; among themselves they keep paralogue order.
function compareRecruit(a: RosterSortEntry, b: RosterSortEntry): number {
  const generation = Number(a.fixedParent !== null) - Number(b.fixedParent !== null)
  return generation || a.recruitIndex - b.recruitIndex
}

/** Favourites first, then the chosen sort, then recruit order as the tiebreak. */
export function compareRosterEntries(a: RosterSortEntry, b: RosterSortEntry, sort: RosterSort): number {
  const favourite = Number(b.favourite) - Number(a.favourite)
  if (favourite) return favourite
  if (sort.kind === 'name') return a.name.localeCompare(b.name) || compareRecruit(a, b)
  if (sort.kind === 'stat') {
    const diff = (b.lensRow[sort.column] ?? 0) - (a.lensRow[sort.column] ?? 0)
    return diff || compareRecruit(a, b)
  }
  return compareRecruit(a, b)
}

export function sortRoster(entries: RosterSortEntry[], sort: RosterSort): RosterSortEntry[] {
  return [...entries].sort((a, b) => compareRosterEntries(a, b, sort))
}

/** "-" cells cannot be sorted: a stat sort on a column the new lens leaves blank falls back to recruit order. */
export function reconcileRosterSort(sort: RosterSort, entries: RosterSortEntry[]): RosterSort {
  if (sort.kind !== 'stat') return sort
  const sortable = entries.every((entry) => entry.lensRow[sort.column] != null)
  return sortable ? sort : DEFAULT_ROSTER_SORT
}
