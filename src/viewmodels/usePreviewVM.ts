import { STAT_LABELS } from '../data/types'
import { navigate } from '../lib/router'
import { className, skillName, unitRow } from '../prototype/derive'
import { CORRIN } from '../prototype/fixtures'
import { conflictMessage, previewGroups } from '../prototype/selectors'
import { planFor, protoActions, useProtoState, type ProtoState } from '../prototype/state'
import type { PreviewFactVM, PreviewSlotVM, PreviewVM } from './types'
import { runPillFor, spriteFor } from './shared'

export function usePreviewVM(): PreviewVM {
  const state = useProtoState()
  const groups = previewGroups(state)

  const slotFor = (unitId: string, role: 'Front' | 'Back' | 'Solo'): PreviewSlotVM => ({
    id: unitId,
    name: unitRow(unitId)?.name ?? unitId,
    sprite: spriteFor(unitId),
    role,
    facts: factsFor(state, unitId),
    hanko: rankOf(state, unitId),
    conflict: conflictMessage(state, unitId),
    onOpen: () => navigate({ name: 'unit', unitId }),
  })

  const duos = groups.duoKeys.map((duo) => ({
    id: `duo-${duo.front}-${duo.back}`,
    front: slotFor(duo.front, 'Front'),
    back: slotFor(duo.back, 'Back'),
  }))

  return {
    runPill: runPillFor(state, true),
    duoCount: duos.length,
    soloCount: groups.solos.length,
    unassignedCount: groups.unassigned.length,
    duos,
    solos: groups.solos.map((id) => slotFor(id, 'Solo')),
    unassigned: groups.unassigned.map((id) => ({
      id,
      name: unitRow(id)?.name ?? id,
      sprite: spriteFor(id),
      role: 'Solo' as const,
      facts: [],
      hanko: rankOf(state, id),
      onOpen: () => navigate({ name: 'unit', unitId: id }),
    })),
    copied: state.copied,
    onCopyLink: () => protoActions.copyShare(),
    onPrint: () => window.print(),
  }
}

function rankOf(state: ProtoState, unitId: string): 'S' | 'A+' | null {
  const plan = planFor(state, unitId)
  return plan.sPartner ? 'S' : plan.aPlusPartner ? 'A+' : null
}

function factsFor(state: ProtoState, unitId: string): PreviewFactVM[] {
  const row = unitRow(unitId)
  const plan = planFor(state, unitId)
  const facts: PreviewFactVM[] = []
  const name = (id: string | undefined) => (id ? (unitRow(id)?.name ?? id) : 'unset')

  if (unitId === CORRIN) {
    facts.push({ label: 'Boon', value: STAT_LABELS[state.corrinBoon] })
    facts.push({ label: 'Bane', value: STAT_LABELS[state.corrinBane] })
    facts.push({ label: 'Talent', value: className(state.corrinTalentClassId) })
    facts.push({ label: 'S', value: name(plan.sPartner) })
  } else if (row?.fixedParent) {
    facts.push({ label: unitRow(row.fixedParent)?.gender === 'female' ? 'Mum' : 'Dad', value: name(row.fixedParent) })
    if (plan.variableParent) {
      const parentIsMum = unitRow(plan.variableParent)?.gender === 'female'
      facts.push({ label: parentIsMum ? 'Mum' : 'Dad', value: name(plan.variableParent) })
    }
    const inheritId = plan.inherit?.variable ?? plan.inherit?.fixed
    if (inheritId) facts.push({ label: 'Inherits', value: skillName(inheritId) })
    if (plan.sPartner) facts.push({ label: 'S', value: name(plan.sPartner) })
  } else {
    if (plan.sPartner) facts.push({ label: 'S', value: name(plan.sPartner) })
    if (plan.aPlusPartner) facts.push({ label: 'A+', value: name(plan.aPlusPartner) })
  }

  const classId = plan.classId ?? row?.classes[0]
  if (classId) facts.push({ label: '', value: className(classId), soft: true })
  return facts
}
