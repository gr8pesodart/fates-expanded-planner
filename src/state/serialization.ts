import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { ROUTES, STAT_KEYS } from '../data/types'
import type { CorrinBuild, PlanDocument, RunPlan } from './model'
import { PLAN_SCHEMA, SKILL_SLOTS } from './model'

const ROUTE_IDS = new Set<string>(ROUTES.map((route) => route.id))

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isNumberList(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === 'number')
}

function isCorrinBuild(value: unknown): value is CorrinBuild {
  if (!isRecord(value)) return false
  if (!STAT_KEYS.includes(value.boon as (typeof STAT_KEYS)[number])) return false
  if (!STAT_KEYS.includes(value.bane as (typeof STAT_KEYS)[number])) return false
  return value.talentClassId === null || typeof value.talentClassId === 'number'
}

function isRunPlan(value: unknown): value is RunPlan {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return false
  if (typeof value.modpackId !== 'string' || typeof value.dlc !== 'boolean') return false
  if (value.mods !== undefined && (!Array.isArray(value.mods) || !value.mods.every((id) => typeof id === 'string'))) return false
  if (typeof value.route !== 'string' || !ROUTE_IDS.has(value.route)) return false
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') return false
  if (!isRecord(value.corrin) || !isRecord(value.units)) return false

  const corrin = value.corrin
  if (corrin.gender !== 'male' && corrin.gender !== 'female') return false
  if (!isRecord(corrin.builds) || !isCorrinBuild(corrin.builds.male) || !isCorrinBuild(corrin.builds.female)) return false
  if (!isOptionalString(corrin.name) || !isOptionalString(corrin.hairColour)) return false
  if (corrin.legacy !== undefined && corrin.legacy !== true) return false

  if (!Array.isArray(value.favourites) || !value.favourites.every((id) => typeof id === 'string')) return false

  for (const unit of Object.values(value.units)) {
    if (!isRecord(unit)) return false
    if (!Array.isArray(unit.skills) || unit.skills.length !== SKILL_SLOTS) return false
    if (!unit.skills.every((skill) => skill === null || typeof skill === 'number')) return false
    if (!Array.isArray(unit.reclasses)) return false
    if (!unit.reclasses.every((step) => isRecord(step) && typeof step.segment === 'number' &&
      typeof step.level === 'number' && typeof step.classId === 'number')) return false
    if (!isOptionalString(unit.sPartner) || !isOptionalString(unit.aPlusPartner) ||
      !isOptionalString(unit.pairPartner)) return false
    if (unit.classId !== undefined && typeof unit.classId !== 'number') return false
    if (unit.inheritSkill !== undefined && typeof unit.inheritSkill !== 'number') return false
    if (unit.inheritFixedSkill !== undefined && typeof unit.inheritFixedSkill !== 'number') return false
    if (unit.eternalSeals !== undefined && typeof unit.eternalSeals !== 'number') return false
    if (unit.joinLevel !== undefined && typeof unit.joinLevel !== 'number') return false
    if (unit.friendshipPartners !== undefined && (!Array.isArray(unit.friendshipPartners) ||
      !unit.friendshipPartners.every((id) => typeof id === 'string'))) return false
    if (unit.pairRole !== undefined && unit.pairRole !== 'front' && unit.pairRole !== 'back') return false
    if (unit.favouriteClasses !== undefined && !isNumberList(unit.favouriteClasses)) return false
    if (unit.favouriteParents !== undefined && (!Array.isArray(unit.favouriteParents) ||
      !unit.favouriteParents.every((id) => typeof id === 'string'))) return false
  }

  return true
}

/**
 * Schema 4 kept one set of Corrin choices. Both genders start from it; the plans themselves are
 * copied across once the dataset is loaded (corrin.ts › expandLegacyCorrin, flagged by `legacy`).
 */
function migrateRun(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.corrin) || 'builds' in value.corrin) return value
  const { gender, boon, bane, talentClassId, ...rest } = value.corrin
  const build = { boon, bane, talentClassId }
  return { ...value, corrin: { ...rest, gender, builds: { male: build, female: { ...build } }, legacy: true } }
}

/** Upgrades a schema 4 document (or share payload) to the current schema; anything else is returned unchanged. */
export function migratePlanDocument(value: unknown): unknown {
  if (!isRecord(value) || value.schema !== 4) return value
  return {
    ...value,
    schema: PLAN_SCHEMA,
    ...(Array.isArray(value.runs) ? { runs: value.runs.map(migrateRun) } : {}),
    ...('run' in value ? { run: migrateRun(value.run) } : {}),
  }
}

export function isPlanDocument(value: unknown): value is PlanDocument {
  if (!isRecord(value) || value.schema !== PLAN_SCHEMA || typeof value.activeRunId !== 'string') return false
  if (!Array.isArray(value.runs) || !value.runs.every(isRunPlan)) return false
  return value.runs.length > 0 && value.runs.some((run) => run.id === value.activeRunId)
}

export function serializePlanDocument(document: PlanDocument): string {
  return JSON.stringify(document, null, 2)
}

export function parsePlanDocument(json: string): PlanDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  const migrated = migratePlanDocument(parsed)
  if (!isPlanDocument(migrated)) throw new Error(`This file is not a compatible Fates Planner schema ${PLAN_SCHEMA} export.`)
  return migrated
}

export function encodeSharedRun(run: RunPlan): string {
  return compressToEncodedURIComponent(JSON.stringify({ schema: PLAN_SCHEMA, run }))
}

export function decodeSharedRun(token: string): RunPlan {
  const json = decompressFromEncodedURIComponent(token)
  if (!json) throw new Error('The share link is incomplete or invalid.')
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('The share link is incomplete or invalid.')
  }
  const migrated = migratePlanDocument(parsed)
  if (!isRecord(migrated) || migrated.schema !== PLAN_SCHEMA || !isRunPlan(migrated.run)) {
    throw new Error(`The share link does not contain a compatible schema ${PLAN_SCHEMA} run.`)
  }
  return migrated.run
}

export function shareUrlForRun(run: RunPlan, currentUrl = window.location.href): string {
  const url = new URL(currentUrl)
  url.hash = `#/chart?plan=${encodeURIComponent(encodeSharedRun(run))}`
  return url.toString()
}
