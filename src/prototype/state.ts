/**
 * Prototype-only store: makes the shell genuinely clickable (pins, partner
 * picks, route stops, run switching) over the fixture data. The build
 * orchestrator deletes this module and points the view-model hooks at
 * plansStore; nothing else changes.
 */
import { useSyncExternalStore } from 'react'
import type { Route, StatKey } from '../data/types'
import { classRow } from './derive'
import { CORRIN_DEFAULTS, INITIAL_PLANS, RUNS } from './fixtures'
import type { FixturePlan, FixtureRun } from './fixtures'

export interface ProtoSheet {
  kind: 'partner'
  unitId: string
  rank: 'S' | 'A+' | 'Parent'
}

export interface ProtoState {
  runs: FixtureRun[]
  activeRunId: string
  runName: string
  route: Route
  dlc: boolean
  modpackId: string
  theme: 'paper' | 'night'
  corrinGender: 'male' | 'female'
  corrinBoon: StatKey
  corrinBane: StatKey
  corrinTalentClassId: number
  corrinSpouseId: string
  query: string
  filterId: string
  sortId: string
  pinnedIds: string[]
  compareClassIds: number[]
  statLevel: number
  plans: Record<string, FixturePlan>
  addStopOpen: boolean
  sheet: ProtoSheet | null
  skillSheet: { unitId: string; slot: number } | null
  talentSheet: boolean
  combatSheet: string | null
  copied: boolean
}

const EMPTY_PLAN: FixturePlan = {
  combatRole: 'front',
  skills: [null, null, null, null, null],
  route: [],
}

export function planFor(state: ProtoState, unitId: string): FixturePlan {
  return state.plans[unitId] ?? EMPTY_PLAN
}

export function hasPlan(state: ProtoState, unitId: string): boolean {
  return Boolean(state.plans[unitId])
}

let state: ProtoState = {
  runs: RUNS.map((run) => ({ ...run })),
  activeRunId: RUNS[0].id,
  runName: RUNS[0].name,
  route: RUNS[0].route,
  dlc: RUNS[0].dlc,
  modpackId: RUNS[0].modpackId,
  theme: 'paper',
  corrinGender: CORRIN_DEFAULTS.gender,
  corrinBoon: CORRIN_DEFAULTS.boon,
  corrinBane: CORRIN_DEFAULTS.bane,
  corrinTalentClassId: CORRIN_DEFAULTS.talentClassId,
  corrinSpouseId: CORRIN_DEFAULTS.spouseId,
  query: '',
  filterId: 'all',
  sortId: 'spd',
  pinnedIds: [],
  compareClassIds: [],
  statLevel: 20,
  plans: Object.fromEntries(Object.entries(INITIAL_PLANS).map(([id, plan]) => [id, { ...plan, skills: [...plan.skills], route: plan.route.map((s) => ({ ...s })) }])),
  addStopOpen: false,
  sheet: null,
  skillSheet: null,
  talentSheet: false,
  combatSheet: null,
  copied: false,
}

const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function set(patch: Partial<ProtoState>): void {
  state = { ...state, ...patch }
  emit()
}

