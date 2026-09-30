import { beforeAll, describe, expect, it } from 'vitest'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import { emptyRun } from '../state/model'
import { unitContext } from './army'
import { lensRow, pairUpRow } from './lenses'
import { compareParents, parentRows } from './parents'

let dataset: Dataset

beforeAll(async () => {
  dataset = await loadDataset('ugf-2.5.2')
})

describe('parent candidates', () => {
  it("shows a parent's own contribution by default: modifiers, growths and their B + S pair-up rows", () => {
    const run = { ...emptyRun('t'), route: 'birthright' as const }
    const ryoma = dataset.units.find((unit) => unit.name === 'Ryoma')!
    const camilla = dataset.units.find((unit) => unit.name === 'Camilla')!
    const shiro = unitContext(dataset, run, dataset.units.find((unit) => unit.fixedParent === ryoma.id)!.id)!
    const camillaCtx = unitContext(dataset, run, camilla.id)!
    const rows = parentRows(dataset, run, shiro, camilla, true)
    expect(rows.modifiers).toEqual(lensRow(dataset, run, camillaCtx, 'statModifiers'))
    expect(rows.growths).toEqual(lensRow(dataset, run, camillaCtx, 'personalGrowths'))
    expect(rows.pairUp).toEqual(pairUpRow(camilla.supportBonuses[1].map((value, index) => value + camilla.supportBonuses[3][index])))
    // The child's resulting values differ (averaged growths, combined modifiers).
    expect(parentRows(dataset, run, shiro, camilla, false).growths).not.toEqual(rows.growths)
  })

  it('sorts by a chosen stat, recruit order breaking ties', () => {
    const rows = (growth: number) => ({ modifiers: [], growths: [null, growth], pairUp: [] })
    const a = { name: 'A', rows: rows(40) }
    const b = { name: 'B', rows: rows(60) }
    expect(compareParents(a, b, { kind: 'growth', column: 1, direction: 'desc' }, -1)).toBeGreaterThan(0)
    expect(compareParents(a, { ...b, rows: rows(40) }, { kind: 'growth', column: 1 }, -1)).toBe(-1)
    expect(compareParents(a, b, { kind: 'name' }, 1)).toBeLessThan(0)
  })
})
