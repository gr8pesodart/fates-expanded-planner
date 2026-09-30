import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { LensId } from '../logic/lenses'
import type { GenerationFilter, RosterSort } from '../logic/rosterSort'
import { DEFAULT_ROSTER_SORT, directionOfSort } from '../logic/rosterSort'

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
  classLens: LensId
  classFilter: 'base' | 'promoted' | 'all'
  setRosterLens(lens: LensId): void
  setRosterSort(sort: RosterSort): void
  setRosterFavouritesFirst(value: boolean): void
  setRosterLinkPairs(value: boolean): void
  setRosterGeneration(value: GenerationFilter): void
  setChartSort(sort: RosterSort): void
  setChartFavouritesFirst(value: boolean): void
  setChartLinkPairs(value: boolean): void
  setChartGeneration(value: GenerationFilter): void
  setClassLens(lens: LensId): void
  setClassFilter(filter: UiState['classFilter']): void
}

export const useUi = create<UiState>()(persist((set) => ({
  rosterLens: 'statModifiers',
  rosterSort: DEFAULT_ROSTER_SORT,
  rosterFavouritesFirst: true,
  rosterLinkPairs: false,
  rosterGeneration: 'all',
  chartSort: DEFAULT_ROSTER_SORT,
  chartFavouritesFirst: true,
  chartLinkPairs: true,
  chartGeneration: 'all',
  classLens: 'baseStats',
  classFilter: 'base',
  setRosterLens: (rosterLens) => set({ rosterLens }),
  setRosterSort: (rosterSort) => set({ rosterSort }),
  setRosterFavouritesFirst: (rosterFavouritesFirst) => set({ rosterFavouritesFirst }),
  setRosterLinkPairs: (rosterLinkPairs) => set({ rosterLinkPairs }),
  setRosterGeneration: (rosterGeneration) => set({ rosterGeneration }),
  setChartSort: (chartSort) => set({ chartSort }),
  setChartFavouritesFirst: (chartFavouritesFirst) => set({ chartFavouritesFirst }),
  setChartLinkPairs: (chartLinkPairs) => set({ chartLinkPairs }),
  setChartGeneration: (chartGeneration) => set({ chartGeneration }),
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
    }
  },
}))
