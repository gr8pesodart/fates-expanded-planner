import type { ClassDef, ClassTier, Dataset } from '../data/types'
import type { Reclass, RunPlan } from '../state/model'
import type { UnitContext } from './army'
import { classOnRoute, pairRank, supportBonusesOf } from './army'
import { pairUpRow } from './lenses'
import type { StatRow } from './lenses'
import { classFamily, sexedClassId } from './classes'
import { pairUpBonus } from './pairUp'
import { projectUnit } from './stats'

export type ReclassSeal = 'master' | 'heart' | 'partner' | 'friendship' | 'dlc'

export interface ReclassOption {
  classId: number
  seal: ReclassSeal
  /** Level in the new class right after the change. */
  level: number
  /** Promotion or a move onto/off the 40-level special track starts a new segment. */
  newSegment: boolean
}

export interface LearnedSkill {
  skillId: number
  /** Class whose learnset supplied the skill (a base class, for skills picked up while advanced). */
  classId: number
}

export interface LevelRow {
  segment: number
  level: number
  /** Class held while reaching this level. */
  classId: number
  /** At most one skill: only recruitment grants several at once (Progression.startsWith). */
  learned: LearnedSkill[]
  reclass: number | null
  options: ReclassOption[]
  /** Average stats at this level, after any class change on this row. */
  expected: number[]
  /** Effective growths / pair-up bonuses of the class held after this row. */
  growths: number[]
  /** Table row: HP blank, Mov last (see lenses › pairUpRow). */
  pairUp: StatRow
}

export interface ProgressionSegment {
  tier: ClassTier
  label: string
  rows: LevelRow[]
}

export interface Progression {
  segments: ProgressionSegment[]
  /** Stored reclasses that no longer fit the path (cleared by the store with a notice). */
  dropped: Reclass[]
  eternalSeals: number
  /** Skills in hand on recruitment. */
  startsWith: LearnedSkill[]
}

export const BASE_LEVEL_CAP = 20
export const MASTER_SEAL_MIN_LEVEL = 10
export const ETERNAL_SEAL_LEVEL_INCREASE = 5
export const SPECIAL_LEVEL_CAP = 40
export const DLC_SEAL_MIN_LEVEL = 10

// Vanilla DLC gender locks; the table carries both variants for some of these but only one is obtainable.
const DLC_GENDER: Record<string, 'male' | 'female'> = {
  'Dread Fighter': 'male',
  'Dark Falcon': 'female',
  Ballistician: 'male',
  Witch: 'female',
  Lodestar: 'male',
  Vanguard: 'male',
  'Great Lord': 'female',
  Grandmaster: 'male',
}

const SEGMENT_LABEL: Record<ClassTier, string> = { base: 'Base', promoted: 'Advanced', special: 'Special' }

/**
 * Level cap of a segment. `unitLevelCap` is the character's own cap (GameData +134): Jakob and
 * Felicia join promoted (Butler / Maid) with a cap of 40 — as if four Eternal Seals were built in.
 */
export function tierCap(tier: ClassTier, eternalSeals = 0, unitLevelCap: number | null = null): number {
  if (tier === 'base') return BASE_LEVEL_CAP
  const cap = tier === 'special' ? SPECIAL_LEVEL_CAP : Math.max(BASE_LEVEL_CAP, unitLevelCap ?? 0)
  return cap + eternalSeals * ETERNAL_SEAL_LEVEL_INCREASE
}

export function dlcClassesFor(dataset: Dataset, gender: 'male' | 'female'): ClassDef[] {
  const seen = new Set<number>()
  const result: ClassDef[] = []
  for (const def of dataset.classes) {
    if (!def.dlc || DLC_GENDER[classFamily(def.name)] !== gender) continue
    const id = sexedClassId(dataset, def.id, gender)
    const sexed = dataset.classesById.get(id)
    if (!sexed || seen.has(id)) continue
    seen.add(id)
    result.push(sexed)
  }
  return result
}

function sealFor(branch: UnitContext['pool'][number]['branch']): ReclassSeal {
  if (branch === 'seal') return 'partner'
  if (branch === 'aplus') return 'friendship'
  return 'heart'
}

