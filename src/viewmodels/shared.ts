import { STAT_LABELS } from '../data/types'
import { navigate } from '../lib/router'
import { bestStatIndex, className, partnerOffer, shortSkill, skillName, unitRow } from '../prototype/derive'
import {
  PROTO_SUPPORTS,
  MODPACKS,
  ROSTER_IDS,
  ROUTE_OPTIONS,
  STAT_KEYS_ORDER,
  TALENT_OPTIONS,
  TONES,
} from '../prototype/fixtures'
import { conflictMessage, rosterIds } from '../prototype/selectors'
import { planFor, protoActions, type ProtoState } from '../prototype/state'
import type { CorrinCardVM, PartnerSheetVM, RunPillVM, SpriteVM, TalentSheetVM, UnitSummaryVM } from './types'

export function spriteFor(unitId: string): SpriteVM {
  const row = unitRow(unitId)
  return { label: row?.name ?? unitId, tone: TONES[unitId] }
}

export function runPillFor(state: ProtoState, readOnly?: boolean): RunPillVM {
  const modpack = MODPACKS.find((m) => m.id === state.modpackId)
  return {
    runName: state.runName,
    crest: state.runName.trim().charAt(0).toUpperCase() || 'R',
    modpackLabel: modpack?.label.replace('Unofficial Gay Fates', 'UGF') ?? state.modpackId,
    dlc: state.dlc,
    route: state.route,
    routeLabel: ROUTE_OPTIONS.find((r) => r.id === state.route)?.label ?? state.route,
    readOnly,
    onOpenRuns: () => navigate({ name: 'setup' }),
    onOpenSetup: () => navigate({ name: 'setup' }),
  }
}

export function unitSummaryFor(state: ProtoState, unitId: string): UnitSummaryVM {
  const row = unitRow(unitId)
  const plan = planFor(state, unitId)
  const routeIndex = state.route === 'birthright' ? 0 : state.route === 'conquest' ? 1 : 2
  const personalId = row?.personal[routeIndex] ?? row?.personal[2] ?? 0
  return {
    id: unitId,
    name: row?.name ?? unitId,
    sprite: spriteFor(unitId),
    classChips: classChipsFor(unitId),
    personalSkill: skillName(personalId),
    growths: row?.growths ?? [0, 0, 0, 0, 0, 0, 0, 0],
    bestStatIndex: bestStatIndex(row?.growths ?? []),
    capMods: row?.capMods ?? [0, 0, 0, 0, 0, 0, 0, 0],
    pinned: state.pinnedIds.includes(unitId),
    rank: plan.sPartner ? 'S' : plan.aPlusPartner ? 'A+' : null,
    conflict: conflictMessage(state, unitId),
    onOpen: () => navigate({ name: 'unit', unitId }),
    onTogglePin: () => protoActions.togglePin(unitId),
  }
}

export function classChipsFor(unitId: string): string[] {
  const row = unitRow(unitId)
  if (!row) return []
  const own = row.classes[row.classes.length - 1]
  const secondary = row.reclasses[0]
  const chips = [className(own)]
  if (secondary) chips.push(className(secondary))
  return chips
}

export function partnerSheetFor(state: ProtoState): PartnerSheetVM | null {
  const sheet = state.sheet
  if (!sheet) return null
  const plan = planFor(state, sheet.unitId)
  const current =
    sheet.rank === 'S' ? plan.sPartner : sheet.rank === 'A+' ? plan.aPlusPartner : plan.variableParent
  const anchor = sheet.rank === 'Parent' ? unitRow(sheet.unitId)?.fixedParent ?? sheet.unitId : sheet.unitId
  const rows = PROTO_SUPPORTS[anchor] ?? []
  const options = rows
    .filter(([partnerId]) => partnerId !== sheet.unitId)
    .map(([partnerId, romantic, fast, hasS, hasA]) => ({
      id: partnerId,
      name: unitRow(partnerId)?.name ?? partnerId,
      sprite: spriteFor(partnerId),
      romantic,
      fast,
      hasS,
      hasA,
      current: (current === partnerId ? sheet.rank : null) as 'S' | 'A+' | null,
      onPick: () => protoActions.setPartner(sheet.unitId, sheet.rank, partnerId),
    }))
    .sort((a, b) => {
      if (a.current === sheet.rank && b.current !== sheet.rank) return -1
      if (b.current === sheet.rank && a.current !== sheet.rank) return 1
      const rankScore = (o: (typeof options)[number]) => (o.romantic ? 2 : 0) + (o.hasA ? 1 : 0) + (o.fast ? 0.5 : 0)
      return rankScore(b) - rankScore(a)
    })
  return {
    unitId: sheet.unitId,
    unitName: unitRow(sheet.unitId)?.name ?? sheet.unitId,
    rank: sheet.rank,
    options,
    onClose: () => protoActions.closeSheet(),
    onClear: () => protoActions.setPartner(sheet.unitId, sheet.rank, null),
  }
}

export function talentSheetFor(state: ProtoState): TalentSheetVM | null {
  if (!state.talentSheet) return null
  return {
    options: TALENT_OPTIONS.map((classId) => ({
      classId,
      name: className(classId),
      sprite: { label: className(classId) },
      current: classId === state.corrinTalentClassId,
      onPick: () => protoActions.setCorrinTalent(classId),
    })),
    onClose: () => protoActions.closeTalentSheet(),
  }
}

export function corrinCardFor(state: ProtoState): CorrinCardVM | null {
  const unitId = ROSTER_IDS[0]
  if (!rosterIds(state).includes(unitId)) return null
  const plan = planFor(state, unitId)
  return {
    unitId,
    name: state.corrinGender === 'male' ? 'Corrin (M)' : 'Corrin (F)',
    sprite: spriteFor(unitId),
    gender: state.corrinGender,
    onSetGender: (gender) => protoActions.setCorrinGender(gender),
    boons: STAT_KEYS_ORDER.map((key) => ({
      key,
      label: STAT_LABELS[key],
      active: state.corrinBoon === key,
      onSelect: () => protoActions.setCorrinBoon(key),
    })),
    banes: STAT_KEYS_ORDER.map((key) => ({
      key,
      label: STAT_LABELS[key],
      active: state.corrinBane === key,
      onSelect: () => protoActions.setCorrinBane(key),
    })),
    talent: className(state.corrinTalentClassId),
    spouse: unitRow(plan.sPartner ?? state.corrinSpouseId)?.name ?? 'unset',
    childName: state.corrinGender === 'male' ? 'Kana (F)' : 'Kana (M)',
    onOpenTalent: () => protoActions.openTalentSheet(),
    onOpenSpouse: () => protoActions.openPartnerSheet(unitId, 'S'),
  }
}

export function offerFor(unitId: string): { name: string; skill: string } {
  const offer = partnerOffer(unitId)
  return { name: offer?.name ?? '—', skill: offer?.skillName ?? '—' }
}

export function skillShort(id: number): string {
  return shortSkill(skillName(id))
}

export function classSprite(classId: number): SpriteVM {
  return { label: className(classId) }
}
