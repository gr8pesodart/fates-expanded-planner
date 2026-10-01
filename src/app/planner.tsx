import { useCallback, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { getBuildProfile } from '../data/modProfiles'
import { useDataset } from '../data/useDataset'
import { expandLegacyCorrin } from '../logic/corrin'
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
  // A run saved under schema 4 finishes migrating once its dataset is here (corrin.ts).
  const settled = useMemo(() => (data ? expandLegacyCorrin(data, run) : run), [data, run])
  useEffect(() => {
    if (data && !readOnly && run.corrin.legacy) mutateRun(run.id, (current) => expandLegacyCorrin(data, current))
  }, [data, readOnly, run, mutateRun])
  const value = useMemo(() => (data ? { dataset: data, run: settled, readOnly, mutate } : null), [data, settled, readOnly, mutate])
  if (!value) return fallback
  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}