function updatePlan(unitId: string, updater: (plan: FixturePlan) => FixturePlan): void {
  const current = planFor(state, unitId)
  set({ plans: { ...state.plans, [unitId]: updater(current) } })
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useProtoState(): ProtoState {
  return useSyncExternalStore(subscribe, () => state, () => state)
}

export const protoActions = {
  setRoute(route: Route) {
    set({ route })
  },
  toggleDlc() {
    set({ dlc: !state.dlc })
  },
  setModpack(modpackId: string) {
    set({ modpackId })
  },
  setRunName(runName: string) {
    set({ runName })
  },
  selectRun(runId: string) {
    const run = state.runs.find((r) => r.id === runId)
    if (!run) return
    set({ activeRunId: runId, runName: run.name, route: run.route, dlc: run.dlc, modpackId: run.modpackId })
  },
  async duplicateRun(runId: string) {
    const run = state.runs.find((r) => r.id === runId)
    if (!run) return
    const copy: FixtureRun = { ...run, id: `${run.id}-copy-${Date.now().toString(36)}`, name: `${run.name} copy`, updatedAt: 'just now' }
    set({ runs: [...state.runs, copy], activeRunId: copy.id, runName: copy.name })
  },
  deleteRun(runId: string) {
    if (state.runs.length <= 1) return
    const runs = state.runs.filter((r) => r.id !== runId)
    const active = state.activeRunId === runId ? runs[0] : state.runs.find((r) => r.id === state.activeRunId)!
    set({ runs, activeRunId: active.id, runName: active.name, route: active.route, dlc: active.dlc, modpackId: active.modpackId })
  },
  createRun() {
    const run: FixtureRun = {
      id: `run-${Date.now().toString(36)}`,
      name: 'New run',
      modpackId: 'ugf-2.5.2',
      dlc: true,
      route: 'revelation',
      updatedAt: 'just now',
      unitCount: 0,
      pairCount: 0,
    }
    set({ runs: [...state.runs, run], activeRunId: run.id, runName: run.name, route: run.route, dlc: run.dlc, modpackId: run.modpackId })
  },
  setTheme(theme: 'paper' | 'night') {
    set({ theme })
  },
  setCorrinGender(corrinGender: 'male' | 'female') {
    set({ corrinGender })
  },
  setCorrinBoon(corrinBoon: StatKey) {
    set({ corrinBoon })
  },
  setCorrinBane(corrinBane: StatKey) {
    set({ corrinBane })
  },
  setCorrinTalent(corrinTalentClassId: number) {
    set({ corrinTalentClassId })
  },
  setCorrinSpouse(corrinSpouseId: string) {
    set({ corrinSpouseId, sheet: null })
  },
  setQuery(query: string) {
    set({ query })
  },
  setFilter(filterId: string) {
    set({ filterId })
  },
  setSort(sortId: string) {
    set({ sortId })
  },
  setStatLevel(statLevel: number) {
    set({ statLevel })
  },
  togglePin(unitId: string) {
    const pinned = state.pinnedIds
    if (pinned.includes(unitId)) {
      set({ pinnedIds: pinned.filter((id) => id !== unitId) })
      return
    }
    if (pinned.length >= 4) return
    set({ pinnedIds: [...pinned, unitId] })
  },
  clearPins() {
    set({ pinnedIds: [] })
  },
  openPartnerSheet(unitId: string, rank: 'S' | 'A+' | 'Parent') {
    set({ sheet: { kind: 'partner', unitId, rank } })
  },
  closeSheet() {
    set({ sheet: null })
  },
  setPartner(unitId: string, rank: 'S' | 'A+' | 'Parent', partnerId: string | null) {
    updatePlan(unitId, (plan) => ({
      ...plan,
      ...(rank === 'S'
        ? { sPartner: partnerId ?? undefined }
        : rank === 'A+'
          ? { aPlusPartner: partnerId ?? undefined }
          : { variableParent: partnerId ?? undefined }),
    }))
    set({ sheet: null })
  },
  openSkillSheet(unitId: string, slot: number) {
    set({ skillSheet: { unitId, slot } })
  },
  closeSkillSheet() {
    set({ skillSheet: null })
  },
  equipSkill(unitId: string, slot: number, skillId: number | null) {
    updatePlan(unitId, (plan) => {
      const skills = [...plan.skills]
      skills[slot] = skillId
      return { ...plan, skills }
    })
    set({ skillSheet: null })
  },
  setClass(unitId: string, classId: number) {
    updatePlan(unitId, (plan) => ({ ...plan, classId }))
  },
  toggleCompareClass(classId: number) {
    const current = state.compareClassIds
    if (current.includes(classId)) {
      set({ compareClassIds: current.filter((id) => id !== classId) })
      return
    }
    set({ compareClassIds: current.length >= 2 ? [current[1], classId] : [...current, classId] })
  },
  clearCompareClasses() {
    set({ compareClassIds: [] })
  },
  openTalentSheet() {
    set({ talentSheet: true })
  },
  closeTalentSheet() {
    set({ talentSheet: false })
  },
  openCombatSheet(unitId: string) {
    set({ combatSheet: unitId })
  },
  closeCombatSheet() {
    set({ combatSheet: null })
  },
  setCombatPartner(unitId: string, partnerId: string | null) {
    updatePlan(unitId, (plan) => ({ ...plan, combatPartner: partnerId ?? undefined }))
    set({ combatSheet: null })
  },
  setCombatRole(unitId: string, role: 'front' | 'back') {
    updatePlan(unitId, (plan) => ({ ...plan, combatRole: role }))
  },
  openAddStop() {
    set({ addStopOpen: true })
  },
  closeAddStop() {
    set({ addStopOpen: false })
  },
  addStop(unitId: string, classId: number, source: string) {
    const tier = classRow(classId)?.tier ?? 'base'
    const via = source === 'dlc' ? 'dlc' : tier === 'promoted' ? 'master' : 'heart'
    updatePlan(unitId, (plan) => ({
      ...plan,
      route: [...plan.route, { classId, fromLevel: 1, toLevel: 20, via }],
    }))
    set({ addStopOpen: false })
  },
  removeStop(unitId: string, index: number) {
    updatePlan(unitId, (plan) => ({ ...plan, route: plan.route.filter((_, i) => i !== index) }))
  },
  copyShare() {
    set({ copied: true })
    window.setTimeout(() => set({ copied: false }), 1600)
  },
}
