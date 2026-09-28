import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { newId } from '../lib/ids'
import type { Route, StatKey } from '../data/types'

export interface PlanUnit {
  id: string
  characterId: string
  note?: string
}

export interface CorrinConfig {
  name: string
  gender: 'male' | 'female'
  boon?: StatKey
  bane?: StatKey
  /** Voice chosen through the Unit Select Voice mod. */
  voice?: string
}

export interface SealCounts {
  master: number
  heart: number
  partner: number
  friend: number
}

export interface Plan {
  id: string
  name: string
  route: Route
  buildProfileId: string
  corrin: CorrinConfig
  units: PlanUnit[]
  seals: SealCounts
  notes: string
  createdAt: number
  updatedAt: number
}

export interface PlansBundle {
  app: 'fates-expanded-planner'
  schema: 1
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
  addUnit: (planId: string, characterId: string) => void
  removeUnit: (planId: string, unitId: string) => void
  setCorrin: (planId: string, patch: Partial<CorrinConfig>) => void
  bumpSeal: (planId: string, seal: keyof SealCounts, delta: number) => void
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
    units: [],
    seals: { master: 0, heart: 0, partner: 0, friend: 0 },
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
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

        addUnit: (planId, characterId) =>
          mutate(planId, (p) => ({
            ...p,
            units: [...p.units, { id: newId(), characterId }],
          })),

        removeUnit: (planId, unitId) =>
          mutate(planId, (p) => ({ ...p, units: p.units.filter((u) => u.id !== unitId) })),

        setCorrin: (planId, patch) =>
          mutate(planId, (p) => ({ ...p, corrin: { ...p.corrin, ...patch } })),

        bumpSeal: (planId, seal, delta) =>
          mutate(planId, (p) => ({
            ...p,
            seals: { ...p.seals, [seal]: Math.max(0, p.seals[seal] + delta) },
          })),

        exportBundle: () => ({
          app: 'fates-expanded-planner',
          schema: 1,
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
      version: 1,
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
