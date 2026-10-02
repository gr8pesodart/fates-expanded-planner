import { beforeAll, describe, expect, it } from 'vitest'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import { edgePartner, supportPartners } from '../data/types'
import { emptyRun, emptyUnitPlan, withCorrinBuild } from '../state/model'
import type { RunPlan } from '../state/model'
import { armyUnits, unitContext } from './army'
import { classFamily } from './classes'
import { setBond } from './relationships'
import { skillAccess } from './skillAccess'

let dataset: Dataset

beforeAll(async () => {
  dataset = await loadDataset('ugf-2.5.2')
})

const CORRIN_F = 'PID_プレイヤー女'
const JAKOB = 'PID_ジョーカー'
const KANA_M = 'PID_カンナ男'
const classId = (name: string) => dataset.classes.find((item) => item.name === name)!.id
const skillId = (name: string) => [...dataset.skillsById.values()].find((skill) => skill.name === name)!.id

function corrinRun(): RunPlan {
  const run = withCorrinBuild({ ...emptyRun('t'), route: 'revelation' }, { talentClassId: classId('Samurai (F)') })
  return { ...run, units: { [CORRIN_F]: { ...emptyUnitPlan(), reclasses: [{ segment: 0, level: 10, classId: classId('Samurai (F)') }] } } }
}