export function reclassOptions(
  dataset: Dataset,
  run: RunPlan,
  ctx: UnitContext,
  classId: number,
  level: number,
): ReclassOption[] {
  const current = dataset.classesById.get(classId)
  if (!current) return []
  const options = new Map<number, ReclassOption>()
  const offer = (option: ReclassOption) => {
    if (option.classId !== classId && !options.has(option.classId)) options.set(option.classId, option)
  }

  if (current.tier === 'base' && level >= MASTER_SEAL_MIN_LEVEL) {
    for (const promo of current.promotesTo) {
      const promotedId = sexedClassId(dataset, promo, ctx.unit.gender)
      if (classOnRoute(dataset, promotedId, run.route)) offer({ classId: promotedId, seal: 'master', level: 1, newSegment: true })
    }
  }

  for (const entry of ctx.pool) {
    const target = dataset.classesById.get(entry.classId)
    if (!target || (target.dlc && !run.dlc)) continue
    const seal = sealFor(entry.branch)
    if (current.tier === 'base' && target.tier === 'base') offer({ classId: target.id, seal, level, newSegment: false })
    if (current.tier === 'promoted' && target.tier === 'promoted') offer({ classId: target.id, seal, level, newSegment: false })
    if (current.tier === 'special' && target.tier === 'base' && level <= BASE_LEVEL_CAP) {
      offer({ classId: target.id, seal, level, newSegment: true })
    }
    if (current.tier === 'special' && target.tier === 'promoted' && level > BASE_LEVEL_CAP) {
      offer({ classId: target.id, seal, level: level - BASE_LEVEL_CAP, newSegment: true })
    }
  }

  if (run.dlc) {
    for (const target of dlcClassesFor(dataset, ctx.unit.gender)) {
      if (current.tier === 'base' && level >= DLC_SEAL_MIN_LEVEL) offer({ classId: target.id, seal: 'dlc', level, newSegment: true })
      if (current.tier === 'promoted') offer({ classId: target.id, seal: 'dlc', level: level + BASE_LEVEL_CAP, newSegment: true })
      if (current.tier === 'special') offer({ classId: target.id, seal: 'dlc', level, newSegment: false })
    }
  }

  return [...options.values()]
}

interface SkillCandidate extends LearnedSkill {
  threshold: number
}

/** Skill thresholds compare on one scale: an advanced class's level counts as 20 + level. */
function effectiveLevel(def: ClassDef, level: number): number {
  return def.tier === 'promoted' ? BASE_LEVEL_CAP + level : level
}

/**
 * Skills learnable while in `def`: its own, plus for an advanced class those of every base class in
 * the unit's pool that promotes into it (Fire Emblem Wiki › Reclass: a Hero with Dark Mage access
 * learns Dark Mage and Sorcerer skills as a Sorcerer). Base thresholds (1/10) sit below any advanced
 * level (21+), so pending base skills come first, matching "priority to the earlier skill".
 */
export function skillCandidates(dataset: Dataset, ctx: UnitContext, def: ClassDef): SkillCandidate[] {
  const own = def.skillLearn.map((entry) => ({ skillId: entry.id, classId: def.id, threshold: effectiveLevel(def, entry.level) }))
  if (def.tier !== 'promoted') return own
  const family = classFamily(def.name)
  const bases = new Map<number, ClassDef>()
  for (const id of [ctx.start.classId, ...ctx.pool.map((entry) => entry.classId)]) {
    const base = dataset.classesById.get(id)
    if (base?.tier !== 'base' || bases.has(base.id)) continue
    if (base.promotesTo.some((promo) => classFamily(dataset.classesById.get(promo)?.name ?? '') === family)) bases.set(base.id, base)
  }
  const inherited = [...bases.values()].flatMap((base) => base.skillLearn.map((entry) => ({ skillId: entry.id, classId: base.id, threshold: entry.level })))
  return [...inherited, ...own].sort((a, b) => a.threshold - b.threshold)
}

const learnedFrom = ({ skillId, classId }: SkillCandidate): LearnedSkill => ({ skillId, classId })

/**
 * Fates learns class skills only on level-up, one per level-up, lowest threshold first; a skill whose
 * threshold was already passed (after a reclass) arrives on the next level-up (Serenes Forest › Fates
 * › Class Skills). Reclassing or promoting grants nothing by itself.
 */
function levelUpSkill(candidates: SkillCandidate[], level: number, known: Set<number>): LearnedSkill[] {
  const next = candidates.find((candidate) => candidate.threshold <= level && !known.has(candidate.skillId))
  if (!next) return []
  known.add(next.skillId)
  return [learnedFrom(next)]
}

/**
 * Walks the plan level by level. Each level-up adds (personal + class growth) / 100 to the
 * personal part of every stat; the displayed stat is personal + class base, and the personal
 * part is clamped so displayed stats never exceed the current class's caps.
 */
