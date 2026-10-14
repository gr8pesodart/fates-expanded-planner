import type { Dataset, DatasetEdge, RecruitmentEntry, Route, StatKey, UnitDef } from '../data/types'
import { unitDlcOn } from '../data/dlcs'
import type { RunPlan, UnitPlan } from '../state/model'
import { childStart } from './childRecruit'
import { corrinBuild, unitPlanFor } from '../state/model'
import type { ClassPoolEntry } from './classes'
import { classFamily, classPool, primaryBaseClass, sexedClassId } from './classes'
import type { PairUpRank } from './pairUp'
import { bondPartner, variableParentOf } from './relationships'

// Route-locked promotions (Fire Emblem Fandom › Nohr Prince: "Nohr Noble (Conquest/Revelation)",
// "Hoshido Noble (Birthright/Revelation)"). The lock is on the class, so no seal or inheritance
// reaches the other route's Noble.
const ROUTE_LOCKED: Record<string, Route> = { 'Hoshido Noble': 'conquest', 'Nohr Noble': 'birthright' }

export function classOnRoute(dataset: Dataset, classId: number, route: Route): boolean {
  const def = dataset.classesById.get(classId)
  return !def || ROUTE_LOCKED[classFamily(def.name)] !== route
}

/** Units on this run's roster: route + DLC availability, only the chosen Corrin and their Kana. */
export function armyUnits(dataset: Dataset, run: RunPlan): UnitDef[] {
  const corrin = dataset.units.find((unit) => unit.isCorrin && unit.gender === run.corrin.gender)
  return dataset.units.filter((unit) => {
    if (unit.isCorrin) return unit.id === corrin?.id
    if (unit.dlc && !unitDlcOn(run, unit.id)) return false
    const fixed = unit.fixedParent ? dataset.unitsById.get(unit.fixedParent) : undefined
    if (fixed?.isCorrin && fixed.id !== corrin?.id) return false
    return unit.routes.includes(run.route)
  })
}

/** Parent and child, as planned: the child's fixed parent or its chosen second parent. */
function isParentOf(dataset: Dataset, run: RunPlan, parent: UnitDef, child: UnitDef): boolean {
  return child.fixedParent === parent.id || variableParentOf(dataset, run, child.id) === parent.id
}

/** UGF stores family (siblings and the like) as the fast support type with the 4th rank locked. */
function isKinEdge(edge: DatasetEdge): boolean {
  return edge.info.fast && edge.info.ranks.s === null
}

function edgeBetween(dataset: Dataset, a: string, b: string): DatasetEdge | undefined {
  return (dataset.edgesByCharacter.get(a) ?? []).find((edge) => edge.a === b || edge.b === b)
}

/** Children of siblings: UGF locks their pair like family (Shiro x Kiragi, Siegbert x Forrest). */
function areCousins(dataset: Dataset, a: UnitDef, b: UnitDef): boolean {
  if (!a.fixedParent || !b.fixedParent) return false
  const link = edgeBetween(dataset, a.fixedParent, b.fixedParent)
  return link !== undefined && isKinEdge(link)
}

/**
 * Whether `unit` can take `donor` as its A+ partner: any same-gender pair with an A rank that
 * isn't family. UGF FAQ: "If two units of the same gender don't have an S support, they will
 * instead have an A+", so age/lore-locked pairs (Elise with most of the older cast) and every
 * first-gen x child pair qualify as well as S-capable ones; siblings (fast type, S locked),
 * cousins and a child's actual parents (fixed or chosen second parent) never do. Owner rules on
 * top: never the unit's S partner, Corrin neither gives nor takes A+.
 */
export function aPlusEligible(dataset: Dataset, run: RunPlan, unit: UnitDef, donor: UnitDef | undefined, sPartnerId: string | undefined): donor is UnitDef {
  if (!donor || donor.id === unit.id || unit.isCorrin || donor.isCorrin) return false
  if (donor.gender !== unit.gender || donor.id === sPartnerId) return false
  if (isParentOf(dataset, run, donor, unit) || isParentOf(dataset, run, unit, donor)) return false
  const edge = edgeBetween(dataset, unit.id, donor.id)
  return edge !== undefined && edge.info.ranks.a !== null && !isKinEdge(edge) && !areCousins(dataset, unit, donor)
}

/** Corrin goes by the run's chosen name (default "Corrin"); everyone else drops the (M)/(F) tag. */
export function displayName(unit: UnitDef, run: RunPlan): string {
  return unit.isCorrin ? run.corrin.name?.trim() || 'Corrin' : unit.name.replace(/\s*\((M|F)\)$/, '')
}

