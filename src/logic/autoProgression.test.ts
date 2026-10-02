import { beforeAll, describe, expect, it } from 'vitest'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import { emptyRun, emptyUnitPlan, withCorrinBuild } from '../state/model'
import type { RunPlan } from '../state/model'
import { unitContext } from './army'
import { autoProgression, autoTargets, bookOrClassChoices, skillBooksUsed, verifyAutoPlan } from './autoProgression'
import { setBond } from './relationships'

let dataset: Dataset

beforeAll(async () => {
  dataset = await loadDataset('ugf-2.5.2')
})

const CORRIN_F = 'PID_プレイヤー女'
const JAKOB = 'PID_ジョーカー'
const KANA_M = 'PID_カンナ男'
const classId = (name: string) => dataset.classes.find((item) => item.name === name)!.id
const skillId = (name: string) => [...dataset.skillsById.values()].find((skill) => skill.name === name)!.id
const slots = (...names: string[]) => [...names.map(skillId), null, null, null, null, null].slice(0, 5)

function corrinRun(skills: string[], finalClass: string): RunPlan {
  const run = withCorrinBuild({ ...emptyRun('t'), route: 'revelation' }, { talentClassId: classId('Samurai (F)') })
  return { ...run, units: { [CORRIN_F]: { ...emptyUnitPlan(), skills: slots(...skills), classId: classId(finalClass) } } }
}