export function buildProgression(dataset: Dataset, run: RunPlan, ctx: UnitContext): Progression {
  const eternalSeals = ctx.plan.eternalSeals ?? 0
  const events = [...ctx.plan.reclasses].sort((a, b) => a.segment - b.segment || a.level - b.level)
  const used = new Set<Reclass>()
  const personalGrowths = projectUnit(dataset, ctx.unit, undefined, ctx.projection).growths
  const pairPartner = ctx.pairPartner
  const rank = pairPartner ? pairRank(dataset, run, ctx.unit.id, pairPartner.id) : null
  const supportBonuses = supportBonusesOf(dataset, run, ctx)

  let classDef = dataset.classesById.get(ctx.start.classId)
  if (!classDef) return { segments: [], dropped: events, eternalSeals, startsWith: [] }

  const known = new Set<number>()
  const candidateCache = new Map<number, SkillCandidate[]>()
  const candidates = (def: ClassDef) => {
    const cached = candidateCache.get(def.id)
    if (cached) return cached
    const list = skillCandidates(dataset, ctx, def)
    candidateCache.set(def.id, list)
    return list
  }
  // Recruitment is the one moment several skills arrive together.
  const joinClass = classDef
  const startsWith = candidates(joinClass)
    .filter((candidate) => candidate.threshold <= effectiveLevel(joinClass, ctx.start.level) && !known.has(candidate.skillId))
    .map((candidate) => {
      known.add(candidate.skillId)
      return learnedFrom(candidate)
    })
  const personal = [...ctx.unit.baseStats]
  const clampTo = (def: ClassDef) => {
    const caps = projectUnit(dataset, ctx.unit, def.id, ctx.projection).caps
    for (let i = 0; i < personal.length; i += 1) personal[i] = Math.min(personal[i], caps[i] - def.baseStats[i])
  }
  const snapshot = (def: ClassDef) => ({
    expected: personal.map((value, i) => Math.round((value + def.baseStats[i]) * 10) / 10),
    growths: projectUnit(dataset, ctx.unit, def.id, ctx.projection).growths,
    pairUp: pairUpRow(pairUpBonus(def.pairUp, supportBonuses, rank)),
  })

  const segments: ProgressionSegment[] = []
  let level = ctx.start.level
  let firstRow = true
  let arrivedFromReclass = true

  while (classDef && segments.length < 12) {
    const segment: ProgressionSegment = { tier: classDef.tier, label: SEGMENT_LABEL[classDef.tier], rows: [] }
    const segmentIndex = segments.length
    segments.push(segment)
    let changedSegment = false

    for (; level <= tierCap(classDef.tier, eternalSeals, ctx.unit.levelCap); level += 1) {
      const def: ClassDef = classDef
      let learned: LearnedSkill[] = []
      if (firstRow) {
        firstRow = false
      } else if (!arrivedFromReclass) {
        for (let i = 0; i < personal.length; i += 1) personal[i] += (personalGrowths[i] + def.growths[i]) / 100
        clampTo(def)
        learned = levelUpSkill(candidates(def), effectiveLevel(def, level), known)
      }
      arrivedFromReclass = false

      const options = reclassOptions(dataset, run, ctx, def.id, level)
      const event = events.find((item) => item.segment === segmentIndex && item.level === level && !used.has(item))
      const option = event ? options.find((item) => item.classId === event.classId) : undefined
      let reclass: number | null = null
      if (event && option) {
        used.add(event)
        const next = dataset.classesById.get(option.classId)
        if (next) {
          reclass = next.id
          clampTo(next)
          classDef = next
        }
      }

      segment.rows.push({ segment: segmentIndex, level, classId: def.id, learned, reclass, options, ...snapshot(classDef) })

      if (event && option?.newSegment) {
        level = option.level
        arrivedFromReclass = true
        changedSegment = true
        break
      }
      if (event && option) level = option.level
    }
    if (!changedSegment) break
  }

  return { segments, dropped: events.filter((event) => !used.has(event)), eternalSeals, startsWith }
}

/**
 * Average stats at the end of the planned path, plus Mov of the class held there. With no reclasses
 * the path is the join class up to Lv 20 (or 40 on the special track). `base` flags a path that never
 * leaves a base class, which the Roster mutes.
 */
export function expectedFinal(dataset: Dataset, run: RunPlan, ctx: UnitContext): { row: (number | null)[]; base: boolean } {
  const progression = buildProgression(dataset, run, ctx)
  const last = progression.segments.at(-1)?.rows.at(-1)
  const def = dataset.classesById.get(finalClass(progression) ?? ctx.currentClassId)
  if (!last) return { row: Array.from({ length: 9 }, () => null), base: true }
  return { row: [...last.expected, def?.movement ?? null], base: def?.tier === 'base' }
}

export interface RouteStep {
  /** Level at which the class is taken (the join level for the first step). */
  level: number
  classId: number
}

/** The planned path in brief: join class, then each class change that still fits, in order. */
export function routeSteps(progression: Progression, start: { level: number; classId: number }): RouteStep[] {
  const steps: RouteStep[] = [{ level: start.level, classId: start.classId }]
  for (const segment of progression.segments) {
    for (const row of segment.rows) if (row.reclass !== null) steps.push({ level: row.level, classId: row.reclass })
  }
  return steps
}

/** The row's info panel values: expected stats plus effective growths/pair-up after this row. */
export function findRow(progression: Progression, segment: number, level: number): LevelRow | undefined {
  return progression.segments[segment]?.rows.find((row) => row.level === level)
}

/** Final class on the planned path (the class held after the last row). */
export function finalClass(progression: Progression): number | null {
  const lastSegment = progression.segments.at(-1)
  const lastRow = lastSegment?.rows.at(-1)
  return lastRow ? lastRow.reclass ?? lastRow.classId : null
}

/**
 * Set or clear the reclass on one row. Later reclasses are kept when still legal; the rest are
 * reported in `dropped` so the UI can say how many it removed.
 */
export function withReclass(reclasses: Reclass[], segment: number, level: number, classId: number | null): Reclass[] {
  const others = reclasses.filter((item) => !(item.segment === segment && item.level === level))
  return classId === null ? others : [...others, { segment, level, classId }]
}
