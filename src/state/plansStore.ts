import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { newId } from '../lib/ids'
import type { Route, StatKey } from '../data/types'

export interface PlanUnit {
  id: string
  characterId: string
  /** Planned class (id from the class table). */
  classId?: number
  /** Equipped skills (ids, max 5 — see MAX_EQUIPPED_SKILLS). */
  skills?: number[]
  /** S-rank partner (character id from the support graph). */
  sPartnerId?: string
  /** A+ (friendship) partner. */
  aPlusPartnerId?: string
  /** Second-gen units only: the other parent (character id). */
  variableParentId?: string
}

export interface CorrinConfig {
  name: string
  gender: 'male' | 'female'
  talentClassId?: number
  boon?: StatKey
  bane?: StatKey
  /** Voice chosen through the Unit Select Voice mod. */
  voice?: string
}

export interface Plan {
  id: string
  name: string
  route: Route
  buildProfileId: string
  corrin: CorrinConfig
  units: PlanUnit[]
  notes: string
  createdAt: number
  updatedAt: number
}

export interface PlansBundle {
  app: 'fates-expanded-planner'
  schema: 2
  exportedAt: string
  plans: Plan[]
}

interface PlansState {
  plans: Plan[]
  activePlanId: string | null
  createPlan: (name?: string) => string
  duplicatePlan: (id: string) => string | null
  deletePlan: (id: string) => void
  renamePlan: (id: string, name: string) => void
  updatePlan: (id: string, patch: Partial<Omit<Plan, 'id' | 'createdAt'>>) => void
  setActivePlan: (id: string) => void
  addUnit: (planId: string, characterId: string) => string
  removeUnit: (planId: string, unitId: string) => void
  updateUnit: (planId: string, unitId: string, patch: Partial<Omit<PlanUnit, 'id'>>) => void
  setCorrin: (planId: string, patch: Partial<CorrinConfig>) => void
  exportBundle: () => PlansBundle
  importBundle: (json: string) => { imported: number } | { error: string }
  deleteAll: () => void
}

