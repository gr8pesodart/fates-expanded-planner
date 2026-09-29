import { beforeAll, describe, expect, it } from 'vitest'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import type { RunPlan } from '../state/model'
import { emptyRun, emptyUnitPlan } from '../state/model'
import { unitContext } from './army'
import { buildProgression, findRow, tierCap } from './progression'

let dataset: Dataset

beforeAll(async () => {
  dataset = await loadDataset('ugf-2.5.2')
})

const CORRIN_F = 'PID_プレイヤー女'
const classId = (name: string) => dataset.classes.find((c) => c.name === name)!.id
const skillId = (name: string) => [...dataset.skillsById.values()].find((s) => s.name === name)!.id

function corrinRun(reclasses: RunPlan['units'][string]['reclasses']): RunPlan {
  const run = emptyRun('test')
  return {
    ...run,
    corrin: { ...run.corrin, gender: 'female', talentClassId: classId('Samurai (F)') },
    units: { [CORRIN_F]: { ...emptyUnitPlan(), reclasses } },
  }
}

function progressionFor(run: RunPlan) {
  const ctx = unitContext(dataset, run, CORRIN_F)!
  return buildProgression(dataset, run, ctx)
}

describe('buildProgression', () => {
  it('follows the mock path: Samurai @10, Swordmaster @12, Master of Arms @Advanced 15', () => {
    const progression = progressionFor(corrinRun([
      { segment: 0, level: 10, classId: classId('Samurai (F)') },
      { segment: 0, level: 12, classId: classId('Swordmaster (F)') },
      { segment: 1, level: 15, classId: classId('Master of Arms (F)') },
    ]))
    expect(progression.dropped).toEqual([])
    expect(progression.segments.map((segment) => segment.label)).toEqual(['Base', 'Advanced'])
    expect(progression.segments[0].rows.at(-1)?.level).toBe(12)
    expect(progression.segments[1].rows.map((row) => row.level)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))

    const names = (segment: number, level: number) => {
      const row = findRow(progression, segment, level)!
      return [...row.startsWith, ...row.learned].map((learned) => dataset.skillsById.get(learned.skillId)?.name)
    }
    expect(names(0, 1)).toEqual(['Nobility'])
    expect(names(0, 10)).toEqual(['Dragon Fang', "Duelist's Blow", 'Vantage'])
    expect(names(1, 5)).toEqual(['Astra'])
    expect(names(1, 15)).toEqual(['Swordfaire', 'Seal Strength', 'Life and Death'])
    expect(findRow(progression, 1, 16)?.classId).toBe(classId('Master of Arms (F)'))
  })

  it('never offers a promotion below Lv 10', () => {
    const progression = progressionFor(corrinRun([]))
    const offered = (level: number) => findRow(progression, 0, level)!.options.map((option) => option.classId)
    expect(offered(9)).not.toContain(classId('Swordmaster (F)'))
    expect(offered(9)).toContain(classId('Samurai (F)'))
    expect(offered(10)).toContain(classId('Nohr Noble (F)'))
  })

  it('drops reclasses that an earlier change made illegal', () => {
    const progression = progressionFor(corrinRun([
      { segment: 0, level: 5, classId: classId('Swordmaster (F)') },
    ]))
    expect(progression.dropped).toHaveLength(1)
    expect(progression.segments).toHaveLength(1)
  })

  it('moves a promoted unit onto the special track at +20 levels for DLC classes', () => {
    const progression = progressionFor(corrinRun([
      { segment: 0, level: 10, classId: classId('Nohr Noble (F)') },
      { segment: 1, level: 5, classId: classId('Great Lord') },
    ]))
    expect(progression.dropped).toEqual([])
    const special = progression.segments[2]
    expect(special.label).toBe('Special')
    expect(special.rows[0].level).toBe(25)
    expect(special.rows.at(-1)?.level).toBe(tierCap('special'))
  })

  it('keeps expected stats within the class caps and never decreasing without a class change', () => {
    const progression = progressionFor(corrinRun([]))
    const rows = progression.segments[0].rows
    for (let i = 1; i < rows.length; i += 1) {
      rows[i].expected.forEach((value, stat) => expect(value).toBeGreaterThanOrEqual(rows[i - 1].expected[stat]))
    }
    expect(skillId('Nobility')).toBeGreaterThan(0)
  })
})
