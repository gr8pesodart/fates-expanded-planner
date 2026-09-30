import { beforeAll, describe, expect, it } from 'vitest'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import { emptyRun } from '../state/model'
import { unitContext } from './army'
import { colourReferenceClassIds, formatCell, lensRow } from './lenses'

let dataset: Dataset

beforeAll(async () => {
  dataset = await loadDataset('ugf-2.5.2')
})

const RYOMA = 'PID_リョウマ'

describe('lenses', () => {
  it('blanks HP where the stat has no value', () => {
    const run = { ...emptyRun('t'), route: 'birthright' as const }
    const ctx = unitContext(dataset, run, RYOMA)!
    expect(lensRow(dataset, run, ctx, 'statModifiers')[0]).toBeNull()
    expect(lensRow(dataset, run, ctx, 'classPairUp')[0]).toBeNull()
    expect(lensRow(dataset, run, ctx, 'personalGrowths')).toEqual([50, 45, 0, 50, 45, 40, 35, 25, null])
    expect(lensRow(dataset, run, ctx, 'baseStats')[8]).toBe(dataset.classesById.get(ctx.currentClassId)?.movement)
  })

  it('formats signed and blank cells', () => {
    expect(formatCell(null, true)).toBe('-')
    expect(formatCell(2, true)).toBe('+2')
    expect(formatCell(-1, true)).toBe('-1')
    expect(formatCell(12.34, false)).toBe('12.3')
  })

  it("colours class lenses against every playable class of the tier, effective lenses against the unit's own", () => {
    const run = { ...emptyRun('t'), route: 'birthright' as const }
    const ctx = unitContext(dataset, run, RYOMA)!
    const name = (id: number) => dataset.classesById.get(id)!.name
    const swordmaster = dataset.classes.find((def) => def.name === 'Swordmaster (M)')!.id
    const own = [...new Set(ctx.pool.map((entry) => entry.classId))]
    const classWide = colourReferenceClassIds(dataset, run, ctx, 'classGrowths', swordmaster, own).map(name)
    expect(classWide).toContain('Paladin (M)')
    expect(classWide.every((item) => dataset.classes.find((def) => def.name === item)!.tier === 'promoted')).toBe(true)
    expect(classWide).not.toContain('Faceless')
    const effective = colourReferenceClassIds(dataset, run, ctx, 'effectiveGrowths', swordmaster, own)
    expect(effective.every((id) => own.includes(id) && dataset.classesById.get(id)!.tier === 'promoted')).toBe(true)
  })
})
