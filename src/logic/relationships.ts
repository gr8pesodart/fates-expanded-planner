import type { Dataset } from '../data/types'
import type { PairRole, RunPlan, UnitPlan } from '../state/model'
import { emptyUnitPlan } from '../state/model'
import { sexedClassId } from './classes'

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

/** A child's second parent is its fixed parent's S partner (the "Parent B" slot writes through to it). */
export function variableParentOf(dataset: Dataset, run: RunPlan, unitId: string): string | undefined {
  const fixed = dataset.unitsById.get(unitId)?.fixedParent
  return fixed ? run.units[fixed]?.sPartner : undefined
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

export function toggleFavourite(run: RunPlan, unitId: string): RunPlan {
  const favourites = run.favourites.includes(unitId)
    ? run.favourites.filter((id) => id !== unitId)
    : [...run.favourites, unitId]
  return { ...run, favourites }
}

/**
 * Corrin (M)/(F) and Kana (M)/(F) are separate units. Switching Corrin's gender moves both
 * plans (and every reference to them) onto the other variant so relationships survive.
 */
export function switchCorrinGender(dataset: Dataset, run: RunPlan, gender: 'male' | 'female'): RunPlan {
  if (run.corrin.gender === gender) return run
  const renames = new Map<string, string>()
  const corrinFrom = dataset.units.find((unit) => unit.isCorrin && unit.gender === run.corrin.gender)
  const corrinTo = dataset.units.find((unit) => unit.isCorrin && unit.gender === gender)
  if (corrinFrom && corrinTo) renames.set(corrinFrom.id, corrinTo.id)
  const kanaFrom = dataset.units.find((unit) => corrinFrom && unit.fixedParent === corrinFrom.id)
  const kanaTo = dataset.units.find((unit) => corrinTo && unit.fixedParent === corrinTo.id)
  if (kanaFrom && kanaTo) renames.set(kanaFrom.id, kanaTo.id)

  const rename = (id: string | undefined) => (id === undefined ? undefined : renames.get(id) ?? id)
  const units: Units = {}
  for (const [unitId, plan] of Object.entries(run.units)) {
    const next: UnitPlan = { ...plan }
    for (const kind of ['sPartner', 'aPlusPartner', 'pairPartner'] as const) {
      const renamed = rename(plan[kind])
      if (renamed === undefined) delete next[kind]
      else next[kind] = renamed
    }
    const target = rename(unitId) ?? unitId
    const targetGender = dataset.unitsById.get(target)?.gender
    if (target !== unitId && targetGender) {
      const sex = (classId: number) => sexedClassId(dataset, classId, targetGender)
      if (next.classId !== undefined) next.classId = sex(next.classId)
      next.reclasses = next.reclasses.map((step) => ({ ...step, classId: sex(step.classId) }))
    }
    units[target] = next
  }
  return {
    ...run,
    corrin: {
      ...run.corrin,
      gender,
      talentClassId: run.corrin.talentClassId === null ? null : sexedClassId(dataset, run.corrin.talentClassId, gender),
    },
    favourites: run.favourites.map((id) => rename(id) ?? id),
    units,
  }
}
