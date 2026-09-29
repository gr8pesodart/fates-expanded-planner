import type { UnitPlan } from '../state/model'

export interface PreviewDuoIds {
  front: string
  back: string
}

export interface PreviewGroups {
  duos: PreviewDuoIds[]
  solos: string[]
  unassigned: string[]
  incompleteAssignments: Record<string, string>
}

type CombatPlan = Pick<UnitPlan, 'combatPartner' | 'combatRole'>

export function groupPreviewUnits(
  rosterIds: readonly string[],
  plans: Readonly<Record<string, CombatPlan | undefined>>,
): PreviewGroups {
  const ids = [...new Set(rosterIds)]
  const roster = new Set(ids)
  const handled = new Set<string>()
  const duos: PreviewDuoIds[] = []
  const solos: string[] = []
  const unassigned: string[] = []
  const incompleteAssignments: Record<string, string> = {}

  for (const id of ids) {
    if (handled.has(id)) continue
    handled.add(id)

    const plan = plans[id]
    if (!plan) {
      unassigned.push(id)
      continue
    }

    const partnerId = plan.combatPartner
    if (!partnerId) {
      solos.push(id)
      continue
    }
    if (partnerId === id) {
      solos.push(id)
      incompleteAssignments[id] = 'A unit cannot pair up with itself.'
      continue
    }
    if (!roster.has(partnerId)) {
      solos.push(id)
      incompleteAssignments[id] = 'The selected combat partner is not in this run roster.'
      continue
    }

    const partnerPlan = plans[partnerId]
    if (partnerPlan?.combatPartner !== id) {
      solos.push(id)
      incompleteAssignments[id] = 'Combat partner assignment is not reciprocal.'
      continue
    }

    if (handled.has(partnerId)) continue
    handled.add(partnerId)

    const role = plan.combatRole
    const partnerRole = partnerPlan.combatRole
    if (!role || !partnerRole) {
      solos.push(id, partnerId)
      incompleteAssignments[id] = 'Choose front or back for both units to complete this duo.'
      incompleteAssignments[partnerId] = incompleteAssignments[id]
      continue
    }
    if (role === partnerRole) {
      solos.push(id, partnerId)
      incompleteAssignments[id] = 'A duo needs one front unit and one back unit.'
      incompleteAssignments[partnerId] = incompleteAssignments[id]
      continue
    }

    duos.push(role === 'front'
      ? { front: id, back: partnerId }
      : { front: partnerId, back: id })
  }

  return { duos, solos, unassigned, incompleteAssignments }
}
