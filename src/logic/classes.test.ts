import { beforeAll, describe, expect, it } from 'vitest'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import { classFamily, classPool, sexedClassId } from './classes'

let dataset: Dataset

beforeAll(async () => {
  dataset = await loadDataset('ugf-2.5.2')
})

const id = (name: string) => dataset.classes.find((item) => item.name === name)!.id
const name = (classId: number) => dataset.classesById.get(classId)!.name
const unit = (name: string) => dataset.units.find((item) => item.name === name)!

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
    const rinkah = unit('Rinkah')
    const azama = unit('Azama')
    const sealed = classPool(dataset, rinkah, { sPartner: azama }).filter((entry) => entry.branch === 'seal').map((entry) => name(entry.classId))
    expect(sealed).toContain('Shrine Maiden')
    expect(sealed).not.toContain('Monk')
    expect(sealed).not.toContain('Great Master')
  })

  it('uses class A sharing priority for Jakob and Silas instead of falling through to Mercenary', () => {
    const pool = classPool(dataset, unit('Jakob'), { aPlusPartner: unit('Silas') })
    expect(pool.some((entry) => classFamily(name(entry.classId)) === 'Cavalier')).toBe(true)
    expect(pool.some((entry) => classFamily(name(entry.classId)) === 'Mercenary')).toBe(false)
  })

  it('keeps Mozu’s alternate Apothecary class hidden while preserving her actual Archer reclass', () => {
    const pool = classPool(dataset, unit('Mozu'))
    expect(pool.some((entry) => classFamily(name(entry.classId)) === 'Archer')).toBe(true)
    expect(pool.some((entry) => classFamily(name(entry.classId)) === 'Apothecary')).toBe(false)
  })

  it('does not treat a promoted class record as another base-class branch', () => {
    const ownNames = (unitName: string) => classPool(dataset, unit(unitName))
      .filter((entry) => entry.branch === 'own')
      .map((entry) => classFamily(name(entry.classId)))

    expect(ownNames('Laslow')).toContain('Mercenary')
    expect(ownNames('Laslow')).toContain('Ninja')
    expect(ownNames('Laslow')).not.toContain('Fighter')
    expect(ownNames('Selena')).toContain('Sky Knight')
    expect(ownNames('Selena')).not.toContain('Outlaw')
  })

  it('inherits Shigure classes father-first and reaches Wyvern Rider through Azura alternate B', () => {
    const pool = classPool(dataset, unit('Shigure'), { variableParent: unit('Jakob') })
    expect(pool.some((entry) => entry.branch === 'parent' && entry.sourceLabel === 'Parent: Jakob' && classFamily(name(entry.classId)) === 'Troubadour')).toBe(true)
    expect(pool.some((entry) => entry.branch === 'parent' && entry.sourceLabel === 'Parent: Azura' && classFamily(name(entry.classId)) === 'Wyvern Rider')).toBe(true)
  })

  it('passes Nyx’s alternate Dark Mage class to Nina after Niles supplies Dark Mage', () => {
    const pool = classPool(dataset, unit('Nina'), { variableParent: unit('Nyx') })
    expect(pool.some((entry) => entry.branch === 'parent' && entry.sourceLabel === 'Parent: Niles' && classFamily(name(entry.classId)) === 'Dark Mage')).toBe(true)
    expect(pool.some((entry) => entry.branch === 'parent' && entry.sourceLabel === 'Parent: Nyx' && classFamily(name(entry.classId)) === 'Diviner')).toBe(true)
  })

  it('follows alternate A when an A+ partner has a unique class A and the next class duplicates the recipient', () => {
    const pool = classPool(dataset, unit('Hinoka'), { aPlusPartner: unit('Azura') })
    expect(pool.some((entry) => entry.branch === 'aplus' && classFamily(name(entry.classId)) === 'Troubadour')).toBe(true)
    expect(pool.some((entry) => entry.branch === 'aplus' && classFamily(name(entry.classId)) === 'Wyvern Rider')).toBe(false)
  })

  it('uses Corrin’s talent alternate B when her class B matches the recipient’s class A', () => {
    const corrin = dataset.units.find((item) => item.isCorrin && item.gender === 'female')!
    const pool = classPool(dataset, unit('Silas'), {
      sPartner: corrin,
      corrinTalentClassId: id('Cavalier (F)'),
    })
    expect(pool.some((entry) => entry.branch === 'seal' && classFamily(name(entry.classId)) === 'Ninja')).toBe(true)
  })
})
