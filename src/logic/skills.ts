import type { Dataset, Route, UnitDef } from '../data/types'
import type { ClassPoolEntry } from './classes'
import { classFamily } from './classes'

export type SkillSource = 'personal' | 'class' | 'parent' | 'seal' | 'aplus'

export interface SkillPoolEntry {
  skillId: number
  source: SkillSource
  /** e.g. "Personal", "Swordmaster Lv 5", "S Seal: Azura — Sky Knight Lv 1" */
  label: string
  classId?: number
  level?: number
}

export const MAX_EQUIPPED_SKILLS = 5

/** Levels at which a class's skills are learned, in class-skill order. */
function skillLevels(tier: 'base' | 'promoted' | 'special', index: number): number | null {
  if (tier === 'base') return [1, 10][index] ?? null
  if (tier === 'promoted') return [5, 15][index] ?? null
  return [1, 10, 25, 35][index] ?? null
}

const SOURCE_PREFIX: Record<SkillSource, string> = {
  personal: 'Personal',
  class: '',
  parent: 'Parent',
  seal: 'S Seal',
  aplus: 'A+ Seal',
}

/**
 * Every skill the unit can learn: personal skill (route-aware) plus the
 * learnable skills of every class in their class pool. Seal/parent sources are
 * labelled so the player knows where a skill comes from.
 */
export function skillPool(
  dataset: Dataset,
  unit: UnitDef,
  pool: ClassPoolEntry[],
  route: Route,
): SkillPoolEntry[] {
  const result: SkillPoolEntry[] = []
  const seen = new Set<number>()

  const push = (entry: SkillPoolEntry) => {
    if (seen.has(entry.skillId)) return
    seen.add(entry.skillId)
    result.push(entry)
  }

  const personal =
    unit.personalSkills[route] ??
    unit.personalSkills.revelation ??
    unit.personalSkills.birthright ??
    unit.personalSkills.conquest
  if (personal) {
    push({ skillId: personal, source: 'personal', label: 'Personal' })
  }

  for (const classEntry of pool) {
    const classDef = dataset.classesById.get(classEntry.classId)
    if (!classDef) continue
    const source: SkillSource =
      classEntry.branch === 'seal'
        ? 'seal'
        : classEntry.branch === 'aplus'
          ? 'aplus'
          : classEntry.branch === 'parent'
            ? 'parent'
            : 'class'
    classDef.skills.forEach((skillId, index) => {
      const level = skillLevels(classDef.tier, index)
      if (level === null) return
      const prefix = SOURCE_PREFIX[source]
      const base = classEntry.branch === 'own' ? '' : `${classEntry.sourceLabel} — `
      const label = `${prefix ? base : ''}${classFamily(classDef.name)} Lv ${level}`
      push({ skillId, source, label, classId: classDef.id, level })
    })
  }

  return result
}

// The game's own rule text on every stat Taker (Strengthtaker…Resistancetaker); Lifetaker lacks it.
const TAKER_RULE = "Can't use with other Takers"
const exclusiveSets = new WeakMap<Dataset, number[]>()

function takers(dataset: Dataset): number[] {
  let ids = exclusiveSets.get(dataset)
  if (!ids) {
    ids = [...dataset.skillsById.values()].filter((skill) => skill.description?.replace(/\s+/g, ' ').includes(TAKER_RULE)).map((skill) => skill.id)
    exclusiveSets.set(dataset, ids)
  }
  return ids
}

/** Whether the skill can't be equipped alongside others of its kind (the stat Takers). */
export function isExclusiveSkill(dataset: Dataset, skillId: number): boolean {
  return takers(dataset).includes(skillId)
}

/** The equipped skills `skillId` can't be used with ("Can't use with other Takers."). */
export function conflictingSkills(dataset: Dataset, skillId: number, equipped: readonly (number | null | undefined)[]): number[] {
  if (!isExclusiveSkill(dataset, skillId)) return []
  return [...new Set(equipped.filter((id): id is number => id != null && id !== skillId && isExclusiveSkill(dataset, id)))]
}

/**
 * What a parent can pass to a child. Fates children inherit one skill from each parent: the lowest
 * eligible equipped skill (Fire Emblem Wiki › Inheritance, › Kana). Never inherited: personal
 * skills, DLC skills, and Songstress skills (the class itself is never inherited).
 */
export function inheritableSkillPool(dataset: Dataset, parent: UnitDef, pool: ClassPoolEntry[], route: Route): SkillPoolEntry[] {
  return skillPool(dataset, parent, pool, route).filter((entry) => {
    if (entry.source === 'personal' || dataset.skillsById.get(entry.skillId)?.dlc) return false
    const def = entry.classId === undefined ? undefined : dataset.classesById.get(entry.classId)
    return !def || classFamily(def.name) !== 'Songstress'
  })
}
