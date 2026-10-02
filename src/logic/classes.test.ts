import { beforeAll, describe, expect, it } from 'vitest'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import { classPool, sexedClassId } from './classes'

let dataset: Dataset

beforeAll(async () => {
  dataset = await loadDataset('ugf-2.5.2')
})

const id = (name: string) => dataset.classes.find((item) => item.name === name)!.id
const name = (classId: number) => dataset.classesById.get(classId)!.name

describe('sexedClassId', () => {
  it('swaps gender-locked classes for their counterpart (Fire Emblem Wiki › Reclass)', () => {
    expect(name(sexedClassId(dataset, id('Monk'), 'female'))).toBe('Shrine Maiden')
    expect(name(sexedClassId(dataset, id('Priestess'), 'male'))).toBe('Great Master')
    expect(name(sexedClassId(dataset, id('Maid'), 'male'))).toBe('Butler')
    expect(name(sexedClassId(dataset, id('Nohr Princess (F)'), 'male'))).toBe('Nohr Prince (M)')
    expect(name(sexedClassId(dataset, id('Sky Knight (M)'), 'female'))).toBe('Sky Knight (F)')
    expect(name(sexedClassId(dataset, id('Samurai (M)'), 'male'))).toBe('Samurai (M)')
    expect(name(sexedClassId(dataset, id('Songstress'), 'male'))).toBe('Songstress')
  })

  it("gives a woman who marries Azama Shrine Maiden, not Monk", () => {
    const rinkah = dataset.units.find((unit) => unit.name === 'Rinkah')!
    const azama = dataset.units.find((unit) => unit.name === 'Azama')!
    const sealed = classPool(dataset, rinkah, { sPartner: azama }).filter((entry) => entry.branch === 'seal').map((entry) => name(entry.classId))
    expect(sealed).toContain('Shrine Maiden')
    expect(sealed).not.toContain('Monk')
    expect(sealed).not.toContain('Great Master')
  })
})
