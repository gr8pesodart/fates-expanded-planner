import type { ClassDef, ClassTier, Dataset } from '../data/types'
import type { Reclass, RunPlan } from '../state/model'
import type { UnitContext } from './army'
import { pairRank } from './army'
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
  classId: number
  /** Learned immediately on changing class rather than by levelling. */
  onReclass: boolean
}

export interface LevelRow {
  segment: number
  level: number
  /** Class held while reaching this level. */
  classId: number
  /** Skills in hand at the start of the plan (only the very first row). */
  startsWith: LearnedSkill[]
  learned: LearnedSkill[]
  reclass: number | null
  options: ReclassOption[]
  /** Average stats at this level, after any class change on this row. */
  expected: number[]
  /** Effective growths / pair-up bonuses of the class held after this row. */
  growths: number[]
  pairUp: number[]
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

export function tierCap(tier: ClassTier, eternalSeals = 0): number {
  if (tier === 'base') return BASE_LEVEL_CAP
  const cap = tier === 'special' ? SPECIAL_LEVEL_CAP : BASE_LEVEL_CAP
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
      offer({ classId: sexedClassId(dataset, promo, ctx.unit.gender), seal: 'master', level: 1, newSegment: true })
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

function skillsLearnedBetween(def: ClassDef, fromExclusive: number, toInclusive: number, known: Set<number>, onReclass: boolean): LearnedSkill[] {
  const learned: LearnedSkill[] = []
  for (const entry of def.skillLearn) {
    if (entry.level <= fromExclusive || entry.level > toInclusive || known.has(entry.id)) continue
    known.add(entry.id)
    learned.push({ skillId: entry.id, classId: def.id, onReclass })
  }
  return learned
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

  let classDef = dataset.classesById.get(ctx.start.classId)
  if (!classDef) return { segments: [], dropped: events, eternalSeals }

  const known = new Set<number>()
  const personal = [...ctx.unit.baseStats]
  const clampTo = (def: ClassDef) => {
    const caps = projectUnit(dataset, ctx.unit, def.id, ctx.projection).caps
    for (let i = 0; i < personal.length; i += 1) personal[i] = Math.min(personal[i], caps[i] - def.baseStats[i])
  }
  const snapshot = (def: ClassDef) => ({
    expected: personal.map((value, i) => Math.round((value + def.baseStats[i]) * 10) / 10),
    growths: projectUnit(dataset, ctx.unit, def.id, ctx.projection).growths,
    pairUp: pairUpBonus(def.pairUp, ctx.unit.supportBonuses, rank),
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

    for (; level <= tierCap(classDef.tier, eternalSeals); level += 1) {
      const def: ClassDef = classDef
      let startsWith: LearnedSkill[] = []
      let learned: LearnedSkill[] = []
      if (firstRow) {
        startsWith = skillsLearnedBetween(def, 0, level, known, false)
        firstRow = false
      } else if (!arrivedFromReclass) {
        for (let i = 0; i < personal.length; i += 1) personal[i] += (personalGrowths[i] + def.growths[i]) / 100
        clampTo(def)
        learned = skillsLearnedBetween(def, level - 1, level, known, false)
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
          learned = [...learned, ...skillsLearnedBetween(next, 0, option.level, known, true)]
          classDef = next
        }
      }

      segment.rows.push({ segment: segmentIndex, level, classId: def.id, startsWith, learned, reclass, options, ...snapshot(classDef) })

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

  return { segments, dropped: events.filter((event) => !used.has(event)), eternalSeals }
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
