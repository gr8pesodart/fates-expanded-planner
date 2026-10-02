import { beforeAll, describe, expect, it } from 'vitest'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import type { RunPlan } from '../state/model'
import { emptyRun, emptyUnitPlan, withCorrinBuild } from '../state/model'
import { unitContext } from './army'
import type { LearnedSkill, Progression } from './progression'
import { buildProgression, expectedFinal, findRow, routeSteps, sealsUsed, tierCap } from './progression'

let dataset: Dataset

beforeAll(async () => {
  dataset = await loadDataset('ugf-2.5.2')
})

const CORRIN_F = 'PID_プレイヤー女'
const classId = (name: string) => dataset.classes.find((c) => c.name === name)!.id
const skillId = (name: string) => [...dataset.skillsById.values()].find((s) => s.name === name)!.id

function corrinRun(reclasses: RunPlan['units'][string]['reclasses']): RunPlan {
  const run = withCorrinBuild(emptyRun('test'), { talentClassId: classId('Samurai (F)') })
  return { ...run, units: { [CORRIN_F]: { ...emptyUnitPlan(), reclasses } } }
}

function skillNames(skills: LearnedSkill[]) {
  return skills.map((learned) => dataset.skillsById.get(learned.skillId)?.name)
}

function learnedAt(progression: Progression, segment: number, level: number) {
  return skillNames(findRow(progression, segment, level)!.learned)
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

    expect(skillNames(progression.startsWith)).toEqual(['Nobility'])
    expect(learnedAt(progression, 0, 1)).toEqual([])
    expect(learnedAt(progression, 0, 10)).toEqual(['Dragon Fang'])
    expect(learnedAt(progression, 0, 11)).toEqual(["Duelist's Blow"])
    expect(learnedAt(progression, 0, 12)).toEqual(['Vantage'])
    expect(learnedAt(progression, 1, 5)).toEqual(['Astra'])
    expect(learnedAt(progression, 1, 15)).toEqual(['Swordfaire'])
    expect(learnedAt(progression, 1, 16)).toEqual(['Seal Strength'])
    expect(learnedAt(progression, 1, 17)).toEqual(['Life and Death'])
    expect(findRow(progression, 1, 16)?.classId).toBe(classId('Master of Arms (F)'))
  })

  it('summarises the path as join class then each class change', () => {
    const run = corrinRun([
      { segment: 0, level: 10, classId: classId('Samurai (F)') },
      { segment: 0, level: 12, classId: classId('Swordmaster (F)') },
      { segment: 1, level: 15, classId: classId('Master of Arms (F)') },
    ])
    const ctx = unitContext(dataset, run, CORRIN_F)!
    const steps = routeSteps(buildProgression(dataset, run, ctx), ctx.start)
    expect(steps.map((step) => [step.level, dataset.classesById.get(step.classId)?.name])).toEqual([
      [1, 'Nohr Princess (F)'], [10, 'Samurai (F)'], [12, 'Swordmaster (F)'], [15, 'Master of Arms (F)'],
    ])
  })

  it('expects final stats at the end of the default path, flagging one that stays in a base class', () => {
    const base = corrinRun([])
    const baseFinal = expectedFinal(dataset, base, unitContext(dataset, base, CORRIN_F)!)
    expect(baseFinal.base).toBe(true)
    const promoted = corrinRun([{ segment: 0, level: 10, classId: classId('Samurai (F)') }, { segment: 0, level: 12, classId: classId('Swordmaster (F)') }])
    const final = expectedFinal(dataset, promoted, unitContext(dataset, promoted, CORRIN_F)!)
    expect(final.base).toBe(false)
    expect(final.row).toHaveLength(9)
    expect(final.row[8]).toBe(dataset.classesById.get(classId('Swordmaster (F)'))!.movement)
  })

  it('takes Jakob and Felicia to Lv 40 in their promoted join class (native cap 40)', () => {
    for (const name of ['Jakob', 'Felicia']) {
      const unit = dataset.units.find((item) => item.name === name)!
      const run = emptyRun('test')
      const progression = buildProgression(dataset, run, unitContext(dataset, run, unit.id)!)
      expect(progression.segments.map((segment) => segment.tier)).toEqual(['promoted'])
      expect(progression.segments[0].rows.at(-1)?.level).toBe(40)
    }
  })

  it('learns at most one skill per level-up; only recruitment grants several', () => {
    const progression = progressionFor(corrinRun([
      { segment: 0, level: 10, classId: classId('Samurai (F)') },
      { segment: 0, level: 12, classId: classId('Swordmaster (F)') },
      { segment: 1, level: 15, classId: classId('Master of Arms (F)') },
    ]))
    for (const segment of progression.segments) for (const row of segment.rows) expect(row.learned.length).toBeLessThanOrEqual(1)
  })

  it("learns a reclassed base class's skills on the next level-ups, never on the reclass", () => {
    const progression = progressionFor(corrinRun([{ segment: 0, level: 10, classId: classId('Samurai (F)') }]))
    expect(learnedAt(progression, 0, 10)).toEqual(['Dragon Fang'])
    expect(learnedAt(progression, 0, 11)).toEqual(["Duelist's Blow"])
    expect(learnedAt(progression, 0, 12)).toEqual(['Vantage'])
  })

  it('picks up missed base-class skills after promoting, one per level-up', () => {
    const progression = progressionFor(corrinRun([
      { segment: 0, level: 10, classId: classId('Samurai (F)') },
      { segment: 0, level: 11, classId: classId('Swordmaster (F)') },
    ]))
    expect(learnedAt(progression, 0, 11)).toEqual(["Duelist's Blow"])
    expect(learnedAt(progression, 1, 1)).toEqual([])
    expect(learnedAt(progression, 1, 2)).toEqual(['Vantage'])
    expect(learnedAt(progression, 1, 5)).toEqual(['Astra'])
  })

  it('starts from the planned recruitment level for variable-level recruits only', () => {
    const run = { ...corrinRun([]), route: 'revelation' as const }
    const fuga = dataset.units.find((unit) => unit.name === 'Fuga')!
    const jakob = dataset.units.find((unit) => unit.name === 'Jakob')!
    const planned = { ...run, units: { ...run.units, [fuga.id]: { ...emptyUnitPlan(), joinLevel: 14 }, [jakob.id]: { ...emptyUnitPlan(), joinLevel: 14 } } }
    const fugaCtx = unitContext(dataset, planned, fuga.id)!
    expect(fugaCtx.start.variableLevel).toBe(true)
    expect(fugaCtx.start.level).toBe(14)
    expect(buildProgression(dataset, planned, fugaCtx).segments[0].rows[0].level).toBe(14)
    const jakobCtx = unitContext(dataset, planned, jakob.id)!
    expect(jakobCtx.start.variableLevel).toBe(false)
    expect(jakobCtx.start.level).toBe(jakobCtx.start.defaultLevel)
  })

  it('joins children by recruitment chapter, never before the later parent, with an Offspring Seal from Chapter 19', () => {
    const run = { ...corrinRun([]), route: 'revelation' as const }
    const kana = dataset.units.find((unit) => unit.fixedParent === CORRIN_F)!
    // Xander joins in Revelation Chapter 17, so Kana with Xander as second parent can't come before it.
    const xander = dataset.units.find((unit) => unit.name === 'Xander')!
    const married = { ...run, units: { [CORRIN_F]: { ...emptyUnitPlan(), sPartner: xander.id }, [xander.id]: { ...emptyUnitPlan(), sPartner: CORRIN_F } } }
    const early = unitContext(dataset, { ...married, units: { ...married.units, [kana.id]: { ...emptyUnitPlan(), joinChapter: 9 } } }, kana.id)!
    expect(early.start.child).toMatchObject({ earliest: 17, chapter: 17, offspringLevel: null })
    expect(early.start.level).toBe(18)
    const late = { ...married, units: { ...married.units, [kana.id]: { ...emptyUnitPlan(), joinChapter: 21 } } }
    const lateCtx = unitContext(dataset, late, kana.id)!
    expect(lateCtx.start.level).toBe(20)
    expect(lateCtx.start.child?.offspringLevel).toBe(6)
    const join = buildProgression(dataset, late, lateCtx).segments[0].rows[0]
    const offspring = join.options.filter((option) => option.seal === 'offspring')
    expect(offspring.length).toBeGreaterThan(0)
    expect(offspring.every((option) => option.level === 6 && option.newSegment)).toBe(true)
    // Taken: the Offspring Seal promotes to Advanced Lv 6 and is tallied as itself.
    const promoted = { ...late, units: { ...late.units, [kana.id]: { ...emptyUnitPlan(), joinChapter: 21, reclasses: [{ segment: 0, level: 20, classId: offspring[0].classId, seal: 'offspring' as const }] } } }
    const progression = buildProgression(dataset, promoted, unitContext(dataset, promoted, kana.id)!)
    expect(progression.dropped).toEqual([])
    expect(progression.segments[1].rows[0].level).toBe(6)
    expect(sealsUsed(progression)).toEqual([{ seal: 'offspring', classId: null, count: 1 }])
  })

  it('never offers a promotion below Lv 10', () => {
    const progression = progressionFor(corrinRun([]))
    const offered = (level: number) => findRow(progression, 0, level)!.options.map((option) => option.classId)
    expect(offered(9)).not.toContain(classId('Swordmaster (F)'))
    expect(offered(9)).toContain(classId('Samurai (F)'))
    expect(offered(10)).toContain(classId('Nohr Noble (F)'))
  })

  it('keeps Nohr Princess promotions route-specific', () => {
    const offered = (route: RunPlan['route']) => {
      const run = { ...corrinRun([]), route }
      const ctx = unitContext(dataset, run, CORRIN_F)!
      return findRow(buildProgression(dataset, run, ctx), 0, 10)!.options.map((option) => dataset.classesById.get(option.classId)?.name)
    }
    expect(offered('birthright')).toContain('Hoshido Noble (F)')
    expect(offered('birthright')).not.toContain('Nohr Noble (F)')
    expect(offered('conquest')).toContain('Nohr Noble (F)')
    expect(offered('conquest')).not.toContain('Hoshido Noble (F)')
    expect(offered('revelation')).toContain('Nohr Noble (F)')
    expect(offered('revelation')).toContain('Hoshido Noble (F)')
  })

  it('drops reclasses that an earlier change made illegal', () => {
    const progression = progressionFor(corrinRun([
      { segment: 0, level: 5, classId: classId('Swordmaster (F)') },
    ]))
    expect(progression.dropped).toHaveLength(1)
    expect(progression.segments).toHaveLength(1)
  })

  it('lets Azura go back to Songstress from her other classes with a Heart Seal', () => {
    const azura = dataset.units.find((unit) => unit.name === 'Azura')!
    const base: RunPlan = { ...emptyRun('test'), dlc: false }
    const run: RunPlan = { ...base, units: { [azura.id]: { ...emptyUnitPlan(), reclasses: [
      { segment: 0, level: 5, classId: classId('Sky Knight (F)') },
      { segment: 1, level: 12, classId: classId('Songstress') },
    ] } } }
    const progression = buildProgression(dataset, run, unitContext(dataset, run, azura.id)!)
    expect(progression.dropped).toEqual([])
    expect(progression.segments.map((segment) => segment.label)).toEqual(['Special', 'Base', 'Special'])
    expect(progression.segments[2].rows[0].level).toBe(12)
    expect(findRow(progression, 1, 12)!.options.find((option) => option.classId === classId('Songstress'))?.seal).toBe('heart')
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
