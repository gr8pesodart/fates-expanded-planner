import type { SkillView } from '../components/SkillCard'
import type { Dataset } from '../data/types'
import { hasUnisexDlcClasses } from '../data/modProfiles'
import type { UnitContext } from '../logic/army'
import { displayName } from '../logic/army'
import { classFamily } from '../logic/classes'
import { dlcClassesFor } from '../logic/progression'
import type { SkillAccess } from '../logic/skillAccess'
import { conflictingSkills, isExclusiveSkill } from '../logic/skills'
import type { RunPlan } from '../state/model'

export function skillView(dataset: Dataset, id: number | null | undefined): SkillView | null {
  if (id === null || id === undefined) return null
  const skill = dataset.skillsById.get(id)
  return skill ? { id, name: skill.name, description: skill.description } : null
}

export function sealGain(ctx: UnitContext, dataset: Dataset, branch: 'seal' | 'aplus'): string | null {
  const entry = ctx.pool.find((item) => item.branch === branch)
  const def = entry ? dataset.classesById.get(entry.classId) : undefined
  return def ? classFamily(def.name) : null
}

export function unitClassIds(dataset: Dataset, ctx: UnitContext, run: RunPlan): number[] {
  const ids = [...new Set(ctx.pool.map((entry) => entry.classId))]
  if (!ids.includes(ctx.start.classId)) ids.unshift(ctx.start.classId)
  if (run.dlc) for (const def of dlcClassesFor(dataset, ctx.unit.gender, hasUnisexDlcClasses(run))) if (!ids.includes(def.id)) ids.push(def.id)
  return ids
}

/** The card's accent tag: where the skill is learned ("Swordmaster Lv 5"), or who passes it on. */
export function acquiredVia(dataset: Dataset, run: RunPlan, ctx: UnitContext, access: SkillAccess, withClass = true): string | null {
  if (access.classId !== null) {
    const def = dataset.classesById.get(access.classId)
    const level = access.level !== null ? `Lv ${access.level}` : null
    return [withClass && def ? classFamily(def.name) : null, level].filter(Boolean).join(' ') || null
  }
  if (access.book) return 'Skill book'
  if (access.group !== 'progression') return null
  const fixedParent = ctx.unit.fixedParent ? dataset.unitsById.get(ctx.unit.fixedParent) : undefined
  const parent = ctx.plan.inheritFixedSkill === access.skillId ? fixedParent : ctx.variableParent
  return parent ? `Inherited from ${displayName(parent, run)}` : 'Inherited'
}

/** The Taker rule: a muted reminder on every stat Taker, and the equipped ones it clashes with. */
export function skillRules(dataset: Dataset, skillId: number, equipped: readonly (number | null | undefined)[]): { caution: string | null; conflicts: string[] } {
  if (!isExclusiveSkill(dataset, skillId)) return { caution: null, conflicts: [] }
  return {
    caution: "Can't be used with another Taker",
    conflicts: conflictingSkills(dataset, skillId, equipped).map((id) => dataset.skillsById.get(id)?.name ?? '?'),
  }
}
