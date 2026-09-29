import { create } from 'zustand'

export type PartnerRank = 'S' | 'A+' | 'Parent'

export interface PlannerUiState {
  query: string
  filterId: string
  sortId: string
  pinnedIds: string[]
  compareClassIds: number[]
  statLevel: number
  partnerSheet: { unitId: string; rank: PartnerRank } | null
  skillSheet: { unitId: string; slot: number } | null
  talentSheet: boolean
  combatSheet: string | null
  addStopOpen: boolean
  copied: boolean
  setQuery(query: string): void
  setFilter(filterId: string): void
  setSort(sortId: string): void
  togglePin(unitId: string): void
  clearPins(): void
  toggleCompareClass(classId: number): void
  clearCompareClasses(): void
  setStatLevel(level: number): void
  openPartnerSheet(unitId: string, rank: PartnerRank): void
  closePartnerSheet(): void
  openSkillSheet(unitId: string, slot: number): void
  closeSkillSheet(): void
  setTalentSheet(open: boolean): void
  setCombatSheet(unitId: string | null): void
  setAddStopOpen(open: boolean): void
  setCopied(copied: boolean): void
}

export const usePlannerUiStore = create<PlannerUiState>((set) => ({
  query: '',
  filterId: 'all',
  sortId: 'spd',
  pinnedIds: [],
  compareClassIds: [],
  statLevel: 20,
  partnerSheet: null,
  skillSheet: null,
  talentSheet: false,
  combatSheet: null,
  addStopOpen: false,
  copied: false,
  setQuery: (query) => set({ query }),
  setFilter: (filterId) => set({ filterId }),
  setSort: (sortId) => set({ sortId }),
  togglePin: (unitId) => set((state) => {
    if (state.pinnedIds.includes(unitId)) return { pinnedIds: state.pinnedIds.filter((id) => id !== unitId) }
    if (state.pinnedIds.length >= 4) return state
    return { pinnedIds: [...state.pinnedIds, unitId] }
  }),
  clearPins: () => set({ pinnedIds: [] }),
  toggleCompareClass: (classId) => set((state) => {
    if (state.compareClassIds.includes(classId)) {
      return { compareClassIds: state.compareClassIds.filter((id) => id !== classId) }
    }
    return { compareClassIds: state.compareClassIds.length >= 2
      ? [state.compareClassIds[1], classId]
      : [...state.compareClassIds, classId] }
  }),
  clearCompareClasses: () => set({ compareClassIds: [] }),
  setStatLevel: (statLevel) => set({ statLevel }),
  openPartnerSheet: (unitId, rank) => set({ partnerSheet: { unitId, rank } }),
  closePartnerSheet: () => set({ partnerSheet: null }),
  openSkillSheet: (unitId, slot) => set({ skillSheet: { unitId, slot } }),
  closeSkillSheet: () => set({ skillSheet: null }),
  setTalentSheet: (talentSheet) => set({ talentSheet }),
  setCombatSheet: (combatSheet) => set({ combatSheet }),
  setAddStopOpen: (addStopOpen) => set({ addStopOpen }),
  setCopied: (copied) => set({ copied }),
}))
