import type { Dataset, UnitDef } from '../data/types'
import type { RunPlan, UnitPlan } from '../state/model'
import { unitPlanFor } from '../state/model'
import type { ClassPoolEntry } from './classes'
import { classFamily, classPool, primaryBaseClass, sexedClassId } from './classes'
import type { PairUpRank } from './pairUp'
import { variableParentOf } from './relationships'
import { fixedParentIsCorrin } from './stats'

/** Units on this run's roster: route + DLC availability, only the chosen Corrin and their Kana. */
export function armyUnits(dataset: Dataset, run: RunPlan): UnitDef[] {
  const corrin = dataset.units.find((unit) => unit.isCorrin && unit.gender === run.corrin.gender)
  return dataset.units.filter((unit) => {
    if (unit.isCorrin) return unit.id === corrin?.id
    if (unit.dlc && !run.dlc) return false
    const fixed = unit.fixedParent ? dataset.unitsById.get(unit.fixedParent) : undefined
    if (fixed?.isCorrin && fixed.id !== corrin?.id) return false
    return unit.routes.includes(run.route)
  })
}

export function displayName(unit: UnitDef): string {
  return unit.isCorrin ? 'Corrin' : unit.name.replace(/\s*\((M|F)\)$/, '')
}

export interface ClassStart {
  classId: number
  level: number
}

export interface UnitContext {
  unit: UnitDef
  plan: UnitPlan
  isChild: boolean
  variableParent: UnitDef | undefined
  sPartner: UnitDef | undefined
  aPlusPartner: UnitDef | undefined
  pairPartner: UnitDef | undefined
  pool: ClassPoolEntry[]
  start: ClassStart
  currentClassId: number
  projection: { corrinBoon: RunPlan['corrin']['boon']; corrinBane: RunPlan['corrin']['bane']; variableParentId: string | null }
}

function partner(dataset: Dataset, id: string | undefined): UnitDef | undefined {
  return id ? dataset.unitsById.get(id) : undefined
}

/** Join class/level from the route's recruitment data, else the unit's own base class at Lv 1. */
export function classStart(dataset: Dataset, run: RunPlan, unit: UnitDef): ClassStart {
  const joined = dataset.recruitment?.[run.route]?.get(unit.id)
  if (joined && dataset.classesById.has(joined.joinClassId)) {
    return { classId: sexedClassId(dataset, joined.joinClassId, unit.gender), level: joined.joinLevel }
  }
  const base = primaryBaseClass(dataset, unit) ?? unit.classes[0] ?? 0
  return { classId: sexedClassId(dataset, base, unit.gender), level: 1 }
}

export function unitContext(dataset: Dataset, run: RunPlan, unitId: string): UnitContext | null {
  const unit = dataset.unitsById.get(unitId)
  if (!unit) return null
  const plan = unitPlanFor(run, unitId)
  const variableParent = partner(dataset, variableParentOf(dataset, run, unitId))
  const sPartner = partner(dataset, plan.sPartner)
  const aPlusPartner = partner(dataset, plan.aPlusPartner)
  const pool = classPool(dataset, unit, {
    variableParent,
    sPartner,
    aPlusPartner,
    corrinTalentClassId: run.corrin.talentClassId,
    fixedParentIsCorrin: fixedParentIsCorrin(dataset, unit),
  })
  const start = classStart(dataset, run, unit)
  const lastReclass = [...plan.reclasses].sort((a, b) => a.segment - b.segment || a.level - b.level).at(-1)?.classId
  return {
    unit,
    plan,
    isChild: unit.fixedParent !== null,
    variableParent,
    sPartner,
    aPlusPartner,
    pairPartner: partner(dataset, plan.pairPartner),
    pool,
    start,
    currentClassId: plan.classId ?? lastReclass ?? start.classId,
    projection: {
      corrinBoon: run.corrin.boon,
      corrinBane: run.corrin.bane,
      variableParentId: variableParent?.id ?? null,
    },
  }
}

/**
 * Support rank a pair fights at: S between spouses, otherwise the highest non-S rank their
 * support edge allows (A+ partners pair at A). Null when the build gives them no support.
 */
export function pairRank(dataset: Dataset, run: RunPlan, a: string, b: string): PairUpRank | null {
  if (run.units[a]?.sPartner === b) return 'S'
  const edge = (dataset.edgesByCharacter.get(a) ?? []).find((item) => item.a === b || item.b === b)
  if (!edge) return null
  if (edge.info.ranks.a !== null) return 'A'
  if (edge.info.ranks.b !== null) return 'B'
  if (edge.info.ranks.c !== null) return 'C'
  return null
}

/** Personal skill for the run's route (first-gen units may differ per route). */
export function personalSkill(unit: UnitDef, run: RunPlan): number | null {
  return unit.personalSkills[run.route] ?? unit.personalSkills.revelation ?? unit.personalSkills.birthright ?? unit.personalSkills.conquest
}

// Avatar talent rules (vanilla): no royal line; Monk/Wolfskin for the male avatar, Shrine Maiden/Kitsune for the female.
const TALENT_EXCLUDED = new Set(['Nohr Prince', 'Nohr Princess'])
const TALENT_GENDER: Record<string, 'male' | 'female'> = { Monk: 'male', 'Shrine Maiden': 'female', Wolfskin: 'male', Kitsune: 'female' }

export function talentOptions(dataset: Dataset, gender: 'male' | 'female'): number[] {
  const ids: number[] = []
  for (const def of dataset.classes) {
    if (def.tier !== 'base' || def.promotesTo.length === 0) continue
    const family = classFamily(def.name)
    if (TALENT_EXCLUDED.has(family)) continue
    const locked = TALENT_GENDER[family]
    if (locked && locked !== gender) continue
    const sexed = sexedClassId(dataset, def.id, gender)
    if (!ids.includes(sexed)) ids.push(sexed)
  }
  return ids
}
