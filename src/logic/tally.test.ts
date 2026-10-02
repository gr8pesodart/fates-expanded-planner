import { beforeAll, describe, expect, it } from 'vitest'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import type { RunPlan } from '../state/model'
import { emptyRun, emptyUnitPlan, withCorrinBuild } from '../state/model'
import { unitContext } from './army'
import { buildProgression } from './progression'
import { runTallyItems, tallyItems } from './tally'

let dataset: Dataset

beforeAll(async () => {
  dataset = await loadDataset('ugf-2.5.2')
})

const CORRIN_F = 'PID_プレイヤー女'
const classId = (name: string) => dataset.classes.find((item) => item.name === name)!.id
const skillId = (name: string) => [...dataset.skillsById.values()].find((skill) => skill.name === name)!.id
const slots = (...names: string[]) => [...names.map(skillId), null, null, null, null, null].slice(0, 5)

function corrinRun(unit: Partial<RunPlan['units'][string]> = {}): RunPlan {
  const run = withCorrinBuild(emptyRun('test'), { talentClassId: classId('Samurai (F)') })
  return { ...run, units: { [CORRIN_F]: { ...emptyUnitPlan(), ...unit } } }
}

function progressionFor(run: RunPlan) {
  return buildProgression(dataset, run, unitContext(dataset, run, CORRIN_F)!)
}

describe('tallyItems', () => {
  it("lists a path's seals in seal order, with their item names", () => {
    const run = corrinRun({
      reclasses: [
        { segment: 0, level: 10, classId: classId('Samurai (F)') },
        { segment: 0, level: 12, classId: classId('Swordmaster (F)') },
      ],
    })
    const items = tallyItems(dataset, [{ progression: progressionFor(run), books: [] }])
    expect(items.map((item) => [item.name, item.count])).toEqual([['Master Seal', 1], ['Heart Seal', 1]])
    expect(items.every((item) => item.key !== null)).toBe(true)
  })

  it('counts each DLC class item separately', () => {
    const run = corrinRun({ reclasses: [{ segment: 0, level: 10, classId: classId('Witch') }] })
    const items = tallyItems(dataset, [{ progression: progressionFor(run), books: [] }])
    expect(items.map((item) => [item.name, item.count])).toEqual([["Witch's Mark", 1]])
  })

  it('sums the same seal and skill book across units', () => {
    const progression = progressionFor(corrinRun({ reclasses: [{ segment: 0, level: 10, classId: classId('Samurai (F)') }] }))
    const warp = skillId('Warp')
    const items = tallyItems(dataset, [
      { progression, books: [warp] },
      { progression, books: [warp] },
    ])
    expect(items.map((item) => [item.name, item.count])).toEqual([
      ['Heart Seal', 2],
      ['Warp skill book', 2],
    ])
  })

  it("counts the whole run's paths and their assumed skill books", () => {
    // Nohr Noble Corrin with Warp: nothing on the path teaches it, so its book stands in (DLC on).
    const run = corrinRun({ skills: slots('Dragon Fang', 'Warp'), classId: classId('Nohr Noble (F)') })
    const ctx = unitContext(dataset, run, CORRIN_F)!
    const names = runTallyItems(dataset, run, [ctx]).map((item) => item.name)
    expect(names).toContain('Warp skill book')
    expect(names).not.toContain('Dragon Fang skill book')
  })
})
