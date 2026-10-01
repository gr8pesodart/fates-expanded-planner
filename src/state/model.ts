import type { Route, StatKey } from '../data/types'

export const PLAN_SCHEMA = 5 as const

// Kept from schema 4 so saved plans migrate in place (store.ts › migrate).
export const PLAN_STORAGE_KEY = 'fates-expanded-planner:plans:v4'

export const SKILL_SLOTS = 5

export type PairRole = 'front' | 'back'

/** A class change taken on reaching `level` of progression segment `segment`. */
export interface Reclass {
  segment: number
  level: number
  classId: number
}

export type Gender = 'male' | 'female'

/** Creation choices each Corrin keeps separately. */
export interface CorrinBuild {
  boon: StatKey
  bane: StatKey
  talentClassId: number | null
}

/**
 * Corrin (M)/(F) and Kana (M)/(F) are separate units with their own plans; switching gender
 * makes the other pair active and keeps the inactive pair's plans (relationships.ts ›
 * switchCorrinGender). Name and hair colour are shared.
 */
export interface CorrinPlan {
  gender: Gender
  builds: Record<Gender, CorrinBuild>
  /** Shown instead of "Corrin"; unset = the default name. */
  name?: string
  /** Hex colour from the game's swatches; unset = the default. */
  hairColour?: string
  /**
   * Set when migrating schema 4: the old single Corrin still has to be copied onto the other gender,
   * which needs the dataset (corrin.ts › expandLegacyCorrin).
   */
  legacy?: true
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
  /**
   * Corrin only: same-gender partners Corrin plans to reach A with. Corrin can't hold an A+ rank but
   * can Friendship Seal into any of these partners' classes (Fire Emblem Wiki › Friendship Seal).
   */
  friendshipPartners?: string[]
  /** Recruitment level for units whose join level depends on when they're recruited. */
  joinLevel?: number
  /** Starred classes, listed first on the Profile and Stats tabs. */
  favouriteClasses?: number[]
  /** Children: starred second-parent candidates, listed first on the Parents tab. */
  favouriteParents?: string[]
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
  corrin?: CorrinPlan
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
    corrin: { gender: 'female', builds: { male: defaultCorrinBuild(), female: defaultCorrinBuild() } },
    favourites: [],
    units: {},
    createdAt: now,
    updatedAt: now,
  }
}

export function defaultCorrinBuild(): CorrinBuild {
  return { boon: 'spd', bane: 'lck', talentClassId: null }
}

/** The active Corrin's creation choices. */
export function corrinBuild(run: RunPlan): CorrinBuild {
  return run.corrin.builds[run.corrin.gender]
}

export function withCorrinBuild(run: RunPlan, patch: Partial<CorrinBuild>): RunPlan {
  const { gender, builds } = run.corrin
  return { ...run, corrin: { ...run.corrin, builds: { ...builds, [gender]: { ...builds[gender], ...patch } } } }
}

export function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
