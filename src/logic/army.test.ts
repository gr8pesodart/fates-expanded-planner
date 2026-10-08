import { beforeAll, describe, expect, it } from 'vitest'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import { talentOptions } from './army'
import { classFamily } from './classes'

let dataset: Dataset

beforeAll(async () => {
  dataset = await loadDataset('ugf-2.5.2')
})

const families = (gender: 'male' | 'female') =>
  talentOptions(dataset, gender).map((id) => classFamily(dataset.classesById.get(id)!.name))

// Serenes Forest › Avatar Creation › Class Options: Cavalier, Knight, Fighter, Mercenary, Outlaw,
// Samurai, Oni Savage, Lancer (Spear Fighter), Diviner, Monk (male), Priestess (female; Shrine
// Maiden), Sky Knight, Archer, Dragon (Wyvern Rider), Ninja, Mage (Dark Mage), Troubadour, Apothecary.
// Serenes › Class Sets: "includes every regular class (excludes Songstress, Kitsune, Wolfskin and
// Villager)". Fire Emblem Wiki › Avatar: Monk/Shrine Maiden are the only gendered options.
const SHARED = [
  'Cavalier', 'Knight', 'Fighter', 'Mercenary', 'Outlaw', 'Samurai', 'Oni Savage', 'Spear Fighter',
  'Diviner', 'Sky Knight', 'Archer', 'Wyvern Rider', 'Ninja', 'Dark Mage', 'Troubadour', 'Apothecary',
]

describe('Corrin talent options', () => {
  it('offers exactly the 17 official talents per gender', () => {
    expect(families('male').slice().sort()).toEqual([...SHARED, 'Monk'].sort())
    expect(families('female').slice().sort()).toEqual([...SHARED, 'Shrine Maiden'].sort())
  })

  it('excludes Corrin\'s own class, Songstress, Villager and the beast classes', () => {
    for (const gender of ['male', 'female'] as const) {
      const list = families(gender)
      expect(list).not.toContain('Nohr Prince')
      expect(list).not.toContain('Nohr Princess')
      expect(list).not.toContain('Songstress')
      expect(list).not.toContain('Villager')
      expect(list).not.toContain('Wolfskin')
      expect(list).not.toContain('Kitsune')
    }
  })

  it('swaps only Monk ↔ Shrine Maiden between genders', () => {
    expect(families('male')).toContain('Monk')
    expect(families('male')).not.toContain('Shrine Maiden')
    expect(families('female')).toContain('Shrine Maiden')
    expect(families('female')).not.toContain('Monk')
    for (const family of SHARED) {
      expect(families('male')).toContain(family)
      expect(families('female')).toContain(family)
    }
  })

  it('returns the class record matching the avatar\'s gender', () => {
    for (const gender of ['male', 'female'] as const) {
      for (const id of talentOptions(dataset, gender)) {
        const name = dataset.classesById.get(id)!.name
        if (classFamily(name) === 'Monk' || classFamily(name) === 'Shrine Maiden') continue
        expect(name.endsWith(gender === 'male' ? '(M)' : '(F)')).toBe(true)
      }
    }
  })
})
