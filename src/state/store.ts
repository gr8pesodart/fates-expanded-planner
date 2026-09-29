import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { PlanDocument, RunPatch, RunPlan } from './model'
import { createId, emptyRun, PLAN_SCHEMA, PLAN_STORAGE_KEY } from './model'
import { isPlanDocument, parsePlanDocument, serializePlanDocument } from './serialization'

export interface PlansStore extends PlanDocument {
  /** False until the user finishes the first new-run flow. */
  onboarded: boolean
  createRun(init?: RunPatch): string
  selectRun(runId: string): void
  updateRun(runId: string, patch: RunPatch): void
  /** Apply a pure transform (src/logic/relationships.ts etc.) to a run. */
  mutateRun(runId: string, transform: (run: RunPlan) => RunPlan): void
  duplicateRun(runId: string): string | null
  deleteRun(runId: string): void
  exportJson(): string
  importJson(json: string): void
}

function initialDocument(): PlanDocument {
  const run = emptyRun()
  return { schema: PLAN_SCHEMA, runs: [run], activeRunId: run.id }
}

function touched(run: RunPlan): RunPlan {
  return { ...run, updatedAt: new Date().toISOString() }
}

export const usePlansStore = create<PlansStore>()(persist((set, get) => ({
  ...initialDocument(),
  onboarded: false,
  createRun(init = {}) {
    const base = emptyRun()
    const run: RunPlan = { ...base, ...init, corrin: { ...base.corrin, ...init.corrin } }
    set((state) => {
      const pristine = !state.onboarded && state.runs.length === 1 && Object.keys(state.runs[0].units).length === 0
      return { runs: pristine ? [run] : [...state.runs, run], activeRunId: run.id, onboarded: true }
    })
    return run.id
  },
  selectRun(runId) {
    if (get().runs.some((run) => run.id === runId)) set({ activeRunId: runId })
  },
  updateRun(runId, patch) {
    get().mutateRun(runId, (run) => ({ ...run, ...patch, corrin: { ...run.corrin, ...patch.corrin } }))
  },
  mutateRun(runId, transform) {
    set((state) => ({ runs: state.runs.map((run) => (run.id === runId ? touched(transform(run)) : run)) }))
  },
  duplicateRun(runId) {
    const source = get().runs.find((run) => run.id === runId)
    if (!source) return null
    const now = new Date().toISOString()
    const duplicate: RunPlan = { ...structuredClone(source), id: createId(), name: `${source.name} copy`, createdAt: now, updatedAt: now }
    set((state) => ({ runs: [...state.runs, duplicate], activeRunId: duplicate.id }))
    return duplicate.id
  },
  deleteRun(runId) {
    const state = get()
    if (state.runs.length <= 1) return
    const runs = state.runs.filter((run) => run.id !== runId)
    set({ runs, activeRunId: state.activeRunId === runId ? runs[0].id : state.activeRunId })
  },
  exportJson() {
    const { schema, runs, activeRunId } = get()
    return serializePlanDocument({ schema, runs, activeRunId })
  },
  importJson(json) {
    set({ ...parsePlanDocument(json), onboarded: true })
  },
}), {
  name: PLAN_STORAGE_KEY,
  version: PLAN_SCHEMA,
  storage: createJSONStorage(() => localStorage),
  partialize: ({ schema, runs, activeRunId, onboarded }) => ({ schema, runs, activeRunId, onboarded }),
  migrate: () => ({ ...initialDocument(), onboarded: false }),
  merge: (persisted, current) => {
    if (!isPlanDocument(persisted)) return current
    const onboarded = (persisted as { onboarded?: unknown }).onboarded === true
    return { ...current, ...persisted, onboarded }
  },
}))

export function useActiveRun(): RunPlan {
  return usePlansStore((state) => state.runs.find((run) => run.id === state.activeRunId) ?? state.runs[0])
}