export interface ClassStart {
  classId: number
  level: number
  /** Level from the recruitment data, before the plan's override. */
  defaultLevel: number
  /** Chapter the unit joins in, when the recruitment data knows it. */
  chapter: string | null
  /** Paralogue, Xenologue, DLC and "or later" recruits join at a level set by when they're recruited. */
  variableLevel: boolean
  /** Children: recruitment chapter (story position), its range, and the Offspring Seal's level if they carry one. */
  child?: { chapter: number; earliest: number; final: number; offspringLevel: number | null }
}

const VARIABLE_JOIN = /^(Paralogue|Xenologue)|or later/

export interface UnitContext {
  unit: UnitDef
  plan: UnitPlan
  isChild: boolean
  variableParent: UnitDef | undefined
  sPartner: UnitDef | undefined
  aPlusPartner: UnitDef | undefined
  /** Corrin only: the eligible planned Friendship Seal partners (Corrin has no A+). */
  friendshipPartners: UnitDef[]
  pairPartner: UnitDef | undefined
  /** One-sided S / pair-up links (a re-activated Corrin whose partner moved on): shown, never applied. */
  stale: { sPartner?: UnitDef; pairPartner?: UnitDef }
  pool: ClassPoolEntry[]
  start: ClassStart
  currentClassId: number
  projection: { corrinBoon: StatKey; corrinBane: StatKey; variableParentId: string | null }
}

function partner(dataset: Dataset, id: string | undefined): UnitDef | undefined {
  return id ? dataset.unitsById.get(id) : undefined
}

/** The unit's recruitment row on this run's route, with the Corrin-gender override applied. */
export function recruitmentOf(dataset: Dataset, run: RunPlan, unitId: string): RecruitmentEntry | undefined {
  const entry = dataset.recruitment?.[run.route]?.get(unitId)
  const override = entry?.ifCorrin?.[run.corrin.gender]
  return entry && override ? { ...entry, ...override } : entry
}

/** Join class/level from the route's recruitment data, else the unit's own base class at Lv 1. */
export function classStart(dataset: Dataset, run: RunPlan, unit: UnitDef): ClassStart {
  const joined = recruitmentOf(dataset, run, unit.id)
  const known = joined && dataset.classesById.has(joined.joinClassId) ? joined : undefined
  const classId = sexedClassId(dataset, known?.joinClassId ?? primaryBaseClass(dataset, unit) ?? unit.classes[0] ?? 0, unit.gender)
  const defaultLevel = known?.joinLevel ?? 1
  const variableLevel = unit.dlc || !known || VARIABLE_JOIN.test(known.chapter)
  const override = variableLevel ? run.units[unit.id]?.joinLevel : undefined
  const cap = dataset.classesById.get(classId)?.tier === 'special' ? 40 : 20
  const level = override === undefined ? defaultLevel : Math.min(cap, Math.max(1, Math.round(override)))
  return { classId, level, defaultLevel, chapter: known?.chapter ?? null, variableLevel }
}

export function unitContext(dataset: Dataset, run: RunPlan, unitId: string): UnitContext | null {
  const unit = dataset.unitsById.get(unitId)
  if (!unit) return null
  const plan = unitPlanFor(run, unitId)
  const variableParent = partner(dataset, variableParentOf(dataset, run, unitId))
  const sPartner = partner(dataset, bondPartner(run, unitId, 'sPartner'))
  const pairPartner = partner(dataset, bondPartner(run, unitId, 'pairPartner'))
  const stale = {
    sPartner: sPartner ? undefined : partner(dataset, plan.sPartner),
    pairPartner: pairPartner ? undefined : partner(dataset, plan.pairPartner),
  }
  const rosterIds = new Set(armyUnits(dataset, run).map((entry) => entry.id))
  // A stale pick that's no longer eligible (e.g. since married, or off this roster) grants nothing.
  const aPlusCandidate = partner(dataset, plan.aPlusPartner)
  const aPlusPartner = aPlusCandidate && rosterIds.has(aPlusCandidate.id) && aPlusEligible(dataset, run, unit, aPlusCandidate, sPartner?.id) ? aPlusCandidate : undefined
  const build = corrinBuild(run)
  // Corrin's Friendship Seal partners: the planned ones that are still eligible (same gender, can
  // reach A, on this roster). A gender switch or route change quietly drops the rest.
  const friendshipDonors = unit.isCorrin
    ? (plan.friendshipPartners ?? []).flatMap((id) => {
      const donor = dataset.unitsById.get(id)
      const reachesA = (dataset.edgesByCharacter.get(unit.id) ?? []).some((edge) => (edge.a === id || edge.b === id) && edge.info.ranks.a !== null)
      return donor && reachesA && id !== plan.sPartner && donor.gender === unit.gender && rosterIds.has(id) ? [donor] : []
    })
    : []
  const pool = classPool(dataset, unit, {
    variableParent,
    sPartner,
    aPlusPartner,
    friendshipDonors,
    corrinTalentClassId: build.talentClassId,
  })
  const start = unit.fixedParent === null ? classStart(dataset, run, unit) : childStart(dataset, run, unit, variableParent ?? null, classStart(dataset, run, unit))
  const routePool = pool.filter((entry) => classOnRoute(dataset, entry.classId, run.route))
  const lastReclass = [...plan.reclasses].sort((a, b) => a.segment - b.segment || a.level - b.level).at(-1)?.classId
  return {
    unit,
    plan,
    isChild: unit.fixedParent !== null,
    variableParent,
    sPartner,
    aPlusPartner,
    friendshipPartners: friendshipDonors,
    pairPartner,
    stale,
    pool: routePool,
    start,
    currentClassId: plan.classId ?? lastReclass ?? start.classId,
    projection: {
      corrinBoon: build.boon,
      corrinBane: build.bane,
      variableParentId: variableParent?.id ?? null,
    },
  }
}

