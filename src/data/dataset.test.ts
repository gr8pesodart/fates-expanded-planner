import { beforeAll, describe, expect, it } from 'vitest'
import { loadDataset } from './loader'
import type { Dataset, UnitDef } from './types'
import { datasetStats } from './types'

let dataset: Dataset

function unit(name: string): UnitDef {
  const found = dataset.units.find((u) => u.name === name)
  if (!found) throw new Error(`unit ${name} not in pack`)
  return found
}

function edge(a: string, b: string) {
  const left = unit(a).id
  const right = unit(b).id
  const found = dataset.edges.find(
    (e) => (e.a === left && e.b === right) || (e.a === right && e.b === left),
  )
  if (!found) throw new Error(`edge ${a} x ${b} not in pack`)
  return found
}

beforeAll(async () => {
  dataset = await loadDataset('ugf-2.5.2')
})

describe('ugf-2.5.2 pack', () => {
  it('loads the expected table sizes', () => {
    expect(datasetStats(dataset)).toMatchObject({
      characters: 71,
      edges: 2463,
      units: 71,
      classes: 135,
      skills: 229,
    })
  })

  it('pins Ryoma growths 50/45/0/50/45/40/35/25', () => {
    expect(unit('Ryoma').growths).toEqual([50, 45, 0, 50, 45, 40, 35, 25])
  })

  it('pins Gunter growths 15/5/0/5/0/15/5/5', () => {
    expect(unit('Gunter').growths).toEqual([15, 5, 0, 5, 0, 15, 5, 5])
  })

  it('pins Shiro growths 50/50/0/40/35/35/45/30', () => {
    expect(unit('Shiro').growths).toEqual([50, 50, 0, 40, 35, 35, 45, 30])
  })

  it('keeps sibling supports platonic (Ryoma x Hinoka, S locked)', () => {
    const info = edge('Ryoma', 'Hinoka').info
    expect(info.kind).toBe('platonic')
    expect(info.ranks.s).toBeNull()
    expect(info.ranks.a).toBe(12)
  })

  it('keeps Corrin supports fast (Corrin x Ryoma 3/7/12/18)', () => {
    const corrin = dataset.units.find((u) => u.isCorrin)
    expect(corrin).toBeDefined()
    const info = edge(corrin!.name, 'Ryoma').info
    expect(info.fast).toBe(true)
    expect(info.kind).toBe('romantic')
    expect(info.ranks).toEqual({ c: 3, b: 7, a: 12, s: 18 })
  })

  it('marks second-gen units with their fixed parent', () => {
    expect(unit('Shiro').fixedParent).toBe(unit('Ryoma').id)
  })

  it('decodes route availability from the support-route byte', () => {
    expect(unit('Ryoma').routes).toEqual(['birthright', 'revelation'])
    expect(unit('Gunter').routes).toEqual(['conquest', 'revelation'])
    expect(unit('Izana').routes).toEqual(['birthright', 'conquest'])
    expect(unit('Fuga').routes).toEqual(['revelation'])
    expect(unit('Yukimura').routes).toEqual(['birthright'])
    expect(unit('Anna').routes).toEqual(['birthright', 'conquest', 'revelation'])
  })

  it('flags the eight DLC class families and Anna', () => {
    const dlc = dataset.classes.filter((c) => c.dlc).map((c) => c.name)
    expect(dlc).toHaveLength(16)
    for (const name of [
      'Dread Fighter (M)',
      'Dread Fighter (F)',
      'Dark Falcon (M)',
      'Dark Falcon (F)',
      'Ballistician',
      'Witch',
      'Lodestar',
      'Vanguard',
      'Great Lord',
      'Grandmaster',
      'Ballistician (F)',
      'Great Lord (M)',
      'Witch (M)',
      'Lodestar (F)',
      'Vanguard (F)',
      'Grandmaster (F)',
    ]) {
      expect(dlc).toContain(name)
    }
    expect(dataset.classes.find((c) => c.name === 'Samurai (M)')?.dlc).toBe(false)
    expect(unit('Anna').dlc).toBe(true)
    expect(unit('Ryoma').dlc).toBe(false)
  })

  it('pins class skill learn levels (Dread Fighter 1/10/25/35)', () => {
    const dread = dataset.classes.find((c) => c.name === 'Dread Fighter (M)')
    expect(dread?.skillLearn).toEqual([
      { id: 128, level: 1 },
      { id: 129, level: 10 },
      { id: 130, level: 25 },
      { id: 131, level: 35 },
    ])
    const samurai = dataset.classes.find((c) => c.name === 'Samurai (M)')
    expect(samurai?.skillLearn).toEqual([
      { id: 57, level: 1 },
      { id: 39, level: 10 },
    ])
  })

  it('carries skill descriptions and DLC flags', () => {
    const byName = new Map(dataset.skillsById)
    const strength = [...byName.values()].find((s) => s.name === 'Strength +2')
    expect(strength?.description).toBe('Grants Str+2.')
    const aggressor = [...byName.values()].find((s) => s.name === 'Aggressor')
    expect(aggressor?.dlc).toBe(true)
    const bushido = [...byName.values()].find((s) => s.name === 'Bushido')
    expect(bushido?.dlc).toBe(false)
  })

  it('pins Ryoma pair-up support bonuses (SF: Spd / Str / Skl / Spd+2)', () => {
    expect(unit('Ryoma').supportBonuses).toEqual([
      [0, 0, 0, 0, 1, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 2, 0, 0, 0],
    ])
  })
})
