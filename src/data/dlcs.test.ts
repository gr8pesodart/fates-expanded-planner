import { beforeAll, describe, expect, it } from 'vitest'
import { bookAvailable, bookItemKey, classItemKey, itemLimit, SKILL_BOOKS } from './itemIcons'
import manifest from './itemIcons.json'
import { CONTENT_DLCS, DEFAULT_DLC_IDS, DLC_CATALOG, FESTIVAL_DLC_IDS, dlcForUnit, itemGrants, unitDlcOn } from './dlcs'
import { loadDataset } from './loader'
import type { Dataset } from './types'

let dataset: Dataset

beforeAll(async () => {
  dataset = await loadDataset('ugf-2.5.2')
})

const classId = (name: string) => dataset.classes.find((item) => item.name === name)!.id
const skillId = (name: string) => [...dataset.skillsById.values()].find((skill) => skill.name === name)!.id
const grants = (id: string) => DLC_CATALOG.find((dlc) => dlc.id === id)!
const keys = (id: string) => Object.keys(grants(id).items ?? {}).sort()
const copies = (id: string) => grants(id).items

describe('DLC catalog', () => {
  it("pins each content map's rewards to the game's item table", () => {
    expect(grants('anna-on-the-run').units).toEqual(['PID_アンナ'])
    expect(keys('anna-on-the-run')).toEqual([])
    expect(copies('before-awakening')).toEqual({ 'class-124': 1, 'class-126': 1 })
    expect(keys('royal-royale')).toEqual([classItemKey(dataset, classId('Dread Fighter (M)')), classItemKey(dataset, classId('Dark Falcon (M)'))].sort())
    expect(copies('royal-royale')).toEqual({ 'class-118': null, 'class-120': null })
    expect(keys('hidden-truths')).toEqual([classItemKey(dataset, classId('Grandmaster'))])
    expect(keys('vanguard-dawn')).toEqual([classItemKey(dataset, classId('Vanguard')), bookItemKey(skillId('Heavy Blade')), bookItemKey(skillId('Veteran Intuition')), bookItemKey(skillId('Aether'))].sort())
    expect(keys('ballistician-blitz')).toEqual([classItemKey(dataset, classId('Ballistician'))])
    expect(copies('annas-gift')).toEqual({ 'class-122': 1, 'class-123': 1 })
    expect(keys('witches-trial')).toEqual([classItemKey(dataset, classId('Witch')), bookItemKey(skillId('Warp'))].sort())
    expect(copies('another-gift-from-anna')).toEqual({ [bookItemKey(skillId('Paragon'))!]: 1 })
    expect(keys('heirs-1')).toEqual([bookItemKey(skillId('Skilltaker')), bookItemKey(skillId('Lucktaker'))].sort())
    expect(keys('heirs-2')).toEqual([bookItemKey(skillId('Magictaker'))])
    expect(keys('heirs-3')).toEqual([bookItemKey(skillId('Strengthtaker'))])
    expect(keys('heirs-4')).toEqual([bookItemKey(skillId('Defensetaker'))])
    expect(keys('heirs-5')).toEqual([bookItemKey(skillId('Speedtaker')), bookItemKey(skillId('Resistancetaker'))].sort())
    expect(keys('lost-in-the-waves')).toEqual([bookItemKey(skillId('Point Blank'))])
    expect(copies('hoshidan-festival')).toEqual({ 'class-126': null })
    expect(copies('nohrian-festival')).toEqual({ 'class-124': null })
  })

  it('keeps the grinding and vanity maps out of planning (no toggles, no grants)', () => {
    const skipped = DLC_CATALOG.filter((dlc) => !dlc.content).map((dlc) => dlc.id).sort()
    expect(skipped).toEqual(['beach-brawl', 'boo-camp', 'ghostly-gold', 'museum-melee'])
    for (const dlc of DLC_CATALOG.filter((item) => !item.content)) {
      expect(dlc.items).toBeUndefined()
      expect(dlc.units).toBeUndefined()
    }
    expect(CONTENT_DLCS.map((dlc) => dlc.id)).not.toContain('boo-camp')
  })

  it('defaults new runs to the NA content maps, without the Japan-only festivals', () => {
    expect(DEFAULT_DLC_IDS).toHaveLength(15)
    expect(DEFAULT_DLC_IDS).not.toContain('nohrian-festival')
    expect(DEFAULT_DLC_IDS).toEqual(CONTENT_DLCS.filter((dlc) => dlc.group !== 'japan').map((dlc) => dlc.id))
    expect(FESTIVAL_DLC_IDS).toEqual(['hoshidan-festival', 'nohrian-festival'])
    for (const id of [...DEFAULT_DLC_IDS, ...FESTIVAL_DLC_IDS]) expect(grants(id).content).toBe(true)
  })

  it('names the map that recruits a unit', () => {
    expect(dlcForUnit('PID_アンナ')).toBe('anna-on-the-run')
    expect(dlcForUnit('PID_リョウマ')).toBeUndefined()
    expect(unitDlcOn({ dlcs: [] }, 'PID_アンナ')).toBe(false)
    expect(unitDlcOn({ dlcs: ['anna-on-the-run'] }, 'PID_アンナ')).toBe(true)
    expect(unitDlcOn({ dlcs: [] }, 'PID_リョウマ')).toBe(true)
  })
})

