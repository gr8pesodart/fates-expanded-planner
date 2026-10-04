import { beforeAll, describe, expect, it } from 'vitest'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import { emptyRun } from '../state/model'
import { supportBonusesOf, unitContext } from './army'
import { colourReferenceClassIds, formatCell, lensRow, pairUpRow } from './lenses'

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
    // DLC classes live on the special track in the data but are coloured with advanced classes.
    const tierOf = (item: string) => dataset.classes.find((def) => def.name === item)!
    expect(classWide.every((item) => tierOf(item).tier === 'promoted' || tierOf(item).dlc)).toBe(true)
    expect(classWide).toContain('Great Lord (M)')
    expect(classWide).not.toContain('Faceless')
    const effective = colourReferenceClassIds(dataset, run, ctx, 'effectiveGrowths', swordmaster, own)
    expect(effective.every((id) => own.includes(id) && (dataset.classesById.get(id)!.tier === 'promoted' || dataset.classesById.get(id)!.dlc))).toBe(true)
  })

  it('reads the first pair-up byte as Mov (Serenes Forest: Paladin +1, Cavalier 0)', () => {
    const run = { ...emptyRun('t'), route: 'conquest' as const }
    const ctx = unitContext(dataset, run, RYOMA)!
    const byName = (name: string) => dataset.classes.find((def) => def.name === name)!
    expect(lensRow(dataset, run, ctx, 'classPairUp', byName('Paladin (M)').id)).toEqual(pairUpRow(byName('Paladin (M)').pairUp))
    expect(lensRow(dataset, run, ctx, 'classPairUp', byName('Paladin (M)').id)).toEqual([null, 2, 0, 0, 0, 0, 2, 2, 1])
    expect(lensRow(dataset, run, ctx, 'classPairUp', byName('Cavalier (M)').id)[8]).toBe(0)
    expect(lensRow(dataset, run, ctx, 'classPairUp', byName('Cavalier (M)').id)[0]).toBeNull()
  })

  it('gives children C/A pair-up rows from the fixed parent and B/S from the variable parent', () => {
    const run = { ...emptyRun('t'), route: 'birthright' as const, units: {} }
    const camilla = dataset.units.find((unit) => unit.name === 'Camilla')!
    const ryoma = dataset.unitsById.get(RYOMA)!
    const shiro = dataset.units.find((unit) => unit.fixedParent === RYOMA)!
    const planned = { ...run, units: { [RYOMA]: { skills: [null, null, null, null, null], reclasses: [], sPartner: camilla.id }, [camilla.id]: { skills: [null, null, null, null, null], reclasses: [], sPartner: RYOMA } } }
    const rows = supportBonusesOf(dataset, planned, unitContext(dataset, planned, shiro.id)!)
    expect(rows).toEqual([ryoma.supportBonuses[0], camilla.supportBonuses[1], ryoma.supportBonuses[2], camilla.supportBonuses[3]])
  })
})
