import type { Dataset, Route, UnitDef } from '../data/types'
import type { ClassPoolEntry } from './classes'

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
      const label = prefix ? `${base}${classDef.name} Lv ${level}` : `${classDef.name} Lv ${level}`
      push({ skillId, source, label, classId: classDef.id, level })
    })
  }

  return result
}
