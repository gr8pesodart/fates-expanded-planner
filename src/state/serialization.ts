import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { ROUTES, STAT_KEYS } from '../data/types'
import type { PlanDocument, RunPlan } from './model'
import { PLAN_SCHEMA } from './model'

const ROUTE_IDS = new Set<string>(ROUTES.map((route) => route.id))
const VIA_IDS = new Set(['start', 'promotion', 'heart', 'partner', 'friendship', 'master', 'eternal', 'offspring', 'dlc'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isRunPlan(value: unknown): value is RunPlan {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return false
  if (typeof value.modpackId !== 'string' || typeof value.dlc !== 'boolean') return false
  if (typeof value.route !== 'string' || !ROUTE_IDS.has(value.route)) return false
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') return false
  if (!isRecord(value.corrin) || !isRecord(value.units)) return false

  const corrin = value.corrin
  if (corrin.gender !== 'male' && corrin.gender !== 'female') return false
  if (!STAT_KEYS.includes(corrin.boon as (typeof STAT_KEYS)[number])) return false
  if (!STAT_KEYS.includes(corrin.bane as (typeof STAT_KEYS)[number])) return false
  if (corrin.talentClassId !== null && typeof corrin.talentClassId !== 'number') return false

  for (const unit of Object.values(value.units)) {
    if (!isRecord(unit) || typeof unit.inArmy !== 'boolean') return false
    if (!Array.isArray(unit.skills) || unit.skills.length !== 5) return false
    if (!unit.skills.every((skill) => skill === null || typeof skill === 'number')) return false
    if (!Array.isArray(unit.classRoute)) return false
    if (!unit.classRoute.every((stop) => {
      if (!isRecord(stop)) return false
      return typeof stop.classId === 'number' && typeof stop.fromLevel === 'number' &&
        typeof stop.toLevel === 'number' && typeof stop.via === 'string' && VIA_IDS.has(stop.via)
    })) return false
    if (!isOptionalString(unit.sPartner) || !isOptionalString(unit.aPlusPartner) ||
      !isOptionalString(unit.variableParent) || !isOptionalString(unit.combatPartner) ||
      !isOptionalString(unit.notes)) return false
    if (unit.classId !== undefined && typeof unit.classId !== 'number') return false
    if (unit.inheritSkill !== undefined && typeof unit.inheritSkill !== 'number') return false
    if (unit.combatRole !== undefined && unit.combatRole !== 'front' && unit.combatRole !== 'back') return false
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
  if (!isPlanDocument(parsed)) throw new Error('This file is not a compatible Fates Planner schema 3 export.')
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
    throw new Error('The share link does not contain a compatible schema 3 run.')
  }
  return parsed.run
}

export function shareUrlForRun(run: RunPlan, currentUrl = window.location.href): string {
  const url = new URL(currentUrl)
  url.hash = `#/preview?plan=${encodeURIComponent(encodeSharedRun(run))}`
  return url.toString()
}
