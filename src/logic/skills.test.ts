import { beforeAll, describe, expect, it } from 'vitest'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import { emptyRun } from '../state/model'
import { unitContext } from './army'
import { inheritableSkillPool, skillPool } from './skills'

let dataset: Dataset

beforeAll(async () => {
  dataset = await loadDataset('ugf-2.5.2')
})

describe('inheritable skills', () => {
  it('never passes on personal, DLC or Songstress skills', () => {
    const run = emptyRun('test')
    const azura = dataset.units.find((unit) => unit.name === 'Azura')!
    const ctx = unitContext(dataset, run, azura.id)!
    const names = (entries: { skillId: number }[]) => entries.map((entry) => dataset.skillsById.get(entry.skillId)?.name)
    const learnable = skillPool(dataset, azura, ctx.pool, run.route)
    const inheritable = inheritableSkillPool(dataset, azura, ctx.pool, run.route)
    expect(names(learnable)).toContain('Inspiring Song')
    expect(names(inheritable)).not.toContain('Inspiring Song')
    expect(inheritable.every((entry) => entry.source !== 'personal')).toBe(true)
    expect(inheritable.every((entry) => !dataset.skillsById.get(entry.skillId)?.dlc)).toBe(true)
    expect(inheritable.length).toBeGreaterThan(0)
  })

  it('keeps Songstress in Azura\'s own class set but never passes it to her child', () => {
    const run = emptyRun('test')
    const azura = dataset.units.find((unit) => unit.name === 'Azura')!
    const shigure = dataset.units.find((unit) => unit.fixedParent === azura.id)!
    const families = (unitId: string) => unitContext(dataset, run, unitId)!.pool.map((entry) => dataset.classesById.get(entry.classId)?.name)
    expect(families(azura.id)).toContain('Songstress')
    expect(families(shigure.id)).not.toContain('Songstress')
  })
})