describe('item limits per run', () => {
  it('follows the maps that are on', () => {
    expect(itemLimit('class-124', { dlcs: [] })).toBe(0)
    expect(itemLimit('class-124')).toBe(1)
    expect(itemLimit('class-124', { dlcs: [...DEFAULT_DLC_IDS] })).toBe(1)
    expect(itemLimit('class-124', { dlcs: [...DEFAULT_DLC_IDS, 'nohrian-festival'] })).toBeNull()
    expect(itemLimit('class-126', { dlcs: [...DEFAULT_DLC_IDS, 'hoshidan-festival'] })).toBeNull()
    expect(itemLimit('class-122', { dlcs: ['annas-gift'] })).toBe(1)
    expect(itemLimit('class-122', { dlcs: ['ballistician-blitz'] })).toBeNull()
    expect(itemLimit('class-122', { dlcs: ['annas-gift', 'ballistician-blitz'] })).toBeNull()
    expect(itemLimit('master')).toBeNull()
  })

  it('matches the manifest limits with every NA content map on', () => {
    const limits = manifest.limits as Record<string, number | undefined>
    for (const key of Object.keys(manifest.items)) {
      expect(itemLimit(key, { dlcs: [...DEFAULT_DLC_IDS] }), key).toBe(limits[key] ?? null)
    }
  })

  it('lifts the brands with the festival maps, like the old Festival of Bonds switch', () => {
    for (const key of manifest.festivalUnlimited) {
      expect(itemLimit(key, { dlcs: [...DEFAULT_DLC_IDS] }), key).toBe(1)
      expect(itemLimit(key, { dlcs: [...DEFAULT_DLC_IDS, ...FESTIVAL_DLC_IDS] }), key).toBeNull()
    }
  })

  it('gates skill books by their map', () => {
    expect(bookAvailable({ dlcs: ['witches-trial'] }, skillId('Warp'))).toBe(true)
    expect(bookAvailable({ dlcs: ['witches-trial'] }, skillId('Skilltaker'))).toBe(false)
    expect(bookAvailable({ dlcs: ['heirs-1'] }, skillId('Skilltaker'))).toBe(true)
    expect(bookAvailable({ dlcs: [] }, skillId('Warp'))).toBe(false)
    for (const name of ['Armor Shield', 'Beast Shield', 'Winged Shield', 'Bold Stance']) {
      expect(SKILL_BOOKS.has(skillId(name))).toBe(false)
    }
    expect(itemGrants('book-139')).toEqual([])
  })
})