const NO_BONUS: readonly number[] = [0, 0, 0, 0, 0, 0, 0, 0]

/**
 * Personal pair-up rows [C, B, A, S]. Children's rows are empty in the game data: they take C and A
 * from the father and B and S from the mother (Serenes Forest › Pair-Up Stats), except Shigure and
 * male Kana, who take C and A from their mother (GameFAQs child pair-up guide). Every other child's
 * fixed parent is the father, so "fixed parent → C/A, variable parent → B/S" covers them all — and
 * gives UGF's same-sex couples a consistent answer.
 */
export function supportBonusesOf(dataset: Dataset, run: RunPlan, ctx: UnitContext): readonly (readonly number[])[] {
  if (!ctx.isChild) return ctx.unit.supportBonuses
  const rowsOf = (parent: UnitDef | undefined): readonly (readonly number[])[] => {
    if (!parent) return []
    if (parent.fixedParent === null) return parent.supportBonuses
    // Corrin can marry a child, so Kana's other parent may itself be second-generation.
    const parentCtx = unitContext(dataset, run, parent.id)
    return parentCtx ? supportBonusesOf(dataset, run, parentCtx) : []
  }
  const fixed = rowsOf(ctx.unit.fixedParent ? dataset.unitsById.get(ctx.unit.fixedParent) : undefined)
  const variable = rowsOf(ctx.variableParent)
  return [fixed[0] ?? NO_BONUS, variable[1] ?? NO_BONUS, fixed[2] ?? NO_BONUS, variable[3] ?? NO_BONUS]
}

/**
 * Support rank a pair fights at: S between spouses, otherwise the highest non-S rank their
 * support edge allows (A+ partners pair at A). Null when the build gives them no support.
 */
export function pairRank(dataset: Dataset, run: RunPlan, a: string, b: string): PairUpRank | null {
  if (bondPartner(run, a, 'sPartner') === b) return 'S'
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

// Avatar talent rules (Serenes Forest › Class Sets: "includes every regular class (excludes
// Songstress, Kitsune, Wolfskin and Villager)"; Serenes › Avatar Creation lists the 17 options).
// Nohr Prince(ss) is Corrin's own class, not a talent. Monk/Shrine Maiden are the only gendered
// pair (Fire Emblem Wiki › Avatar: "the only exceptions are the Monk and Shrine Maiden classes").
const TALENT_EXCLUDED = new Set(['Nohr Prince', 'Nohr Princess', 'Songstress', 'Villager', 'Wolfskin', 'Kitsune'])
const TALENT_GENDER: Record<string, 'male' | 'female'> = { Monk: 'male', 'Shrine Maiden': 'female' }

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

/** Skills this unit's children on the roster plan to inherit from it, with the children who chose each. */
export function skillsChildrenInherit(dataset: Dataset, run: RunPlan, parentId: string): Map<number, UnitDef[]> {
  const picks = new Map<number, UnitDef[]>()
  const add = (skillId: number | undefined, child: UnitDef) => {
    if (skillId === undefined) return
    picks.set(skillId, [...(picks.get(skillId) ?? []), child])
  }
  for (const child of armyUnits(dataset, run)) {
    if (child.fixedParent === null) continue
    const ctx = unitContext(dataset, run, child.id)
    if (!ctx) continue
    if (child.fixedParent === parentId) add(ctx.plan.inheritFixedSkill, child)
    if (ctx.variableParent?.id === parentId) add(ctx.plan.inheritSkill, child)
  }
  return picks
}
