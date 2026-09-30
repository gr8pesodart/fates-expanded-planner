import { beforeAll, describe, expect, it } from 'vitest'
import { candidatesFor } from '../app/selectors'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import { emptyRun } from '../state/model'
import type { RunPlan } from '../state/model'
import { unitContext } from './army'
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

  it('lists Corrin\'s S choices in route recruit order', () => {
    const run = makeRun()
    const corrin = dataset.units.find((unit) => unit.isCorrin && unit.gender === 'female')!
    const choices = candidatesFor(dataset, run, corrin.id, 's')
    const isChild = choices.map((choice) => choice.unit.fixedParent !== null)
    expect(isChild.some(Boolean)).toBe(true)
    expect(isChild).toEqual([...isChild].sort((a, b) => Number(a) - Number(b)))
    for (const group of [false, true]) {
      const positions = choices.filter((_, index) => isChild[index] === group).map((choice) => dataset.recruitment!.revelation!.get(choice.unit.id)!.order)
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
