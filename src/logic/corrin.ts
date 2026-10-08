import type { Dataset, UnitDef } from '../data/types'
import { edgePartner, supportPartners } from '../data/types'
import type { Gender, RunPlan, UnitPlan } from '../state/model'
import { emptyUnitPlan } from '../state/model'
import { aPlusEligible } from './army'
import { sexedClassId } from './classes'

const MUTUAL = ['sPartner', 'pairPartner'] as const

/** The Corrin of one gender and the Kana whose fixed parent they are. */
export function corrinPair(dataset: Dataset, gender: Gender): { corrin?: UnitDef; kana?: UnitDef } {
  const corrin = dataset.units.find((unit) => unit.isCorrin && unit.gender === gender)
  const kana = corrin ? dataset.units.find((unit) => unit.fixedParent === corrin.id) : undefined
  return { corrin, kana }
}

function sexPlan(dataset: Dataset, plan: UnitPlan, gender: Gender): UnitPlan {
  const sex = (classId: number) => sexedClassId(dataset, classId, gender)
  const next: UnitPlan = { ...plan, skills: [...plan.skills], reclasses: plan.reclasses.map((step) => ({ ...step, classId: sex(step.classId) })) }
  if (plan.classId !== undefined) next.classId = sex(plan.classId)
  if (plan.favouriteClasses) next.favouriteClasses = plan.favouriteClasses.map(sex)
  return next
}

/** Keeps only the bonds `unit` could actually hold (the copy may have changed gender). */
function validBonds(dataset: Dataset, unit: UnitDef, plan: UnitPlan): UnitPlan {
  const next = { ...plan }
  const romantic = new Set(supportPartners(dataset, unit.id, 'romantic').map((edge) => edgePartner(edge, unit.id)))
  if (next.sPartner && !romantic.has(next.sPartner)) delete next.sPartner
  if (next.aPlusPartner && !aPlusEligible(dataset, unit, dataset.unitsById.get(next.aPlusPartner), next.sPartner)) delete next.aPlusPartner
  if (next.friendshipPartners) {
    const kept = next.friendshipPartners.filter((id) => dataset.unitsById.get(id)?.gender === unit.gender && id !== next.sPartner)
    if (kept.length) next.friendshipPartners = kept
    else delete next.friendshipPartners
  }
  if (!next.pairPartner) delete next.pairRole
  return next
}

/**
 * Finishes the legacy-Corrin part of the schema 4 migration: the single old Corrin becomes both
 * Corrins. The other gender's Corrin and Kana get copies of the active plans (classes re-sexed, bonds
 * they can't hold dropped); their remaining bonds are restored by switchCorrinGender when that gender
 * is chosen.
 */
export function expandLegacyCorrin(dataset: Dataset, run: RunPlan): RunPlan {
  if (!run.corrin.legacy) return run
  const { legacy: _done, ...corrin } = run.corrin
  const active = run.corrin.gender
  const other: Gender = active === 'male' ? 'female' : 'male'
  const builds = { ...corrin.builds }
  for (const gender of [active, other]) {
    const talent = builds[gender].talentClassId
    builds[gender] = { ...builds[gender], talentClassId: talent === null ? null : sexedClassId(dataset, talent, gender) }
  }
  const from = corrinPair(dataset, active)
  const to = corrinPair(dataset, other)
  const units = { ...run.units }
  for (const [source, target] of [[from.corrin, to.corrin], [from.kana, to.kana]] as const) {
    const plan = source ? run.units[source.id] : undefined
    if (!plan || !target || units[target.id]) continue
    units[target.id] = validBonds(dataset, target, sexPlan(dataset, plan, target.gender))
  }
  return { ...run, corrin: { ...corrin, builds }, units }
}

/**
 * Makes the other gender's Corrin (and their Kana) active. Each keeps their own plan: the leaving
 * pair's partners are released (their side of the bond is cleared, the leaving plans keep theirs),
 * and the arriving pair's stored S / pair-up bonds are restored where the partner is still free.
 * A partner taken in the meantime stays with their new partner; the arriving plan keeps a one-sided
 * link that `unitContext` reports as stale (shown greyed with a notice).
 */
export function switchCorrinGender(dataset: Dataset, run: RunPlan, gender: Gender): RunPlan {
  if (run.corrin.gender === gender) return run
  const from = corrinPair(dataset, run.corrin.gender)
  const to = corrinPair(dataset, gender)
  const leaving = new Set([from.corrin?.id, from.kana?.id].filter((id): id is string => id !== undefined))
  const arriving = [to.corrin?.id, to.kana?.id].filter((id): id is string => id !== undefined)

  const units: Record<string, UnitPlan> = {}
  for (const [unitId, plan] of Object.entries(run.units)) {
    if (leaving.has(unitId)) {
      units[unitId] = plan
      continue
    }
    let next = plan
    for (const kind of MUTUAL) {
      if (next[kind] && leaving.has(next[kind])) {
        const { [kind]: _gone, ...rest } = next
        next = kind === 'pairPartner' ? (({ pairRole: _role, ...withoutRole }) => withoutRole)(rest) : rest
      }
    }
    units[unitId] = next
  }
  for (const unitId of arriving) {
    const plan = units[unitId]
    if (!plan) continue
    for (const kind of MUTUAL) {
      const partnerId = plan[kind]
      if (!partnerId) continue
      const partner = units[partnerId]
      if (partner?.[kind]) continue
      const restored: UnitPlan = { ...(partner ?? emptyUnitPlan()), [kind]: unitId }
      if (kind === 'pairPartner') restored.pairRole = plan.pairRole === 'back' ? 'front' : 'back'
      units[partnerId] = restored
    }
  }

  const rename = new Map<string, string>()
  if (from.corrin && to.corrin) rename.set(from.corrin.id, to.corrin.id)
  if (from.kana && to.kana) rename.set(from.kana.id, to.kana.id)
  return {
    ...run,
    corrin: { ...run.corrin, gender },
    // The favourite star belongs to "Corrin", not to one gender.
    favourites: [...new Set(run.favourites.map((id) => rename.get(id) ?? id))],
    units,
  }
}
