/** Fixture-backed list/relationship derivations for the prototype view models. */
import type { StatKey } from '../data/types'
import { classRow, statKeyIndex, unitRow } from './derive'
import { CONFLICTS, FILTERS, PROTO_UNITS, ROSTER_IDS, SORTS } from './fixtures'
import type { FixtureConflict } from './fixtures'
import { hasPlan, planFor, type ProtoState } from './state'

export function rosterIds(state: ProtoState): string[] {
  return ROSTER_IDS.filter((id) => state.dlc || !PROTO_UNITS[id]?.dlc)
}

export function matchesQuery(state: ProtoState, unitId: string): boolean {
  const query = state.query.trim().toLowerCase()
  if (!query) return true
  const row = unitRow(unitId)
  if (!row) return false
  const haystack = [
    row.name,
    ...row.classes.map((id) => classRow(id)?.name ?? ''),
    ...row.reclasses.map((id) => classRow(id)?.name ?? ''),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function conflictsFor(state: ProtoState): FixtureConflict[] {
  const extra: FixtureConflict[] = []
  const claimed = new Map<string, string[]>()
  for (const id of ROSTER_IDS) {
    const plan = state.plans[id]
    if (!plan) continue
    for (const [rank, partner] of [
      ['S', plan.sPartner],
      ['A+', plan.aPlusPartner],
    ] as const) {
      if (!partner || !state.plans[partner]) continue
      const back = rank === 'S' ? state.plans[partner].sPartner : state.plans[partner].aPlusPartner
      if (back !== id) {
        extra.push({
          id: `onesided-${id}-${rank}`,
          unitIds: [id, partner],
          message: `${unitRow(id)?.name} lists ${unitRow(partner)?.name} as ${rank}, but ${unitRow(partner)?.name} has not picked them back.`,
        })
      }
      const claimants = claimed.get(`${partner}-${rank}`) ?? []
      claimed.set(`${partner}-${rank}`, [...claimants, id])
    }
  }
  for (const [key, claimants] of claimed) {
    if (claimants.length < 2) continue
    const [partnerId, rank] = key.split('-')
    extra.push({
      id: `claimed-${key}`,
      unitIds: [partnerId, ...claimants],
      message: `${unitRow(partnerId)?.name} is claimed as ${rank} by ${claimants.map((id) => unitRow(id)?.name).join(' and ')}.`,
    })
  }
  const staticUnits = new Set(CONFLICTS.flatMap((conflict) => conflict.unitIds))
  const fresh = extra.filter((conflict) => !conflict.unitIds.some((id) => staticUnits.has(id)))
  const seen = new Set<string>()
  return [...CONFLICTS, ...fresh].filter((conflict) => {
    const key = [...conflict.unitIds].sort().join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function conflictMessage(state: ProtoState, unitId: string): string | undefined {
  return conflictsFor(state).find((c) => c.unitIds.includes(unitId))?.message
}

export function matchesFilter(state: ProtoState, unitId: string): boolean {
  const plan = state.plans[unitId]
  switch (state.filterId) {
    case 'unpaired':
      return !plan || (!plan.sPartner && !plan.aPlusPartner && !plan.combatPartner)
    case 'children':
      return Boolean(unitRow(unitId)?.fixedParent)
    case 'magic':
      return (unitRow(unitId)?.growths[2] ?? 0) >= 30
    case 'conflicts':
      return conflictsFor(state).some((c) => c.unitIds.includes(unitId))
    default:
      return true
  }
}

export function filterChips(state: ProtoState): { id: string; label: string; count: number; warn: boolean; active: boolean }[] {
  const roster = rosterIds(state)
  const countFor = (id: string): number => {
    switch (id) {
      case 'unpaired':
        return roster.filter((unitId) => {
          const plan = state.plans[unitId]
          return !plan || (!plan.sPartner && !plan.aPlusPartner && !plan.combatPartner)
        }).length
      case 'children':
        return roster.filter((unitId) => Boolean(unitRow(unitId)?.fixedParent)).length
      case 'magic':
        return roster.filter((unitId) => (unitRow(unitId)?.growths[2] ?? 0) >= 30).length
      case 'conflicts':
        return conflictsFor(state).length
      default:
        return roster.length
    }
  }
  return FILTERS.map((filter) => ({
    id: filter.id,
    label: filter.label,
    count: countFor(filter.id),
    warn: Boolean(filter.warn),
    active: state.filterId === filter.id,
  }))
}

export function sortOptions(state: ProtoState): { id: string; label: string; active: boolean }[] {
  return SORTS.map((sort) => ({ id: sort.id, label: sort.label, active: state.sortId === sort.id }))
}

export function sortLabel(state: ProtoState): string {
  const sort = SORTS.find((s) => s.id === state.sortId)
  return `${sort?.label ?? 'Spd'} ↓`
}

export function visibleRoster(state: ProtoState): string[] {
  const sort = SORTS.find((s) => s.id === state.sortId) ?? SORTS[0]
  const index = sort.stat === 'name' ? -1 : statKeyIndex(sort.stat as StatKey)
  const units = rosterIds(state).filter((id) => matchesQuery(state, id) && matchesFilter(state, id))
  if (sort.stat === 'name') {
    return [...units].sort((a, b) => (unitRow(a)?.name ?? '').localeCompare(unitRow(b)?.name ?? ''))
  }
  return [...units].sort((a, b) => {
    const av = unitRow(a)?.growths[index] ?? 0
    const bv = unitRow(b)?.growths[index] ?? 0
    return bv - av || (unitRow(a)?.name ?? '').localeCompare(unitRow(b)?.name ?? '')
  })
}

export interface PairModel {
  id: string
  a: string
  b: string
  childId?: string
  variableParentId?: string
}

export function pairsFor(state: ProtoState): PairModel[] {
  const seen = new Set<string>()
  const pairs: PairModel[] = []
  for (const id of rosterIds(state)) {
    const plan = state.plans[id]
    if (!plan?.sPartner) continue
    const partner = plan.sPartner
    if (state.plans[partner]?.sPartner !== id) continue
    const key = [id, partner].sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    const childEntry = Object.entries(PROTO_UNITS).find(([, row]) => row.fixedParent === id || row.fixedParent === partner)
    const childId = childEntry?.[0]
    const fixedParent = childEntry?.[1].fixedParent
    const variableParentId = fixedParent === id ? partner : id
    pairs.push({ id: `pair-${key}`, a: id, b: partner, childId, variableParentId })
  }
  return pairs
}

export interface PreviewGroups {
  duoKeys: { front: string; back: string }[]
  solos: string[]
  unassigned: string[]
}

export function previewGroups(state: ProtoState): PreviewGroups {
  const seen = new Set<string>()
  const duos: { front: string; back: string }[] = []
  for (const id of rosterIds(state)) {
    const plan = state.plans[id]
    if (!plan?.combatPartner) continue
    const partner = plan.combatPartner
    if (state.plans[partner]?.combatPartner !== id) continue
    const key = [id, partner].sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    const idPlan = planFor(state, id)
    const partnerPlan = planFor(state, partner)
    const front = idPlan.combatRole === 'front' ? id : partnerPlan.combatRole === 'front' ? partner : id
    const back = front === id ? partner : id
    duos.push({ front, back })
  }
  const assigned = new Set(duos.flatMap((duo) => [duo.front, duo.back]))
  const solos = rosterIds(state).filter((id) => hasPlan(state, id) && !assigned.has(id))
  const unassigned = rosterIds(state).filter((id) => !hasPlan(state, id))
  return { duoKeys: duos, solos, unassigned }
}