describe('skillAccess', () => {
  it('sorts Corrin\'s skills: learned on the path, open but untaken, behind a relationship', () => {
    let run = corrinRun()
    const before = skillAccess(dataset, run, unitContext(dataset, run, CORRIN_F)!)
    expect(before.byId.get(skillId('Dragon Fang'))?.group).toBe('progression')
    expect(before.byId.get(skillId('Astra'))?.group).toBe('available')
    const liveToServe = before.byId.get(skillId('Live to Serve'))
    expect(liveToServe?.group).toBe('locked')
    expect(liveToServe?.viaS.map((unit) => unit.id)).toContain(JAKOB)

    run = setBond(run, CORRIN_F, 'sPartner', JAKOB)
    const after = skillAccess(dataset, run, unitContext(dataset, run, CORRIN_F)!)
    expect(after.byId.get(skillId('Live to Serve'))?.group).toBe('available')
    expect(after.list.findIndex((item) => item.group === 'available')).toBeGreaterThan(after.list.findIndex((item) => item.group === 'progression'))
  })

  it('never lists the unit\'s personal skill and gives every locked skill a way in', () => {
    const run = corrinRun()
    for (const unit of armyUnits(dataset, run).slice(0, 40)) {
      const ctx = unitContext(dataset, run, unit.id)!
      const access = skillAccess(dataset, run, ctx)
      const personal = unit.personalSkills[run.route] ?? unit.personalSkills.revelation
      if (personal) expect(access.byId.has(personal)).toBe(false)
      for (const item of access.list) {
        if (item.group === 'locked') expect(item.viaS.length + item.viaA.length + item.viaParent.length + item.viaCombo.length + item.inheritFrom.length).toBeGreaterThan(0)
        if (item.group === 'inheritable') expect(item.inheritFrom.length).toBeGreaterThan(0)
      }
    }
  })

  it('finds classes only a combination opens: a duplicate branch falls back to the next one', () => {
    // Jakob's and Elise's first branches are both Troubadour, so with both, Elise gives Wyvern Rider.
    const run: RunPlan = { ...emptyRun('t'), route: 'revelation' }
    const sakura = dataset.units.find((unit) => unit.name === 'Sakura')!
    const lunge = skillAccess(dataset, run, unitContext(dataset, run, sakura.id)!).byId.get(skillId('Lunge'))
    expect(lunge?.group).toBe('locked')
    expect(lunge?.viaCombo.some((combo) => combo.some((change) => change.role === 's' && change.unit.id === JAKOB)
      && combo.some((change) => change.role === 'a' && change.unit.name === 'Elise'))).toBe(true)
  })

  it('keeps only minimal combinations: Corrin gets Archer from A Midori & A Mozu, not also with Kaze', () => {
    const run: RunPlan = { ...emptyRun('t'), route: 'conquest' }
    const archerSkill = skillAccess(dataset, run, unitContext(dataset, run, CORRIN_F)!).list
      .find((item) => item.classId !== null && dataset.classesById.get(item.classId)?.name.startsWith('Archer'))
    expect(archerSkill?.viaCombo.length).toBeGreaterThan(0)
    for (const combo of archerSkill!.viaCombo) {
      for (const other of archerSkill!.viaCombo) {
        if (combo === other) continue
        expect(combo.every((change) => other.some((item) => item.role === change.role && item.unit === change.unit))).toBe(false)
      }
    }
  })

  it('lists a skill under every class that teaches it (Locktouch: Outlaw and Ninja)', () => {
    const run: RunPlan = { ...emptyRun('t'), route: 'conquest' }
    const kaze = dataset.units.find((unit) => unit.name === 'Kaze')!
    const classes = skillAccess(dataset, run, unitContext(dataset, run, kaze.id)!).classes
    const teaching = classes.filter((record) => record.skills.some((item) => item.skillId === skillId('Locktouch')))
      .map((record) => dataset.classesById.get(record.classId!)!.name.replace(/ \((M|F)\)$/, ''))
    expect(teaching).toEqual(expect.arrayContaining(['Ninja', 'Outlaw']))
  })

  it('puts everything else under Not accessible (no DLC classes while DLC is off) and honours the S / A+ filters', () => {
    const run: RunPlan = { ...emptyRun('t'), route: 'conquest' }
    const ctx = unitContext(dataset, run, CORRIN_F)!
    const all = skillAccess(dataset, run, ctx)
    expect(all.classes.some((record) => record.group === 'unavailable' && dataset.classesById.get(record.classId!)?.name.startsWith('Hoshido Noble'))).toBe(true)
    const noDlc: RunPlan = { ...run, dlc: false }
    expect(skillAccess(dataset, noDlc, unitContext(dataset, noDlc, CORRIN_F)!).classes.some((record) => record.classId !== null && dataset.classesById.get(record.classId)?.dlc)).toBe(false)
    const noS = skillAccess(dataset, run, ctx, { s: false, a: true, p: true })
    expect(noS.list.some((item) => item.group === 'locked' && item.viaS.length)).toBe(false)
    expect(noS.list.filter((item) => item.group === 'unavailable').length).toBeGreaterThan(all.list.filter((item) => item.group === 'unavailable').length)
  })

  it("lists a child's inheritance-only skills as inheritable, from a current or another possible parent", () => {
    const run = corrinRun()
    for (const unit of armyUnits(dataset, run).filter((item) => item.fixedParent !== null)) {
      const ctx = unitContext(dataset, run, unit.id)!
      const fixed = dataset.unitsById.get(unit.fixedParent!)!
      const possible = new Set([fixed.id, ctx.variableParent?.id, ...supportPartners(dataset, fixed.id, 'romantic').map((edge) => edgePartner(edge, fixed.id))])
      for (const item of skillAccess(dataset, run, ctx).list) {
        if (item.group === 'inheritable') expect(item.inheritFrom.every((parent) => possible.has(parent.id))).toBe(true)
      }
    }
  })

  it("treats a parent's class in the other gender as the child's own (Kana and Corrin's Nohr Princess)", () => {
    const run = setBond(corrinRun(), CORRIN_F, 'sPartner', JAKOB)
    const kana = unitContext(dataset, run, KANA_M)!
    const families = skillAccess(dataset, run, kana).classes
      .filter((record) => record.classId !== null)
      .map((record) => classFamily(dataset.classesById.get(record.classId!)!.name))
    expect(families.filter((name) => name === 'Nohr Prince' || name === 'Nohr Princess')).toHaveLength(1)
    expect(families.filter((name) => name === 'Nohr Noble')).toHaveLength(1)
  })

  it('puts skills only another possible parent could pass on under Inheritable only; the parent filter drops them', () => {
    const run = setBond(corrinRun(), CORRIN_F, 'sPartner', JAKOB)
    const kana = unitContext(dataset, run, KANA_M)!
    const current = (id: string) => id === CORRIN_F || id === JAKOB
    const all = skillAccess(dataset, run, kana)
    expect(all.list.some((item) => item.group === 'inheritable' && item.inheritFrom.some((parent) => !current(parent.id)))).toBe(true)
    const strict = skillAccess(dataset, run, kana, { s: true, a: true, p: false })
    for (const item of strict.list) {
      expect(item.viaParent).toEqual([])
      expect(item.inheritFrom.every((parent) => current(parent.id))).toBe(true)
    }
    // Without a second parent there is nothing to be flexible about: every candidate still counts.
    const single = corrinRun()
    const open = skillAccess(dataset, single, unitContext(dataset, single, KANA_M)!, { s: true, a: true, p: false })
    expect(open.list.some((item) => item.viaParent.length > 0)).toBe(true)
  })
})
