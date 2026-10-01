import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { LensId } from '../logic/lenses'
import type { GenerationFilter, RosterSort } from '../logic/rosterSort'
import { DEFAULT_ROSTER_SORT, directionOfSort } from '../logic/rosterSort'
import type { ParentSort } from '../logic/parents'

export type ChartTab = 'full' | 'skills' | 'progression' | 'pairUp'
export type SkillPickerTab = 'starred' | 'grouped' | 'ungrouped'
import { DEFAULT_PARENT_SORT } from '../logic/parents'

interface UiState {
  rosterLens: LensId
  rosterSort: RosterSort
  rosterFavouritesFirst: boolean
  rosterLinkPairs: boolean
  rosterGeneration: GenerationFilter
  chartSort: RosterSort
  chartFavouritesFirst: boolean
  chartLinkPairs: boolean
  chartGeneration: GenerationFilter
  chartTab: ChartTab
  skillPickerTab: SkillPickerTab
  /** Skill picker: count new S / A+ relationships as ways in. */
  skillFilters: { s: boolean; a: boolean }
  /** Skill picker: collapsed class groups per unit, as `${group}:${classId}`. */
  collapsedSkillClasses: Record<string, string[]>
  classLens: LensId
  classFilter: 'base' | 'promoted' | 'all'
  parentSort: ParentSort
  /** Parents tab: false (default) shows each parent's own contribution, true the child's results. */
  parentEffective: boolean
  setParentSort(sort: ParentSort): void
  setParentEffective(value: boolean): void
  setRosterLens(lens: LensId): void
  setRosterSort(sort: RosterSort): void
  setRosterFavouritesFirst(value: boolean): void
  setRosterLinkPairs(value: boolean): void
  setRosterGeneration(value: GenerationFilter): void
  setChartSort(sort: RosterSort): void
  setChartFavouritesFirst(value: boolean): void
  setChartLinkPairs(value: boolean): void
  setChartGeneration(value: GenerationFilter): void
  setChartTab(tab: ChartTab): void
  setSkillPickerTab(tab: SkillPickerTab): void
  setSkillFilters(filters: { s: boolean; a: boolean }): void
  toggleSkillClass(unitId: string, key: string): void
  setClassLens(lens: LensId): void
  setClassFilter(filter: UiState['classFilter']): void
}

export const useUi = create<UiState>()(persist((set, get) => ({
  rosterLens: 'statModifiers',
  rosterSort: DEFAULT_ROSTER_SORT,
  rosterFavouritesFirst: true,
  rosterLinkPairs: false,
  rosterGeneration: 'all',
  chartSort: DEFAULT_ROSTER_SORT,
  chartFavouritesFirst: true,
  chartLinkPairs: true,
  chartGeneration: 'all',
  chartTab: 'skills',
  skillPickerTab: 'grouped',
  skillFilters: { s: true, a: true },
  collapsedSkillClasses: {},
  classLens: 'baseStats',
  classFilter: 'base',
  parentSort: DEFAULT_PARENT_SORT,
  parentEffective: false,
  setParentSort: (parentSort) => set({ parentSort }),
  setParentEffective: (parentEffective) => set({ parentEffective }),
  setRosterLens: (rosterLens) => set({ rosterLens }),
  setRosterSort: (rosterSort) => set({ rosterSort }),
  setRosterFavouritesFirst: (rosterFavouritesFirst) => set({ rosterFavouritesFirst }),
  setRosterLinkPairs: (rosterLinkPairs) => set({ rosterLinkPairs }),
  setRosterGeneration: (rosterGeneration) => set({ rosterGeneration }),
  setChartSort: (chartSort) => set({ chartSort }),
  setChartFavouritesFirst: (chartFavouritesFirst) => set({ chartFavouritesFirst }),
  setChartLinkPairs: (chartLinkPairs) => set({ chartLinkPairs }),
  setChartGeneration: (chartGeneration) => set({ chartGeneration }),
  setChartTab: (chartTab) => set({ chartTab }),
  setSkillPickerTab: (skillPickerTab) => set({ skillPickerTab }),
  setSkillFilters: (skillFilters) => set({ skillFilters }),
  toggleSkillClass: (unitId, key) => {
    const current = get().collapsedSkillClasses[unitId] ?? []
    const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    set({ collapsedSkillClasses: { ...get().collapsedSkillClasses, [unitId]: next } })
  },
  setClassLens: (classLens) => set({ classLens }),
  setClassFilter: (classFilter) => set({ classFilter }),
}), {
  name: 'fates-expanded-planner:ui:v4',
  version: 2,
  storage: createJSONStorage(() => localStorage),
  merge: (persistedState, currentState) => {
    const persisted = persistedState as Partial<UiState>
    const normalize = (sort: RosterSort | undefined) => sort
      ? { ...sort, direction: directionOfSort(sort) }
      : DEFAULT_ROSTER_SORT
    return {
      ...currentState,
      ...persisted,
      rosterSort: normalize(persisted.rosterSort),
      chartSort: normalize(persisted.chartSort),
      rosterFavouritesFirst: persisted.rosterFavouritesFirst ?? true,
      rosterLinkPairs: persisted.rosterLinkPairs ?? false,
      chartFavouritesFirst: persisted.chartFavouritesFirst ?? true,
      chartLinkPairs: persisted.chartLinkPairs ?? true,
      rosterGeneration: persisted.rosterGeneration ?? 'all',
      chartGeneration: persisted.chartGeneration ?? 'all',
      parentSort: persisted.parentSort ?? DEFAULT_PARENT_SORT,
      parentEffective: persisted.parentEffective ?? false,
      chartTab: persisted.chartTab ?? 'skills',
      skillPickerTab: persisted.skillPickerTab ?? 'grouped',
      skillFilters: persisted.skillFilters ?? { s: true, a: true },
      collapsedSkillClasses: persisted.collapsedSkillClasses ?? {},
    }
  },
}))
