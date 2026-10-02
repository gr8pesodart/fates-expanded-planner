import type { Dataset, Route, UnitDef } from '../data/types'
import type { RunPlan } from '../state/model'
import type { ClassStart } from './army'
import { recruitmentOf } from './army'

/**
 * When a second-generation unit can be recruited (owner, v3.4): no earlier than the later of its
 * parents' recruitment chapters - a parent who is a child themselves (Kana's partner) counts by their
 * own earliest chapter - and no earlier than child paralogues unlock (after Chapter 7; Birthright's
 * Paralogue 6, Midori, also needs Chapter 15 - curated recruitment notes, Fire Emblem Wiki).
 * Chapters are main-story positions: a paralogue done between Chapters 18 and 19 is "Chapter 19".
 */

export const FINAL_CHAPTER: Record<Route, number> = { birthright: 28, conquest: 27, revelation: 27 }
const PARALOGUES_OPEN = 8
const MIDORI_BIRTHRIGHT = 15

/** The main-story position a recruitment row stands for ("Chapter 19 or later" -> 19, Prologue -> 0). */
export function chapterNumber(chapter: string): number {
  const numbered = /^Chapter (\d+)/.exec(chapter)
  if (numbered) return Number(numbered[1])
  if (chapter.startsWith('Paralogue')) return PARALOGUES_OPEN
  // Anna's xenologue opens after Chapter 6.
  if (chapter.startsWith('Xenologue')) return 7
  return 0
}

/** The earliest chapter this unit can join: its recruitment row, or for a child the rule above. */
export function earliestChapter(dataset: Dataset, run: RunPlan, unit: UnitDef, variableParent: UnitDef | null, seen = new Set<string>()): number {
  if (unit.fixedParent === null) return chapterNumber(recruitmentOf(dataset, run, unit.id)?.chapter ?? 'Prologue')
  if (seen.has(unit.id)) return PARALOGUES_OPEN
  seen.add(unit.id)
  const parentChapter = (parent: UnitDef | null | undefined) => {
    if (!parent) return 0
    if (parent.fixedParent === null) return chapterNumber(recruitmentOf(dataset, run, parent.id)?.chapter ?? 'Prologue')
    // A child parent's own second parent doesn't matter here: their earliest possible chapter does.
    return earliestChapter(dataset, run, parent, null, seen)
  }
  const fixed = dataset.unitsById.get(unit.fixedParent)
  const floor = run.route === 'birthright' && recruitmentOf(dataset, run, unit.id)?.chapter === 'Paralogue 6' ? MIDORI_BIRTHRIGHT : PARALOGUES_OPEN
  return Math.min(FINAL_CHAPTER[run.route], Math.max(floor, parentChapter(fixed), parentChapter(variableParent)))
}

/**
 * Child join level by story position (Fire Emblem Wiki › Fight or Flight scaling, GameFAQs Conquest
 * board 73313117): Lv 10 to Chapter 11, then 11, 12, 14, 15, 17, 18, and Lv 20 from Chapter 18.
 */
const CHILD_LEVEL: Record<number, number> = { 12: 11, 13: 12, 14: 14, 15: 15, 16: 17, 17: 18 }

export function childJoinLevel(chapter: number): number {
  if (chapter >= 18) return 20
  return CHILD_LEVEL[chapter] ?? 10
}

/**
 * From Chapter 19 a child joins at base Lv 20 carrying an Offspring Seal, which promotes their starting
 * class to advanced Lv 2 per chapter past 18 (Chapter 19: 2 … Chapter 27: 18), fixed at recruitment
 * (Fire Emblem Wiki / Fandom › Offspring Seal; GameFAQs Conquest board 73499249).
 */
export function offspringLevel(chapter: number): number | null {
  return chapter >= 19 ? Math.min(20, 2 * (chapter - 18)) : null
}

/** A child's join state: level and Offspring Seal from the recruitment chapter. */
export function childStart(dataset: Dataset, run: RunPlan, unit: UnitDef, variableParent: UnitDef | null, base: ClassStart): ClassStart {
  const chapter = joinChapter(dataset, run, unit, variableParent)
  const level = childJoinLevel(chapter)
  return {
    ...base,
    level,
    defaultLevel: level,
    variableLevel: false,
    child: { chapter, earliest: earliestChapter(dataset, run, unit, variableParent), final: FINAL_CHAPTER[run.route], offspringLevel: offspringLevel(chapter) },
  }
}

/** The chapter a child joins at: the plan's pick, kept between its earliest chapter and the final one. */
export function joinChapter(dataset: Dataset, run: RunPlan, unit: UnitDef, variableParent: UnitDef | null): number {
  const earliest = earliestChapter(dataset, run, unit, variableParent)
  const picked = run.units[unit.id]?.joinChapter
  return picked === undefined ? earliest : Math.min(FINAL_CHAPTER[run.route], Math.max(earliest, Math.round(picked)))
}
