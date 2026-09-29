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
      classes: 129,
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
})
