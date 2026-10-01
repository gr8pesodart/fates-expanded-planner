import type { Dataset, UnitDef } from '../data/types'
import { edgePartner, supportPartners } from '../data/types'
import type { RunPlan } from '../state/model'
import { corrinBuild } from '../state/model'
import type { UnitContext } from './army'
import { aPlusEligible, armyUnits, classOnRoute, personalSkill, unitContext } from './army'
import type { ClassPoolEntry } from './classes'
import { baseOfClass, classPool, sexedClassId } from './classes'
import { playableClassIds } from './lenses'
import { buildProgression, dlcClassesFor } from './progression'
import { inheritableSkillPool } from './skills'
import { fixedParentIsCorrin } from './stats'

/**
 * Where a skill stands for one unit, in the order the skill picker lists them:
 *  - progression: learned on the planned class path (or already chosen as an inherited skill)
 *  - available:   a class the unit can take now teaches it, but the plan doesn't reach it
 *  - inheritable: only a current parent can pass it on (second generation)
 *  - locked:      needs a relationship the plan doesn't have (S, A+ / A, another parent)
 *  - unavailable: nothing in this run gives it (another route, no partner provides it); DLC classes are
 *                 left out entirely while DLC is off
 */
export type SkillGroup = 'progression' | 'available' | 'inheritable' | 'locked' | 'unavailable'

export const SKILL_GROUP_ORDER: readonly SkillGroup[] = ['progression', 'available', 'inheritable', 'locked', 'unavailable']

/** Picker filters: whether new S / A+ (Corrin: A) relationships count as a way in. */
export interface SkillFilters {
  s: boolean
  a: boolean
}

export const ALL_WAYS: SkillFilters = { s: true, a: true }

/** What a notice needs: the status, the class (and level) and every way in. */
export interface AccessNotice {
  group: SkillGroup
  /** The class that teaches it (for inheritable skills: the parent's class), when known. */
  classId: number | null
  level: number | null
  /** Partners whose Partner Seal / Friendship Seal class would teach it (locked only). */
  viaS: UnitDef[]
  viaA: UnitDef[]
  /** Second parents whose class branch would teach it (locked only). */
  viaParent: UnitDef[]
  /** Only these relationships together teach it (a duplicate branch falls back), locked only. */
  viaCombo: RelationChange[][]
  /** Parents who can pass it on: current parents (inheritable) or other possible ones (locked). */
  inheritFrom: UnitDef[]
}

/** A skill's best status for the unit (the Profile, Progression, and the picker's flat lists). */
export interface SkillAccess extends AccessNotice {
  skillId: number
}

/**
 * A class's own status and ways in, with every skill it teaches — the picker's Grouped view lists
 * each class whole, so a skill several classes teach (Locktouch: Outlaw and Ninja) shows under each.
 */
export interface ClassAccess extends AccessNotice {
  skills: { skillId: number; level: number | null }[]
}

/** One relationship different from the plan: an S partner, an A+ (Corrin: A-rank) partner or a second parent. */
export interface RelationChange {
  role: 's' | 'a' | 'parent'
  unit: UnitDef
}

export interface SkillAccessMap {
  /** Every listed skill, grouped then in class order. */
  list: SkillAccess[]
  byId: Map<number, SkillAccess>
  /** Every class with something to list, grouped then in discovery order (classId null: chosen inherited skills). */
  classes: ClassAccess[]
}

function learnset(dataset: Dataset, classId: number): { id: number; level: number }[] {
  return dataset.classesById.get(classId)?.skillLearn ?? []
}

/** An equipped skill no relationship in this run can give (e.g. after a route change). */
export function unreachableSkill(skillId: number): SkillAccess {
  return { skillId, group: 'unavailable', classId: null, level: null, viaS: [], viaA: [], viaParent: [], viaCombo: [], inheritFrom: [] }
}

// Plans are immutable, so a run object identifies one state: the Profile, Progression and picker
// share one computation per unit per change (Corrin's is the heaviest, ~40ms on desktop).
const cache = new WeakMap<RunPlan, Map<string, SkillAccessMap>>()

