import { beforeAll, describe, expect, it } from 'vitest'
import { candidatesFor, recruitIndex } from '../app/selectors'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import { emptyRun } from '../state/model'
import type { RunPlan } from '../state/model'
import { classStart, unitContext } from './army'
import { classFamily } from './classes'
import { setBond, toggleFriendshipPartner } from './relationships'

let dataset: Dataset

beforeAll(async () => {
  dataset = await loadDataset('ugf-2.5.2')
})

describe('Corrin support and child classes', () => {
  const makeRun = (): RunPlan => {
    const talentClassId = dataset.classes.find((item) => item.name === 'Samurai (F)')!.id
    return {
      ...emptyRun('test'),
      route: 'revelation' as const,
      corrin: { ...emptyRun('test').corrin, gender: 'female' as const, talentClassId },
    }
  }

  it('grants Friendship Seal branches only from the A-rank partners Corrin plans to reach', () => {
    let run = makeRun()
    const corrin = dataset.units.find((unit) => unit.isCorrin && unit.gender === 'female')!
    const donors = (plan: RunPlan) => unitContext(dataset, plan, corrin.id)!.pool
      .filter((entry) => entry.branch === 'aplus').map((entry) => entry.sourceLabel)
    expect(donors(run)).toEqual([])
    const [first, second] = candidatesFor(dataset, run, corrin.id, 'a')
    const male = dataset.units.find((unit) => unit.gender === 'male' && !unit.isCorrin)!
    run = toggleFriendshipPartner(run, corrin.id, first.unit.id)
    run = toggleFriendshipPartner(run, corrin.id, second.unit.id)
    run = toggleFriendshipPartner(run, corrin.id, male.id)
    const ctx = unitContext(dataset, run, corrin.id)!
    expect(ctx.friendshipPartners.map((unit) => unit.id)).toEqual([first.unit.id, second.unit.id])
    expect(donors(run).some((label) => label.includes(first.unit.name))).toBe(true)
    run = toggleFriendshipPartner(run, corrin.id, first.unit.id)
    expect(unitContext(dataset, run, corrin.id)!.friendshipPartners.map((unit) => unit.id)).toEqual([second.unit.id])
    expect(unitContext(dataset, toggleFriendshipPartner(run, corrin.id, null), corrin.id)!.friendshipPartners).toEqual([])
  })

  it('passes Corrin\'s selected talent branch to Kana', () => {
    const run = makeRun()
    const corrin = dataset.units.find((unit) => unit.isCorrin && unit.gender === 'female')!
    const kana = dataset.units.find((unit) => unit.fixedParent === corrin.id)!
    const ctx = unitContext(dataset, run, kana.id)!
    const talentFamily = classFamily(dataset.classesById.get(run.corrin.talentClassId!)!.name)
    expect(ctx.pool.some((entry) => entry.branch === 'parent' && classFamily(dataset.classesById.get(entry.classId)!.name) === talentFamily)).toBe(true)
  })

  it('recruits the opposite-gender retainer in Chapter 6 and the other after Chapter 15 at Lv 13', () => {
    const felicia = dataset.units.find((unit) => unit.name === 'Felicia')!
    const jakob = dataset.units.find((unit) => unit.name === 'Jakob')!
    const gunter = dataset.units.find((unit) => unit.name === 'Gunter')!
    for (const [gender, early, late] of [['male', felicia, jakob], ['female', jakob, felicia]] as const) {
      const run: RunPlan = { ...emptyRun('test'), route: 'conquest', corrin: { ...emptyRun('test').corrin, gender } }
      expect(recruitIndex(dataset, run, early)).toBeLessThan(recruitIndex(dataset, run, gunter))
      expect(recruitIndex(dataset, run, late)).toBeGreaterThan(recruitIndex(dataset, run, gunter))
      expect(classStart(dataset, run, late)).toMatchObject({ level: 13, chapter: 'After Chapter 15', variableLevel: false })
      expect(classStart(dataset, run, early)).toMatchObject({ level: 1, chapter: 'Chapter 6' })
    }
  })

  it('keeps each route\'s Noble off the other route for everyone, children included', () => {
    const corrin = dataset.units.find((unit) => unit.isCorrin && unit.gender === 'female')!
    const kana = dataset.units.find((unit) => unit.fixedParent === corrin.id)!
    const families = (route: RunPlan['route']) => unitContext(dataset, { ...makeRun(), route }, kana.id)!.pool
      .map((entry) => classFamily(dataset.classesById.get(entry.classId)!.name))
    expect(families('conquest')).toContain('Nohr Noble')
    expect(families('conquest')).not.toContain('Hoshido Noble')
    expect(families('birthright')).toContain('Hoshido Noble')
    expect(families('birthright')).not.toContain('Nohr Noble')
    expect(families('revelation')).toEqual(expect.arrayContaining(['Nohr Noble', 'Hoshido Noble']))
  })

  it('passes the Nohr Prince tree, not the talent, when Corrin is the variable parent', () => {
    const talentClassId = dataset.classes.find((item) => item.name === 'Samurai (M)')!.id
    let run: RunPlan = { ...emptyRun('test'), route: 'revelation', corrin: { ...emptyRun('test').corrin, gender: 'male', talentClassId } }
    const corrin = dataset.units.find((unit) => unit.isCorrin && unit.gender === 'male')!
    const azura = dataset.units.find((unit) => unit.name === 'Azura')!
    const shigure = dataset.units.find((unit) => unit.fixedParent === azura.id)!
    run = setBond(run, azura.id, 'sPartner', corrin.id)
    const inherited = unitContext(dataset, run, shigure.id)!.pool
      .filter((entry) => entry.branch === 'parent' && entry.sourceLabel.includes(corrin.name))
      .map((entry) => classFamily(dataset.classesById.get(entry.classId)!.name))
    expect(inherited).toContain('Nohr Prince')
    expect(inherited).not.toContain('Samurai')
  })

  it('gives Corrin the secondary class of a Kitsune/Wolfskin A-rank partner (Serenes Forest › Class Changing)', () => {
    const talentClassId = dataset.classes.find((item) => item.name === 'Samurai (M)')!.id
    const base: RunPlan = { ...emptyRun('test'), route: 'revelation', corrin: { ...emptyRun('test').corrin, gender: 'male', talentClassId } }
    const corrin = dataset.units.find((unit) => unit.isCorrin && unit.gender === 'male')!
    for (const [name, expected] of [['Kaden', 'Diviner'], ['Keaton', 'Fighter']] as const) {
      const donor = dataset.units.find((unit) => unit.name === name)!
      const run = toggleFriendshipPartner(base, corrin.id, donor.id)
      const gained = unitContext(dataset, run, corrin.id)!.pool
        .filter((entry) => entry.branch === 'aplus').map((entry) => classFamily(dataset.classesById.get(entry.classId)!.name))
      expect(gained[0]).toBe(expected)
    }
  })

  it('lists Corrin\'s S choices in route recruit order', () => {
    const run = makeRun()
    const corrin = dataset.units.find((unit) => unit.isCorrin && unit.gender === 'female')!
    const choices = candidatesFor(dataset, run, corrin.id, 's')
    const isChild = choices.map((choice) => choice.unit.fixedParent !== null)
    expect(isChild.some(Boolean)).toBe(true)
    expect(isChild).toEqual([...isChild].sort((a, b) => Number(a) - Number(b)))
    for (const group of [false, true]) {
      const positions = choices.filter((_, index) => isChild[index] === group).map((choice) => recruitIndex(dataset, run, choice.unit))
      expect(positions).toEqual([...positions].sort((a, b) => a - b))
    }
  })

  it('offers Corrin Friendship Seal options only for same-gender A-rank partners', () => {
    const run = makeRun()
    const corrin = dataset.units.find((unit) => unit.isCorrin && unit.gender === 'female')!
    const choices = candidatesFor(dataset, run, corrin.id, 'a')
    expect(choices.length).toBeGreaterThan(0)
    expect(choices.every((choice) => choice.unit.gender === corrin.gender)).toBe(true)
  })

  it('offers A+ to same-gender pairs with an open 4th rank, not siblings', () => {
    const run = makeRun()
    const byName = (name: string) => dataset.units.find((unit) => unit.name === name)!
    const names = (name: string) => candidatesFor(dataset, run, byName(name).id, 'a').map((choice) => choice.unit.name)
    expect(names('Odin')).toEqual(expect.arrayContaining(['Niles', 'Laslow', 'Xander']))
    expect(names('Soleil')).toEqual(expect.arrayContaining(['Velouria', 'Ophelia']))
    expect(names('Leo')).not.toContain('Xander')
    expect(names('Ryoma')).not.toContain('Takumi')
    for (const name of ['Odin', 'Soleil', 'Elise', 'Ryoma']) {
      const unit = byName(name)
      const choices = candidatesFor(dataset, run, unit.id, 'a')
      expect(choices.every((choice) => choice.unit.gender === unit.gender && !choice.unit.isCorrin)).toBe(true)
    }
  })

  it('never offers or honours the S partner as A+', () => {
    const odin = dataset.units.find((unit) => unit.name === 'Odin')!
    const niles = dataset.units.find((unit) => unit.name === 'Niles')!
    let run = setBond(makeRun(), odin.id, 'aPlusPartner', niles.id)
    expect(unitContext(dataset, run, odin.id)!.aPlusPartner?.id).toBe(niles.id)
    run = setBond(run, odin.id, 'sPartner', niles.id)
    expect(candidatesFor(dataset, run, odin.id, 'a').some((choice) => choice.unit.id === niles.id)).toBe(false)
    expect(unitContext(dataset, run, odin.id)!.aPlusPartner).toBeUndefined()
  })

  it('only shares A+ ranks within a generation (owner rule)', () => {
    const run = makeRun()
    const ryoma = dataset.units.find((unit) => unit.name === 'Ryoma')!
    const shiro = dataset.units.find((unit) => unit.fixedParent === ryoma.id)!
    const firstGen = candidatesFor(dataset, run, ryoma.id, 'a')
    const children = candidatesFor(dataset, run, shiro.id, 'a')
    expect(firstGen.length).toBeGreaterThan(0)
    expect(children.length).toBeGreaterThan(0)
    expect(firstGen.every((choice) => choice.unit.fixedParent === null)).toBe(true)
    expect(children.every((choice) => choice.unit.fixedParent !== null)).toBe(true)
    const stale = setBond(run, ryoma.id, 'aPlusPartner', shiro.id)
    const ctx = unitContext(dataset, stale, ryoma.id)!
    expect(ctx.aPlusPartner).toBeUndefined()
    expect(ctx.pool.some((entry) => entry.branch === 'aplus')).toBe(false)
  })

  it('puts current S and A+ partners first in the pair-up picker', () => {
    let run = makeRun()
    const ryoma = dataset.units.find((unit) => unit.name === 'Ryoma')!
    const anna = dataset.units.find((unit) => unit.name === 'Anna')!
    const jakob = dataset.units.find((unit) => unit.name === 'Jakob')!
    run = setBond(run, ryoma.id, 'sPartner', anna.id)
    run = setBond(run, ryoma.id, 'aPlusPartner', jakob.id)
    const choices = candidatesFor(dataset, run, ryoma.id, 'pair')
    expect(choices.slice(0, 2).map((choice) => [choice.unit.id, choice.rankBadge])).toEqual([[anna.id, 'S'], [jakob.id, 'A+']])
  })
})
