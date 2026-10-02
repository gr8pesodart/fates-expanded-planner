import { useMemo } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { LensId } from '../logic/lenses'
import type { GenerationFilter, RosterSort } from '../logic/rosterSort'
import { DEFAULT_ROSTER_SORT, directionOfSort } from '../logic/rosterSort'
import type { ParentSort } from '../logic/parents'
import type { SkillFilters } from '../logic/skillAccess'
import { ALL_WAYS } from '../logic/skillAccess'

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
  /** Skill picker, per unit: count new S / A+ relationships and other second parents as ways in. */
  skillFilters: Record<string, SkillFilters>
  /** Automate progression: weapon columns each unit's plan favours (when the player picked them). */
  weaponFocus: Record<string, number[]>
  setWeaponFocus(unitId: string, weapons: number[]): void
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
  setSkillFilters(unitId: string, filters: SkillFilters): void
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
  skillFilters: {},
  collapsedSkillClasses: {},
  weaponFocus: {},
  setWeaponFocus: (unitId, weapons) => set({ weaponFocus: { ...get().weaponFocus, [unitId]: weapons } }),
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
  setSkillFilters: (unitId, filters) => set({ skillFilters: { ...get().skillFilters, [unitId]: filters } }),
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
      // v3.3 kept one global { s, a }; v3.4 keeps them per unit.
      skillFilters: persisted.skillFilters && !('s' in persisted.skillFilters) ? persisted.skillFilters : {},
      collapsedSkillClasses: persisted.collapsedSkillClasses ?? {},
      weaponFocus: persisted.weaponFocus ?? {},
    }
  },
}))

/** A unit's skill picker filters (all relationships count until changed). */
export function useSkillFilters(unitId: string): SkillFilters {
  const stored = useUi((state) => state.skillFilters[unitId])
  return useMemo(() => ({ ...ALL_WAYS, ...stored }), [stored])
}