export function skillAccess(dataset: Dataset, run: RunPlan, ctx: UnitContext, filters: SkillFilters = ALL_WAYS): SkillAccessMap {
  let perRun = cache.get(run)
  if (!perRun) cache.set(run, (perRun = new Map()))
  const key = `${ctx.unit.id}|${filters.s ? 's' : ''}${filters.a ? 'a' : ''}`
  const cached = perRun.get(key)
  if (cached) return cached
  const result = computeSkillAccess(dataset, run, ctx, filters)
  perRun.set(key, result)
  return result
}

function computeSkillAccess(dataset: Dataset, run: RunPlan, ctx: UnitContext, filters: SkillFilters): SkillAccessMap {
  const byId = new Map<number, SkillAccess>()
  const order: SkillAccess[] = []
  const personal = personalSkill(ctx.unit, run)
  const roster = armyUnits(dataset, run)
  const onRoster = new Set(roster.map((unit) => unit.id))

  const entry = (skillId: number, group: SkillGroup, classId: number | null, level: number | null): SkillAccess | null => {
    if (skillId === personal) return null
    const existing = byId.get(skillId)
    if (existing) return existing.group === group ? existing : null
    const access: SkillAccess = { skillId, group, classId, level, viaS: [], viaA: [], viaParent: [], viaCombo: [], inheritFrom: [] }
    byId.set(skillId, access)
    order.push(access)
    return access
  }
  // Classes keep their own (first, i.e. best) status, whatever their skills' best status is.
  const classes = new Map<string, ClassAccess>()
  const cls = (classId: number | null, group: SkillGroup, skills?: { skillId: number; level: number | null }[]): ClassAccess | null => {
    const key = String(classId ?? 'inherited')
    const existing = classes.get(key)
    if (existing) return existing.group === group ? existing : null
    const own = skills ?? (classId === null ? [] : learnset(dataset, classId).map((item) => ({ skillId: item.id, level: item.level })))
    const record: ClassAccess = { group, classId, level: null, skills: own.filter((item) => item.skillId !== personal), viaS: [], viaA: [], viaParent: [], viaCombo: [], inheritFrom: [] }
    classes.set(key, record)
    return record
  }
  const levelIn = (classId: number, skillId: number) => learnset(dataset, classId).find((item) => item.id === skillId)?.level ?? null

  // 1. On the planned path, plus skills already chosen to inherit.
  const progression = buildProgression(dataset, run, ctx)
  const learned = [...progression.startsWith, ...progression.segments.flatMap((segment) => segment.rows.flatMap((row) => row.learned))]
  for (const item of learned) {
    entry(item.skillId, 'progression', item.classId, levelIn(item.classId, item.skillId))
    cls(item.classId, 'progression')
  }
  for (const skillId of [ctx.plan.inheritFixedSkill, ctx.plan.inheritSkill]) {
    if (skillId === undefined) continue
    entry(skillId, 'progression', null, null)
    const inherited = cls(null, 'progression')
    if (inherited && !inherited.skills.some((item) => item.skillId === skillId)) inherited.skills.push({ skillId, level: null })
  }

  // 2. Classes open to the unit right now.
  const current = [...new Set([ctx.start.classId, ...ctx.pool.map((item) => item.classId), ...(run.dlc ? dlcClassesFor(dataset, ctx.unit.gender).map((def) => def.id) : [])])]
  for (const classId of current) {
    cls(classId, 'available')
    for (const item of learnset(dataset, classId)) entry(item.id, 'available', classId, item.level)
  }

  // 3. Only a current parent can pass it on.
  const fixedParent = ctx.unit.fixedParent ? dataset.unitsById.get(ctx.unit.fixedParent) : undefined
  for (const parent of [fixedParent, ctx.variableParent]) {
    if (!parent) continue
    const parentCtx = unitContext(dataset, run, parent.id)
    if (!parentCtx) continue
    for (const item of inheritableSkillPool(dataset, parent, parentCtx.pool, run.route)) {
      const access = entry(item.skillId, 'inheritable', item.classId ?? null, item.level ?? null)
      if (access && !access.inheritFrom.includes(parent)) access.inheritFrom.push(parent)
      const record = item.classId === undefined ? null : cls(item.classId, 'inheritable', [])
      if (!record) continue
      if (!record.skills.some((skill) => skill.skillId === item.skillId)) record.skills.push({ skillId: item.skillId, level: item.level ?? null })
      if (!record.inheritFrom.includes(parent)) record.inheritFrom.push(parent)
    }
  }

  // 4. What other relationships would open. Each candidate is tried on top of the current plan;
  // then combinations, because a duplicate branch falls back to the contributor's next class
  // (classes.ts › classPool): Sakura with S Jakob and A+ Elise gets Elise's Wyvern Rider, since
  // both of their first branches are Troubadour. Only combinations whose single gains share a base
  // class can fall back, so only those are evaluated (tools/audit/skillCombos.audit.ts checks this
  // against every combination).
  const options = {
    variableParent: ctx.variableParent,
    sPartner: ctx.sPartner,
    aPlusPartner: ctx.aPlusPartner,
    friendshipDonors: ctx.friendshipPartners,
    corrinTalentClassId: corrinBuild(run).talentClassId,
    fixedParentIsCorrin: fixedParentIsCorrin(dataset, ctx.unit),
  }
  const partners = (kind: 'romantic' | 'a-rank') => supportPartners(dataset, ctx.unit.id, kind)
    .map((edge) => dataset.unitsById.get(edgePartner(edge, ctx.unit.id)))
    .filter((unit): unit is UnitDef => unit !== undefined && onRoster.has(unit.id))

  const candidates: RelationChange[] = [
    ...(filters.s ? partners('romantic') : []).filter((unit) => unit.id !== ctx.sPartner?.id).map((unit) => ({ role: 's' as const, unit })),
    ...(!filters.a ? [] : ctx.unit.isCorrin
      // Corrin's Friendship Seal: any same-gender A-rank partner who isn't Corrin's spouse.
      ? partners('a-rank').filter((unit) => unit.gender === ctx.unit.gender && unit.id !== ctx.sPartner?.id && !ctx.friendshipPartners.includes(unit))
      : roster.filter((unit) => unit.id !== ctx.aPlusPartner?.id && aPlusEligible(dataset, ctx.unit, unit, ctx.sPartner?.id))
    ).map((unit) => ({ role: 'a' as const, unit })),
  ]
  const parentCandidates = fixedParent ? supportPartners(dataset, fixedParent.id, 'romantic')
    .map((edge) => dataset.unitsById.get(edgePartner(edge, fixedParent.id)))
    .filter((unit): unit is UnitDef => unit !== undefined && onRoster.has(unit.id) && unit.id !== ctx.variableParent?.id)
    // Only Corrin can marry into the second generation.
    .filter((unit) => fixedParent.isCorrin || unit.fixedParent === null) : []
  candidates.push(...parentCandidates.map((unit) => ({ role: 'parent' as const, unit })))

  /** Classes the changed relationships' branches give, with all the changes applied at once. */
  const gainedBy = (changes: RelationChange[]): number[] => {
    const next = { ...options, friendshipDonors: [...ctx.friendshipPartners] }
    for (const change of changes) {
      if (change.role === 'parent') next.variableParent = change.unit
      else if (change.role === 's') next.sPartner = change.unit
      else if (ctx.unit.isCorrin) next.friendshipDonors.push(change.unit)
      else next.aPlusPartner = change.unit
    }
    const from = (item: ClassPoolEntry, change: RelationChange) => change.role === 'parent'
      ? item.branch === 'parent' && item.sourceLabel === `Parent: ${change.unit.name}`
      : change.role === 's' ? item.branch === 'seal'
        : item.branch === 'aplus' && (!ctx.unit.isCorrin || item.sourceLabel === `Friendship Seal: ${change.unit.name}`)
    const pool = classPool(dataset, ctx.unit, next)
    return [...new Set(pool.filter((item) => classOnRoute(dataset, item.classId, run.route) && changes.some((change) => from(item, change))).map((item) => item.classId))]
  }
  const bases = (classIds: number[]) => new Set(classIds.map((classId) => baseOfClass(dataset, classId)))
  const overlaps = (a: Set<number>, b: Set<number>) => [...a].some((id) => b.has(id))
  const LIST: Record<RelationChange['role'], 'viaS' | 'viaA' | 'viaParent'> = { s: 'viaS', a: 'viaA', parent: 'viaParent' }

  const singles = candidates.map((change) => {
    const classIds = gainedBy([change])
    for (const classId of classIds) {
      const record = cls(classId, 'locked')
      if (record && !record[LIST[change.role]].includes(change.unit)) record[LIST[change.role]].push(change.unit)
      for (const item of learnset(dataset, classId)) {
        const access = entry(item.id, 'locked', classId, item.level)
        if (access && !access[LIST[change.role]].includes(change.unit)) access[LIST[change.role]].push(change.unit)
      }
    }
    return { change, bases: bases(classIds) }
  })

  // A combination can't hold two of one relationship — except Corrin's several A-rank partners —
  // and an A+ partner can't also be the S partner.
  const compatible = (changes: RelationChange[]) => changes.every((change, index) => changes.slice(index + 1).every((other) =>
    (change.role !== other.role || (change.role === 'a' && ctx.unit.isCorrin)) && change.unit.id !== other.unit.id))
  // Only minimal combinations are kept: Corrin's Archer via A Midori & A Mozu (Mozu's Villager can't
  // be sealed, so she gives Apothecary, which Midori already gives) shouldn't also list S Kaze & A
  // Midori & A Mozu, where Kaze adds nothing.
  const within = (small: RelationChange[], large: RelationChange[]) => small.every((change) => large.some((other) => other.role === change.role && other.unit === change.unit))
  const viaSingle = (record: AccessNotice) => record.viaS.length + record.viaA.length + record.viaParent.length > 0
  const combine = (changes: RelationChange[]) => {
    const classIds = gainedBy(changes)
    for (const classId of classIds) {
      const record = cls(classId, 'locked')
      if (record && !viaSingle(record) && !record.viaCombo.some((combo) => within(combo, changes))) {
        record.viaCombo = [...record.viaCombo.filter((combo) => !within(changes, combo)), changes]
      }
      for (const item of learnset(dataset, classId)) {
        if (byId.has(item.id) && !byId.get(item.id)!.viaCombo.length) continue
        const access = entry(item.id, 'locked', classId, item.level)
        if (!access || access.viaCombo.some((combo) => within(combo, changes))) continue
        access.viaCombo = [...access.viaCombo.filter((combo) => !within(changes, combo)), changes]
      }
    }
    return bases(classIds)
  }
  for (let i = 0; i < singles.length; i += 1) {
    for (let j = i + 1; j < singles.length; j += 1) {
      const pair = [singles[i].change, singles[j].change]
      if (!compatible(pair) || !overlaps(singles[i].bases, singles[j].bases)) continue
      const pairBases = combine(pair)
      // A third relationship can only fall back against what the pair now holds.
      for (const third of singles) {
        const triple = [...pair, third.change]
        if (third === singles[i] || third === singles[j] || !compatible(triple) || !overlaps(third.bases, pairBases)) continue
        combine(triple)
      }
    }
  }

  // What other possible second parents could pass on.
  for (const parent of parentCandidates) {
    const parentCtx = unitContext(dataset, run, parent.id)
    if (!parentCtx) continue
    for (const item of inheritableSkillPool(dataset, parent, parentCtx.pool, run.route)) {
      const access = entry(item.skillId, 'locked', item.classId ?? null, item.level ?? null)
      if (access && !access.inheritFrom.includes(parent)) access.inheritFrom.push(parent)
      const record = item.classId === undefined ? null : cls(item.classId, 'locked')
      if (record && !record.inheritFrom.includes(parent)) record.inheritFrom.push(parent)
    }
  }

  // 5. Everything else no relationship in this run gives, by the class that would teach it. With DLC
  // off, DLC classes aren't part of the run at all, so they aren't listed.
  for (const id of playableClassIds(dataset)) {
    const classId = sexedClassId(dataset, id, ctx.unit.gender)
    const def = dataset.classesById.get(classId)
    if (!def || (def.dlc && !run.dlc)) continue
    cls(classId, 'unavailable')
    for (const item of learnset(dataset, classId)) entry(item.id, 'unavailable', classId, item.level)
  }

  const list = SKILL_GROUP_ORDER.flatMap((group) => order.filter((item) => item.group === group))
  const classList = SKILL_GROUP_ORDER.flatMap((group) => [...classes.values()].filter((record) => record.group === group && record.skills.length))
  return { list, byId, classes: classList }
}
