import type { SkillView } from '../components/SkillCard'
import type { Dataset } from '../data/types'
import type { UnitContext } from '../logic/army'
import { classFamily } from '../logic/classes'
import { dlcClassesFor } from '../logic/progression'

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

export function unitClassIds(dataset: Dataset, ctx: UnitContext, dlc: boolean): number[] {
  const ids = [...new Set(ctx.pool.map((entry) => entry.classId))]
  if (!ids.includes(ctx.start.classId)) ids.unshift(ctx.start.classId)
  if (dlc) for (const def of dlcClassesFor(dataset, ctx.unit.gender)) if (!ids.includes(def.id)) ids.push(def.id)
  return ids
}
