export type SortDirection = 'asc' | 'desc'

export type RosterSort =
  | { kind: 'recruit'; direction?: SortDirection }
  | { kind: 'name'; direction?: SortDirection }
  | { kind: 'stat'; column: number; direction?: SortDirection }

export const DEFAULT_ROSTER_SORT: RosterSort = { kind: 'recruit', direction: 'asc' }

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
  pairPartner?: string
  pairRole?: 'front' | 'back'
}

export type GenerationFilter = 'all' | 'first' | 'children'

export interface SortOptions {
  favouritesFirst?: boolean
  linkPairs?: boolean
  /** Filtered-out pair partners simply aren't listed, so their partner shows unlinked. */
  generation?: GenerationFilter
}

function inGeneration(entry: RosterSortEntry, generation: GenerationFilter): boolean {
  if (generation === 'all') return true
  return (entry.fixedParent !== null) === (generation === 'children')
}

export function directionOfSort(sort: RosterSort): SortDirection {
  return sort.direction ?? (sort.kind === 'stat' ? 'desc' : 'asc')
}

function compareRecruit(a: RosterSortEntry, b: RosterSortEntry): number {
  return a.recruitIndex - b.recruitIndex
}

/** Favourites first when enabled, then the selected order and recruit order as the tiebreak. */
export function compareRosterEntries(
  a: RosterSortEntry,
  b: RosterSortEntry,
  sort: RosterSort,
  favouritesFirst = true,
): number {
  if (favouritesFirst) {
    const favourite = Number(b.favourite) - Number(a.favourite)
    if (favourite) return favourite
  }

  if (sort.kind === 'recruit') {
    const generation = Number(a.fixedParent !== null) - Number(b.fixedParent !== null)
    if (generation) return generation
  }

  const direction = directionOfSort(sort) === 'desc' ? -1 : 1
  if (sort.kind === 'name') return a.name.localeCompare(b.name) * direction || compareRecruit(a, b)
  if (sort.kind === 'stat') {
    const diff = (a.lensRow[sort.column] ?? 0) - (b.lensRow[sort.column] ?? 0)
    return diff * direction || compareRecruit(a, b)
  }
  return (a.recruitIndex - b.recruitIndex) * direction
}

export function sortRoster(
  entries: RosterSortEntry[],
  sort: RosterSort,
  options: SortOptions = {},
): RosterSortEntry[] {
  const ordered = entries
    .filter((entry) => inGeneration(entry, options.generation ?? 'all'))
    .sort((a, b) => compareRosterEntries(a, b, sort, options.favouritesFirst ?? true))
  if (!options.linkPairs) return ordered

  const byId = new Map(ordered.map((entry) => [entry.unitId, entry]))
  const placed = new Set<string>()
  const linked: RosterSortEntry[] = []
  for (const entry of ordered) {
    if (placed.has(entry.unitId)) continue
    const partner = entry.pairPartner ? byId.get(entry.pairPartner) : undefined
    if (!partner || partner.pairPartner !== entry.unitId) {
      linked.push(entry)
      placed.add(entry.unitId)
      continue
    }

    const front = entry.pairRole === 'back' ? partner : entry
    const back = front === entry ? partner : entry
    linked.push(front, back)
    placed.add(front.unitId)
    placed.add(back.unitId)
  }
  return linked
}

/** "-" cells cannot be sorted; switching to a lens with a blank sorted column resets to recruit order. */
export function reconcileRosterSort(sort: RosterSort, entries: RosterSortEntry[]): RosterSort {
  if (sort.kind !== 'stat') return sort
  const sortable = entries.every((entry) => entry.lensRow[sort.column] != null)
  return sortable ? sort : DEFAULT_ROSTER_SORT
}
