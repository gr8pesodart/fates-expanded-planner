import { createContext, useContext } from 'react'
import type { Dataset } from '../data/types'
import type { RunPlan } from '../state/model'

export interface Planner {
  dataset: Dataset
  run: RunPlan
  /** Shared links render read-only: every edit control is hidden or disabled. */
  readOnly: boolean
  mutate(transform: (run: RunPlan) => RunPlan): void
}

export const PlannerContext = createContext<Planner | null>(null)

export function usePlanner(): Planner {
  const planner = useContext(PlannerContext)
  if (!planner) throw new Error('usePlanner needs a <PlannerProvider>')
  return planner
}
