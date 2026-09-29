import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { getBuildProfile } from '../data/modProfiles'
import { useDataset } from '../data/useDataset'
import type { RunPlan } from '../state/model'
import { useActiveRun, usePlansStore } from '../state/store'
import { PlannerContext } from './plannerContext'

export function PlannerProvider({ sharedRun, children, fallback }: { sharedRun: RunPlan | null; children: ReactNode; fallback: ReactNode }) {
  const activeRun = useActiveRun()
  const run = sharedRun ?? activeRun
  const mutateRun = usePlansStore((state) => state.mutateRun)
  const { data } = useDataset(getBuildProfile(run.modpackId).packId)
  const readOnly = sharedRun !== null
  const mutate = useCallback((transform: (next: RunPlan) => RunPlan) => {
    if (!readOnly) mutateRun(run.id, transform)
  }, [mutateRun, readOnly, run.id])
  const value = useMemo(() => (data ? { dataset: data, run, readOnly, mutate } : null), [data, run, readOnly, mutate])
  if (!value) return fallback
  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}
