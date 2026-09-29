import { beforeAll, describe, expect, it } from 'vitest'
import { loadDataset } from '../data/loader'
import type { Dataset, UnitDef } from '../data/types'
import { projectUnit } from './stats'

let dataset: Dataset

function unit(name: string): UnitDef {
  const found = dataset.units.find((u) => u.name === name)
  if (!found) throw new Error(`unit ${name} not in pack`)
  return found
}

beforeAll(async () => {
  dataset = await loadDataset('ugf-2.5.2')
})

describe('projectUnit', () => {
  it('adds personal growths to class growths', () => {
    const ryoma = unit('Ryoma')
    const samurai = dataset.classes.find((c) => c.name === 'Samurai (M)')
    expect(samurai).toBeDefined()
    const projected = projectUnit(dataset, ryoma, samurai!.id)
    expect(projected.growths).toEqual(ryoma.growths.map((v, i) => v + samurai!.growths[i]))
  })

  it('averages child growths with the variable parent (floor)', () => {
    const shiro = unit('Shiro')
    const camilla = unit('Camilla')
    const projected = projectUnit(dataset, shiro, undefined, { variableParentId: camilla.id })
    expect(projected.childAveraged).toBe(true)
    expect(projected.growths).toEqual(
      shiro.growths.map((v, i) => Math.floor((v + camilla.growths[i]) / 2)),
    )
    expect(projected.growths).toEqual([45, 50, 12, 45, 45, 30, 40, 37])
  })

  it('combines cap mods from both parents (+1 for a non-child variable parent)', () => {
    const shiro = unit('Shiro')
    const camilla = unit('Camilla')
    const ryoma = unit('Ryoma')
    const projected = projectUnit(dataset, shiro, undefined, { variableParentId: camilla.id })
    expect(projected.caps[0]).toBe(0)
    for (let i = 1; i < 8; i += 1) {
      expect(projected.caps[i]).toBe(ryoma.capMods[i] + camilla.capMods[i] + 1)
    }
  })

  it('applies Corrin boon/bane to growths', () => {
    const corrin = dataset.units.find((u) => u.isCorrin)
    expect(corrin).toBeDefined()
    const plain = projectUnit(dataset, corrin!, undefined)
    const tuned = projectUnit(dataset, corrin!, undefined, { corrinBoon: 'spd', corrinBane: 'lck' })
    expect(tuned.growths[4]).toBe(plain.growths[4] + 15)
    expect(tuned.growths[5]).toBe(plain.growths[5] + 5 - 20)
    expect(tuned.growths[0]).toBe(plain.growths[0])
  })
})