function freshPlan(name: string): Plan {
  const now = Date.now()
  return {
    id: newId(),
    name,
    route: 'revelation',
    buildProfileId: 'ugf-2.5.2',
    corrin: { name: 'Corrin', gender: 'female' },
    units: [{ id: newId(), characterId: corrinPid('female') }],
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}

export function corrinPid(gender: 'male' | 'female'): string {
  return gender === 'male' ? 'PID_プレイヤー男' : 'PID_プレイヤー女'
}

function isCorrinPid(id: string): boolean {
  return id === 'PID_プレイヤー男' || id === 'PID_プレイヤー女'
}

/** Keep exactly one Corrin roster entry, matching the configured gender. */
function normalizeCorrinUnits(units: PlanUnit[], gender: 'male' | 'female'): PlanUnit[] {
  const target = corrinPid(gender)
  let replaced = false
  const out: PlanUnit[] = []
  for (const unit of units) {
    if (isCorrinPid(unit.characterId)) {
      if (!replaced) {
        out.push({ ...unit, characterId: target })
        replaced = true
      }
      continue
    }
    out.push(unit)
  }
  if (!replaced) out.unshift({ id: newId(), characterId: target })
  return out
}

const initialPlan = freshPlan('First run')

export const usePlansStore = create<PlansState>()(
  persist(
    (set, get) => {
      const mutate = (id: string, fn: (plan: Plan) => Plan) =>
        set((state) => ({
          plans: state.plans.map((p) => (p.id === id ? { ...fn(p), updatedAt: Date.now() } : p)),
        }))

      return {
        plans: [initialPlan],
        activePlanId: initialPlan.id,

        createPlan: (name) => {
          const plan = freshPlan(name?.trim() || `Run ${get().plans.length + 1}`)
          set((state) => ({ plans: [plan, ...state.plans], activePlanId: plan.id }))
          return plan.id
        },

        duplicatePlan: (id) => {
          const source = get().plans.find((p) => p.id === id)
          if (!source) return null
          const copy: Plan = {
            ...structuredClone(source),
            id: newId(),
            name: `${source.name} (copy)`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
          set((state) => ({ plans: [copy, ...state.plans], activePlanId: copy.id }))
          return copy.id
        },

        deletePlan: (id) =>
          set((state) => {
            const plans = state.plans.filter((p) => p.id !== id)
            return {
              plans,
              activePlanId:
                state.activePlanId === id ? (plans[0]?.id ?? null) : state.activePlanId,
            }
          }),

        renamePlan: (id, name) => mutate(id, (p) => ({ ...p, name: name.trim() || p.name })),

        updatePlan: (id, patch) => mutate(id, (p) => ({ ...p, ...patch })),

        setActivePlan: (id) => set({ activePlanId: id }),

        addUnit: (planId, characterId) => {
          const unit: PlanUnit = { id: newId(), characterId }
          mutate(planId, (p) => ({ ...p, units: [...p.units, unit] }))
          return unit.id
        },

        removeUnit: (planId, unitId) =>
          mutate(planId, (p) => ({ ...p, units: p.units.filter((u) => u.id !== unitId) })),

        updateUnit: (planId, unitId, patch) =>
          mutate(planId, (p) => ({
            ...p,
            units: p.units.map((u) => (u.id === unitId ? { ...u, ...patch } : u)),
          })),

        setCorrin: (planId, patch) =>
          mutate(planId, (p) => {
            const corrin = { ...p.corrin, ...patch }
            return {
              ...p,
              corrin,
              units: patch.gender ? normalizeCorrinUnits(p.units, patch.gender) : p.units,
            }
          }),

        exportBundle: () => ({
          app: 'fates-expanded-planner',
          schema: 2,
          exportedAt: new Date().toISOString(),
          plans: get().plans,
        }),

        importBundle: (json) => {
          try {
            const parsed = JSON.parse(json) as Partial<PlansBundle>
            if (parsed.app !== 'fates-expanded-planner' || !Array.isArray(parsed.plans)) {
              return { error: 'Not a Fates Expanded Planner export.' }
            }
            const incoming = parsed.plans.filter(isPlanLike)
            if (incoming.length === 0) return { error: 'Export contains no readable plans.' }
            set((state) => {
              const byId = new Map(state.plans.map((p) => [p.id, p]))
              for (const plan of incoming) byId.set(plan.id, plan)
              const plans = [...byId.values()]
              return {
                plans,
                activePlanId: state.activePlanId ?? plans[0]?.id ?? null,
              }
            })
            return { imported: incoming.length }
          } catch {
            return { error: 'Could not parse that file as JSON.' }
          }
        },

        deleteAll: () => {
          const plan = freshPlan('First run')
          set({ plans: [plan], activePlanId: plan.id })
        },
      }
    },
    {
      name: 'fates-expanded-planner/v1',
      version: 2,
      merge: (persisted, current) => {
        const state = persisted as Partial<PlansState> | undefined
        if (!state?.plans) return current
        return {
          ...current,
          ...state,
          plans: (state.plans as Plan[]).map((plan) => ({
            ...plan,
            units: normalizeCorrinUnits(plan.units ?? [], plan.corrin?.gender ?? 'female'),
          })),
        }
      },
      migrate: (persisted, version) => {
        const state = persisted as Partial<PlansState> | undefined
        if (!state?.plans) return persisted as PlansState
        if (version < 2) {
          // v1 tracked seal counters; v2 drops them, adds unit build fields and
          // guarantees a Corrin roster entry.
          state.plans = state.plans.map((plan) => {
            const { seals: _seals, ...rest } = plan as Plan & { seals?: unknown }
            const legacy = rest as Plan
            return {
              ...legacy,
              units: normalizeCorrinUnits(
                (legacy.units ?? []).map((u) => ({ ...u })),
                legacy.corrin?.gender ?? 'female',
              ),
            } as Plan
          })
        }
        return state as PlansState
      },
    },
  ),
)

function isPlanLike(value: unknown): value is Plan {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.route === 'string' &&
    Array.isArray(v.units)
  )
}

export function useActivePlan(): Plan | null {
  return usePlansStore((s) => s.plans.find((p) => p.id === s.activePlanId) ?? null)
}
