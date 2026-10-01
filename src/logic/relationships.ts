import type { Dataset } from '../data/types'
import type { PairRole, RunPlan, UnitPlan } from '../state/model'
import { emptyUnitPlan } from '../state/model'

export type BondKind = 'sPartner' | 'aPlusPartner' | 'pairPartner'

type Units = Record<string, UnitPlan>

function edit(units: Units, unitId: string, update: (plan: UnitPlan) => UnitPlan): Units {
  return { ...units, [unitId]: update(units[unitId] ?? emptyUnitPlan()) }
}

function unlink(units: Units, unitId: string, kind: BondKind): Units {
  const partner = units[unitId]?.[kind]
  let next = edit(units, unitId, (plan) => withoutBond(plan, kind))
  if (partner && next[partner]?.[kind] === unitId) next = edit(next, partner, (plan) => withoutBond(plan, kind))
  return next
}

function withoutBond(plan: UnitPlan, kind: BondKind): UnitPlan {
  const { [kind]: _removed, ...rest } = plan
  if (kind !== 'pairPartner') return rest
  const { pairRole: _role, ...withoutRole } = rest
  return withoutRole
}

/** S and pair-up are mutual; an A+ selection belongs only to the unit choosing it. */
export function setBond(run: RunPlan, unitId: string, kind: BondKind, partnerId: string | null): RunPlan {
  const role: PairRole = run.units[unitId]?.pairRole ?? 'front'
  if (kind === 'aPlusPartner') {
    let units = edit(run.units, unitId, (plan) => withoutBond(plan, kind))
    if (partnerId && partnerId !== unitId) units = edit(units, unitId, (plan) => ({ ...plan, aPlusPartner: partnerId }))
    return { ...run, units }
  }
  let units = unlink(run.units, unitId, kind)
  if (partnerId && partnerId !== unitId) {
    units = unlink(units, partnerId, kind)
    units = edit(units, unitId, (plan) => ({ ...plan, [kind]: partnerId }))
    units = edit(units, partnerId, (plan) => ({ ...plan, [kind]: unitId }))
    if (kind === 'pairPartner') {
      units = edit(units, unitId, (plan) => ({ ...plan, pairRole: role }))
      units = edit(units, partnerId, (plan) => ({ ...plan, pairRole: role === 'front' ? 'back' : 'front' }))
    }
    // Corrin's S partner can't also be one of Corrin's A-rank Friendship Seal partners.
    if (kind === 'sPartner') {
      units = dropFriendshipPartner(units, unitId, partnerId)
      units = dropFriendshipPartner(units, partnerId, unitId)
    }
  }
  return { ...run, units }
}

function dropFriendshipPartner(units: Units, ownerId: string, partnerId: string): Units {
  const current = units[ownerId]?.friendshipPartners
  if (!current?.includes(partnerId)) return units
  return edit(units, ownerId, ({ friendshipPartners: _old, ...plan }) => {
    const next = current.filter((id) => id !== partnerId)
    return next.length ? { ...plan, friendshipPartners: next } : plan
  })
}

export function setPairRole(run: RunPlan, unitId: string, role: PairRole): RunPlan {
  const partner = run.units[unitId]?.pairPartner
  let units = edit(run.units, unitId, (plan) => ({ ...plan, pairRole: role }))
  if (partner) units = edit(units, partner, (plan) => ({ ...plan, pairRole: role === 'front' ? 'back' : 'front' }))
  return { ...run, units }
}

export function swapPair(run: RunPlan, unitId: string): RunPlan {
  const role = run.units[unitId]?.pairRole ?? 'front'
  return setPairRole(run, unitId, role === 'front' ? 'back' : 'front')
}

/**
 * The partner of a mutual bond, or undefined. Writes keep S and pair-up symmetric; the one exception
 * is a Corrin (or Kana) made active again whose partner was taken meanwhile — that one-sided link
 * is kept for the notice but grants nothing (corrin.ts › switchCorrinGender).
 */
export function bondPartner(run: RunPlan, unitId: string, kind: 'sPartner' | 'pairPartner'): string | undefined {
  const partner = run.units[unitId]?.[kind]
  return partner && run.units[partner]?.[kind] === unitId ? partner : undefined
}

/** A child's second parent is its fixed parent's S partner (the "Parent B" slot writes through to it). */
export function variableParentOf(dataset: Dataset, run: RunPlan, unitId: string): string | undefined {
  const fixed = dataset.unitsById.get(unitId)?.fixedParent
  return fixed ? bondPartner(run, fixed, 'sPartner') : undefined
}

export function setVariableParent(dataset: Dataset, run: RunPlan, childId: string, parentId: string | null): RunPlan {
  const fixed = dataset.unitsById.get(childId)?.fixedParent
  return fixed ? setBond(run, fixed, 'sPartner', parentId) : run
}

/** Corrin's planned A-rank partners are a set, not an exclusive bond: add or remove one; null clears all. */
export function toggleFriendshipPartner(run: RunPlan, corrinId: string, partnerId: string | null): RunPlan {
  const units = edit(run.units, corrinId, ({ friendshipPartners = [], ...plan }) => {
    const next = partnerId === null ? []
      : friendshipPartners.includes(partnerId) ? friendshipPartners.filter((id) => id !== partnerId)
        : [...friendshipPartners, partnerId]
    return next.length ? { ...plan, friendshipPartners: next } : plan
  })
  return { ...run, units }
}

/** Starred classes are per unit and always listed first (Profile class cards, Stats class rail). */
export function toggleFavouriteClass(run: RunPlan, unitId: string, classId: number): RunPlan {
  return {
    ...run,
    units: edit(run.units, unitId, ({ favouriteClasses = [], ...plan }) => {
      const next = favouriteClasses.includes(classId) ? favouriteClasses.filter((id) => id !== classId) : [...favouriteClasses, classId]
      return next.length ? { ...plan, favouriteClasses: next } : plan
    }),
  }
}

/** Starred second-parent candidates are per child and listed first on the Parents tab. */
export function toggleFavouriteParent(run: RunPlan, childId: string, parentId: string): RunPlan {
  return {
    ...run,
    units: edit(run.units, childId, ({ favouriteParents = [], ...plan }) => {
      const next = favouriteParents.includes(parentId) ? favouriteParents.filter((id) => id !== parentId) : [...favouriteParents, parentId]
      return next.length ? { ...plan, favouriteParents: next } : plan
    }),
  }
}

/** Favourites first, each group keeping its order. */
export function favouriteClassesFirst(classIds: readonly number[], favourites: readonly number[] = []): number[] {
  const starred = new Set(favourites)
  return [...classIds.filter((id) => starred.has(id)), ...classIds.filter((id) => !starred.has(id))]
}

export function toggleFavourite(run: RunPlan, unitId: string): RunPlan {
  const favourites = run.favourites.includes(unitId)
    ? run.favourites.filter((id) => id !== unitId)
    : [...run.favourites, unitId]
  return { ...run, favourites }
}
