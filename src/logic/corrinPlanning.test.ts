import { beforeAll, describe, expect, it } from 'vitest'
import { candidatesFor } from '../app/selectors'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import { emptyRun } from '../state/model'
import type { RunPlan } from '../state/model'
import { unitContext } from './army'
import { classFamily } from './classes'
import { setBond } from './relationships'

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

  it('offers Corrin Friendship Seal branches from same-gender A-rank supports', () => {
    const run = makeRun()
    const corrin = dataset.units.find((unit) => unit.isCorrin && unit.gender === 'female')!
    const ctx = unitContext(dataset, run, corrin.id)!
    expect(ctx.pool.some((entry) => entry.branch === 'aplus' && entry.sourceLabel.startsWith('Friendship Seal:'))).toBe(true)
  })

  it('passes Corrin\'s selected talent branch to Kana', () => {
    const run = makeRun()
    const corrin = dataset.units.find((unit) => unit.isCorrin && unit.gender === 'female')!
    const kana = dataset.units.find((unit) => unit.fixedParent === corrin.id)!
    const ctx = unitContext(dataset, run, kana.id)!
    const talentFamily = classFamily(dataset.classesById.get(run.corrin.talentClassId!)!.name)
    expect(ctx.pool.some((entry) => entry.branch === 'parent' && classFamily(dataset.classesById.get(entry.classId)!.name) === talentFamily)).toBe(true)
  })

  it('lists Corrin\'s S choices in route recruit order', () => {
    const run = makeRun()
    const corrin = dataset.units.find((unit) => unit.isCorrin && unit.gender === 'female')!
    const choices = candidatesFor(dataset, run, corrin.id, 's')
    const positions = choices.map((choice) => dataset.recruitment!.revelation!.get(choice.unit.id)!.order)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
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
