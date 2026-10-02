/**
 * Automate progression across the roster (`npm run audit:skills`): for every unit on every route, equip
 * one skill from each of its first three pool classes, select the last pool class's promotion, and
 * check the solver's plan really learns every target and ends in that class (verifyAutoPlan replays
 * it through buildProgression).
 */
import { expect, it } from 'vitest'
import { loadDataset } from '../../src/data/loader'
import { ROUTES } from '../../src/data/types'
import { armyUnits, unitContext } from '../../src/logic/army'
import { autoProgression, verifyAutoPlan } from '../../src/logic/autoProgression'
import { skillCandidates } from '../../src/logic/progression'
import { defaultCorrinBuild, emptyRun, emptyUnitPlan } from '../../src/state/model'
import type { RunPlan } from '../../src/state/model'

it('plans every unit to its selected class with every equipped skill', async () => {
  const dataset = await loadDataset('ugf-2.5.2')
  const failures: string[] = []
  let planned = 0
  let worst = 0
  for (const route of ROUTES) {
    const base: RunPlan = { ...emptyRun('audit'), route: route.id }
    for (const unit of armyUnits(dataset, base)) {
      const start = unitContext(dataset, base, unit.id)!
      const pool = [...new Set(start.pool.map((entry) => entry.classId))]
      const picks = [...new Set(pool.slice(0, 3).flatMap((id) => {
        const skill = skillCandidates(dataset, start, dataset.classesById.get(id)!).at(-1)
        return skill ? [skill.skillId] : []
      }))]
      const last = dataset.classesById.get(pool.at(-1)!)!
      const goal = last.promotesTo[0] ?? last.id
      const run: RunPlan = { ...base, units: { [unit.id]: { ...emptyUnitPlan(), skills: [...picks, null, null, null, null, null].slice(0, 5), classId: goal } } }
      const ctx = unitContext(dataset, run, unit.id)!
      const started = performance.now()
      const result = autoProgression(dataset, run, ctx)
      worst = Math.max(worst, performance.now() - started)
      if (!result.plan) continue
      planned += 1
      for (const plan of [result.plan, result.withEternal]) {
        if (plan && !verifyAutoPlan(dataset, run, ctx, result.targets, plan)) failures.push(`${route.id} · ${unit.name} (eternal ${plan.eternalSeals})`)
      }
    }
  }
  console.log(`audit:auto-progression - ${planned} plans checked, ${failures.length} failed, slowest ${worst.toFixed(0)} ms`)
  expect(failures).toEqual([])
}, 600_000)

// Hard targets (owner, v3.4): Lv 15 skills from several advanced lines plus Lv 35 DLC skills, where
// the plan must pick up low skills early (each class's lower thresholds come first) and an Eternal
// Seal starts paying for itself.
const HARD: { corrin: 'female' | 'male'; talent: string; skills: string[]; goal: string }[] = [
  { corrin: 'female', talent: 'Samurai (F)', skills: ['Swordfaire', 'Nohrian Trust', 'Hoshidan Unity', 'Galeforce', 'Toxic Brew'], goal: 'Witch' },
  { corrin: 'female', talent: 'Samurai (F)', skills: ['Galeforce', 'Toxic Brew', 'Awakening', 'Swordfaire', 'Hoshidan Unity'], goal: 'Hoshido Noble (F)' },
  { corrin: 'female', talent: 'Samurai (F)', skills: ['Life and Death', 'Swordfaire', 'Nohrian Trust', 'Awakening', 'Galeforce'], goal: 'Great Lord' },
  { corrin: 'male', talent: 'Samurai (M)', skills: ['Speedtaker', 'Strengthtaker', 'Aether', 'Swordfaire', 'Nohrian Trust'], goal: 'Nohr Noble (M)' },
]

it('plans hard multi-line and DLC targets, offering Eternal Seals where they save seals', async () => {
  const dataset = await loadDataset('ugf-2.5.2')
  const skill = (name: string) => [...dataset.skillsById.values()].find((item) => item.name === name)!.id
  const cls = (name: string) => dataset.classes.find((item) => item.name === name)!.id
  let slowest = 0
  for (const test of HARD) {
    const unitId = test.corrin === 'female' ? 'PID_プレイヤー女' : 'PID_プレイヤー男'
    const base = emptyRun('audit')
    const build = { ...defaultCorrinBuild(), talentClassId: cls(test.talent) }
    const run: RunPlan = {
      ...base,
      route: 'revelation',
      corrin: { gender: test.corrin, builds: { female: build, male: build } },
      units: { [unitId]: { ...emptyUnitPlan(), skills: test.skills.map(skill), classId: cls(test.goal) } },
    }
    const ctx = unitContext(dataset, run, unitId)!
    const started = performance.now()
    const result = autoProgression(dataset, run, ctx)
    slowest = Math.max(slowest, performance.now() - started)
    expect(result.plan ?? result.withEternal, test.skills.join('/')).not.toBeNull()
    for (const plan of [result.plan, result.withEternal]) if (plan) expect(verifyAutoPlan(dataset, run, ctx, result.targets, plan)).toBe(true)
  }
  console.log(`audit:auto-progression hard cases - slowest ${slowest.toFixed(0)} ms`)
}, 600_000)

