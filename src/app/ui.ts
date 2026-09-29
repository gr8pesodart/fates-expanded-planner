import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { LensId } from '../logic/lenses'
import type { RosterSort } from '../logic/rosterSort'
import { DEFAULT_ROSTER_SORT } from '../logic/rosterSort'

interface UiState {
  rosterLens: LensId
  rosterSort: RosterSort
  classLens: LensId
  classFilter: 'base' | 'promoted' | 'all'
  setRosterLens(lens: LensId): void
  setRosterSort(sort: RosterSort): void
  setClassLens(lens: LensId): void
  setClassFilter(filter: UiState['classFilter']): void
}

export const useUi = create<UiState>()(persist((set) => ({
  rosterLens: 'statModifiers',
  rosterSort: DEFAULT_ROSTER_SORT,
  classLens: 'baseStats',
  classFilter: 'base',
  setRosterLens: (rosterLens) => set({ rosterLens }),
  setRosterSort: (rosterSort) => set({ rosterSort }),
  setClassLens: (classLens) => set({ classLens }),
  setClassFilter: (classFilter) => set({ classFilter }),
}), {
  name: 'fates-expanded-planner:ui:v4',
  storage: createJSONStorage(() => localStorage),
}))
