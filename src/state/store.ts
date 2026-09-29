import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { PlanDocument, RunPatch, RunPlan, UnitPlan } from './model'
import { createId, emptyRun, emptyUnitPlan, PLAN_SCHEMA, PLAN_STORAGE_KEY } from './model'
import { isPlanDocument, parsePlanDocument, serializePlanDocument } from './serialization'

export interface PlansStore extends PlanDocument {
  createRun(name?: string): string
  selectRun(runId: string): void
  renameRun(runId: string, name: string): void
  updateRun(runId: string, patch: RunPatch): void
  updateUnit(runId: string, unitId: string, update: (unit: UnitPlan) => UnitPlan): void
  duplicateRun(runId: string): string | null
  deleteRun(runId: string): void
  exportJson(): string
  importJson(json: string): void
  replaceDocument(document: PlanDocument): void
}

function initialDocument(): PlanDocument {
  const run = emptyRun()
  return { schema: PLAN_SCHEMA, runs: [run], activeRunId: run.id }
}

function withUpdatedRun(state: PlansStore, runId: string, update: (run: RunPlan) => RunPlan): Pick<PlansStore, 'runs'> {
  return {
    runs: state.runs.map((run) => run.id === runId
      ? { ...update(run), updatedAt: new Date().toISOString() }
      : run),
  }
}

export const usePlansStore = create<PlansStore>()(persist((set, get) => ({
  ...initialDocument(),
  createRun(name) {
    const run = { ...emptyRun(), ...(name === undefined ? {} : { name }) }
    set((state) => ({ runs: [...state.runs, run], activeRunId: run.id }))
    return run.id
  },
  selectRun(runId) {
    if (get().runs.some((run) => run.id === runId)) set({ activeRunId: runId })
  },
  renameRun(runId, name) {
    set((state) => withUpdatedRun(state, runId, (run) => ({ ...run, name })))
  },
  updateRun(runId, patch) {
    set((state) => withUpdatedRun(state, runId, (run) => ({
      ...run,
      ...patch,
      corrin: { ...run.corrin, ...patch.corrin },
    })))
  },
  updateUnit(runId, unitId, update) {
    set((state) => withUpdatedRun(state, runId, (run) => ({
      ...run,
      units: { ...run.units, [unitId]: update(run.units[unitId] ?? emptyUnitPlan()) },
    })))
  },
  duplicateRun(runId) {
    const source = get().runs.find((run) => run.id === runId)
    if (!source) return null
    const duplicate: RunPlan = {
      ...source,
      id: createId(),
      name: `${source.name} copy`,
      units: Object.fromEntries(Object.entries(source.units).map(([unitId, unit]) => [unitId, {
        ...unit,
        classRoute: unit.classRoute.map((stop) => ({ ...stop })),
        skills: [...unit.skills],
      }])),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    set((state) => ({ runs: [...state.runs, duplicate], activeRunId: duplicate.id }))
    return duplicate.id
  },
  deleteRun(runId) {
    const state = get()
    if (state.runs.length <= 1) return
    const runs = state.runs.filter((run) => run.id !== runId)
    if (runs.length === state.runs.length) return
    const activeRunId = state.activeRunId === runId ? runs[0].id : state.activeRunId
    set({ runs, activeRunId })
  },
  exportJson() {
    const { schema, runs, activeRunId } = get()
    return serializePlanDocument({ schema, runs, activeRunId })
  },
  importJson(json) {
    const document = parsePlanDocument(json)
    set(document)
  },
  replaceDocument(document) {
    set(document)
  },
}), {
  name: PLAN_STORAGE_KEY,
  version: PLAN_SCHEMA,
  storage: createJSONStorage(() => localStorage),
  partialize: ({ schema, runs, activeRunId }) => ({ schema, runs, activeRunId }),
  migrate: () => initialDocument(),
  merge: (persisted, current) => {
    if (!isPlanDocument(persisted)) return current
    return { ...current, ...persisted }
  },
}))
