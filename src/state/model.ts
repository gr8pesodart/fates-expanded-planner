import type { Route, StatKey } from '../data/types'

export const PLAN_SCHEMA = 3 as const

export const PLAN_STORAGE_KEY = 'fates-expanded-planner:plans:v3'

export type ClassRouteVia =
  | 'start'
  | 'promotion'
  | 'heart'
  | 'partner'
  | 'friendship'
  | 'master'
  | 'eternal'
  | 'offspring'
  | 'dlc'

export interface ClassStop {
  classId: number
  fromLevel: number
  toLevel: number
  via: ClassRouteVia
}

export interface CorrinPlan {
  gender: 'male' | 'female'
  boon: StatKey
  bane: StatKey
  talentClassId: number | null
}

export interface UnitPlan {
  inArmy: boolean
  sPartner?: string
  aPlusPartner?: string
  variableParent?: string
  classId?: number
  classRoute: ClassStop[]
  skills: (number | null)[]
  inheritSkill?: number
  combatPartner?: string
  combatRole?: 'front' | 'back'
  notes?: string
}

export interface RunPlan {
  id: string
  name: string
  modpackId: string
  dlc: boolean
  route: Route
  corrin: CorrinPlan
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
  dlc?: boolean
  route?: Route
  corrin?: Partial<CorrinPlan>
}

export function emptyUnitPlan(): UnitPlan {
  return { inArmy: true, classRoute: [], skills: [null, null, null, null, null] }
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
    route: 'revelation',
    corrin: { gender: 'male', boon: 'str', bane: 'lck', talentClassId: null },
    units: {},
    createdAt: now,
    updatedAt: now,
  }
}

export function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
