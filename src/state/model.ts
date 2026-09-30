import type { Route, StatKey } from '../data/types'

export const PLAN_SCHEMA = 4 as const

export const PLAN_STORAGE_KEY = 'fates-expanded-planner:plans:v4'

export const SKILL_SLOTS = 5

export type PairRole = 'front' | 'back'

/** A class change taken on reaching `level` of progression segment `segment`. */
export interface Reclass {
  segment: number
  level: number
  classId: number
}

export interface CorrinPlan {
  gender: 'male' | 'female'
  boon: StatKey
  bane: StatKey
  talentClassId: number | null
}

/**
 * S and pair-up are stored symmetrically; A+ is a one-way choice by this unit.
 * A child's second parent is never stored: it is the fixed parent's `sPartner`.
 */
export interface UnitPlan {
  sPartner?: string
  aPlusPartner?: string
  pairPartner?: string
  pairRole?: PairRole
  classId?: number
  skills: (number | null)[]
  /** Skill inherited from the variable parent (Parent B). */
  inheritSkill?: number
  /** Skill inherited from the fixed parent. */
  inheritFixedSkill?: number
  reclasses: Reclass[]
  eternalSeals?: number
  /** Recruitment level for units whose join level depends on when they're recruited. */
  joinLevel?: number
}

export interface RunPlan {
  id: string
  name: string
  modpackId: string
  mods?: string[]
  dlc: boolean
  route: Route
  corrin: CorrinPlan
  favourites: string[]
  units: Record<string, UnitPlan>
  createdAt: string
  updatedAt: string
}

export interface PlanDocument {
  schema: typeof PLAN_SCHEMA
  runs: RunPlan[]
  activeRunId: string
}

export interface RunPatch {
  name?: string
  modpackId?: string
  mods?: string[]
  dlc?: boolean
  route?: Route
  corrin?: Partial<CorrinPlan>
}

export function emptyUnitPlan(): UnitPlan {
  return { skills: Array.from({ length: SKILL_SLOTS }, () => null), reclasses: [] }
}

export function unitPlanFor(run: RunPlan, unitId: string): UnitPlan {
  return run.units[unitId] ?? emptyUnitPlan()
}

export function emptyRun(id = createId()): RunPlan {
  const now = new Date().toISOString()
  return {
    id,
    name: 'New run',
    modpackId: 'ugf-2.5.2',
    dlc: true,
    route: 'conquest',
    corrin: { gender: 'female', boon: 'spd', bane: 'lck', talentClassId: null },
    favourites: [],
    units: {},
    createdAt: now,
    updatedAt: now,
  }
}

export function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