describe('autoProgression', () => {
  it("plans Corrin through both Noble lines and the talent with the fewest seals", () => {
    const run = corrinRun(['Dragon Fang', 'Nohrian Trust', 'Vantage'], 'Hoshido Noble (F)')
    const ctx = unitContext(dataset, run, CORRIN_F)!
    const result = autoProgression(dataset, run, ctx)
    expect(result.unreachable).toEqual([])
    expect(result.plan).not.toBeNull()
    // Samurai (Heart), promote to Nohr Noble (Master), then Hoshido Noble (Heart).
    expect(result.plan!.sealCount).toBe(3)
    expect(verifyAutoPlan(dataset, run, ctx, result.targets, result.plan!)).toBe(true)
  })

  it('reports skills no class within reach teaches', () => {
    // Aether is a Great Lord (DLC) skill, so with DLC off nothing in reach teaches it.
    const run = { ...corrinRun(['Dragon Fang', 'Aether'], 'Nohr Noble (F)'), dlc: false }
    const result = autoProgression(dataset, run, unitContext(dataset, run, CORRIN_F)!)
    expect(result.unreachable).toEqual([skillId('Aether')])
    expect(result.plan?.sealCount).toBe(1)
  })

  it("counts what a child plans to inherit as one of the parent's targets", () => {
    let run = setBond(corrinRun(['Dragon Fang'], 'Nohr Noble (F)'), CORRIN_F, 'sPartner', JAKOB)
    run = { ...run, units: { ...run.units, [KANA_M]: { ...emptyUnitPlan(), inheritFixedSkill: skillId('Vantage') } } }
    const ctx = unitContext(dataset, run, CORRIN_F)!
    expect(autoTargets(dataset, run, ctx).wanted).toContain(skillId('Vantage'))
    const result = autoProgression(dataset, run, ctx)
    expect(verifyAutoPlan(dataset, run, ctx, result.targets, result.plan!)).toBe(true)
  })

  it('brings Azura back to Songstress after picking up a Sky Knight skill', () => {
    const azura = dataset.units.find((unit) => unit.name === 'Azura')!
    const run: RunPlan = { ...emptyRun('t'), dlc: false, units: { [azura.id]: { ...emptyUnitPlan(), skills: slots('Camaraderie'), classId: classId('Songstress') } } }
    const ctx = unitContext(dataset, run, azura.id)!
    const result = autoProgression(dataset, run, ctx)
    expect(result.plan?.seals).toEqual({ heart: 2 })
    expect(verifyAutoPlan(dataset, run, ctx, result.targets, result.plan!)).toBe(true)
  })

  it('offers an Eternal Seal when a late recruit has too few levels left (Fuga joining at Lv 18)', () => {
    const fuga = dataset.units.find((unit) => unit.name === 'Fuga')!
    const base: RunPlan = { ...emptyRun('t'), route: 'revelation', dlc: false }
    const start = unitContext(dataset, base, fuga.id)!
    const promoted = [...new Set([start.start.classId, ...start.pool.flatMap((entry) => {
      const def = dataset.classesById.get(entry.classId)!
      return def.tier === 'promoted' ? [def.id] : def.promotesTo
    })])]
    const skills = [...new Set(promoted.flatMap((id) => dataset.classesById.get(id)!.skillLearn.map((item) => item.id)))].slice(0, 5)
    const run: RunPlan = { ...base, units: { [fuga.id]: { ...emptyUnitPlan(), skills, classId: start.start.classId, joinLevel: 18 } } }
    const ctx = unitContext(dataset, run, fuga.id)!
    const result = autoProgression(dataset, run, ctx)
    expect(result.plan).toBeNull()
    expect(result.withEternal?.eternalSeals).toBe(1)
    expect(verifyAutoPlan(dataset, run, ctx, result.targets, result.withEternal!)).toBe(true)
  })

  it('asks class or skill book for a book skill, unless another equipped skill pins its class', () => {
    // Warp: Witch Lv 25 or its book. Toxic Brew (Witch Lv 35) has no book, so Witch is planned anyway.
    const warpOnly = corrinRun(['Warp'], 'Nohr Noble (F)')
    expect(bookOrClassChoices(dataset, warpOnly, unitContext(dataset, warpOnly, CORRIN_F)!)).toEqual([skillId('Warp')])
    const withBrew = corrinRun(['Warp', 'Toxic Brew'], 'Nohr Noble (F)')
    expect(bookOrClassChoices(dataset, withBrew, unitContext(dataset, withBrew, CORRIN_F)!)).toEqual([])
  })

  it('leaves a skill chosen for its book out of the class plan', () => {
    const run = corrinRun(['Dragon Fang', 'Warp'], 'Nohr Noble (F)')
    const ctx = unitContext(dataset, run, CORRIN_F)!
    const byClass = autoProgression(dataset, run, ctx)
    const byBook = autoProgression(dataset, run, ctx, [skillId('Warp')])
    expect(byBook.books).toEqual([skillId('Warp')])
    expect(byBook.plan!.sealCount).toBeLessThan(byClass.plan!.sealCount)
  })

  it('assumes the skill book for an equipped skill the path never teaches', () => {
    const run = corrinRun(['Dragon Fang', 'Warp', 'Vantage'], 'Nohr Noble (F)')
    const ctx = unitContext(dataset, run, CORRIN_F)!
    // Dragon Fang is on the path; Vantage has no book; Warp's book stands in.
    expect(skillBooksUsed(run, ctx, new Set([skillId('Dragon Fang')]))).toEqual([skillId('Warp')])
    expect(skillBooksUsed({ ...run, dlc: false }, ctx, new Set())).toEqual([])
  })

  it("uses a late-recruited child's Offspring Seal for free, and finds when skipping it fits more", () => {
    const married = setBond(corrinRun([], 'Nohr Noble (F)'), CORRIN_F, 'sPartner', JAKOB)
    const kanaRun = (chapter: number, skills: string[], goal: string): RunPlan => ({
      ...married,
      units: { ...married.units, [KANA_M]: { ...emptyUnitPlan(), joinChapter: chapter, skills: slots(...skills), classId: classId(goal) } },
    })
    // Chapter 19: the seal promotes to Advanced Lv 2, plenty of room for Nohr Noble's two skills.
    const early = kanaRun(19, ['Draconic Hex', 'Nohrian Trust'], 'Nohr Noble (M)')
    const earlyCtx = unitContext(dataset, early, KANA_M)!
    const sealed = autoProgression(dataset, early, earlyCtx, [], 'require')
    expect(sealed.plan?.seals).toEqual({ offspring: 1 })
    expect(sealed.plan?.sealCount).toBe(0)
    expect(verifyAutoPlan(dataset, early, earlyCtx, sealed.targets, sealed.plan!)).toBe(true)
    // Chapter 27: Advanced Lv 18 leaves two level-ups, too few for four advanced skills.
    const late = kanaRun(27, ['Draconic Hex', 'Nohrian Trust', 'Dragon Ward', 'Hoshidan Unity'], 'Hoshido Noble (M)')
    const lateCtx = unitContext(dataset, late, KANA_M)!
    expect(autoProgression(dataset, late, lateCtx, [], 'require').plan).toBeNull()
    const without = autoProgression(dataset, late, lateCtx, [], 'forbid')
    expect(without.plan?.seals.master).toBe(1)
    expect(verifyAutoPlan(dataset, late, lateCtx, without.targets, without.plan!)).toBe(true)
  })
})
