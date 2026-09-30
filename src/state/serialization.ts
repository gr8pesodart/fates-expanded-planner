import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { ROUTES, STAT_KEYS } from '../data/types'
import type { PlanDocument, RunPlan } from './model'
import { PLAN_SCHEMA, SKILL_SLOTS } from './model'

const ROUTE_IDS = new Set<string>(ROUTES.map((route) => route.id))

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
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
  if (!STAT_KEYS.includes(corrin.boon as (typeof STAT_KEYS)[number])) return false
  if (!STAT_KEYS.includes(corrin.bane as (typeof STAT_KEYS)[number])) return false
  if (corrin.talentClassId !== null && typeof corrin.talentClassId !== 'number') return false

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
    if (unit.pairRole !== undefined && unit.pairRole !== 'front' && unit.pairRole !== 'back') return false
  }

  return true
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
  if (!isPlanDocument(parsed)) throw new Error('This file is not a compatible Fates Planner schema 4 export.')
  return parsed
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
  if (!isRecord(parsed) || parsed.schema !== PLAN_SCHEMA || !isRunPlan(parsed.run)) {
    throw new Error('The share link does not contain a compatible schema 4 run.')
  }
  return parsed.run
}

export function shareUrlForRun(run: RunPlan, currentUrl = window.location.href): string {
  const url = new URL(currentUrl)
  url.hash = `#/chart?plan=${encodeURIComponent(encodeSharedRun(run))}`
  return url.toString()
}
