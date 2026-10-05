/**
 * Exhaustive check of the skill picker's reach (`npm run audit:skills`).
 *
 * For every route, both Corrins and every unit on the roster, starting from an empty plan, this tries
 * every combination of relationships — second parent × S partner × A+ partner (Corrin: S partner ×
 * up to two A-rank Friendship Seal partners) — through `classPool`, and collects every skill the
 * resulting classes teach. Anything reachable that `skillAccess` marks unavailable is a gap. Each
 * relationship resolves its own class-sharing slot, so combinations should add no class beyond the
 * union of their individual relationship gains.
 * Inheritance from parents is out of scope (it depends on the parents' own plans).
 */
import { expect, it } from 'vitest'
import { loadDataset } from '../../src/data/loader'
import type { Dataset, UnitDef } from '../../src/data/types'
import { edgePartner, ROUTES, supportPartners } from '../../src/data/types'
import { aPlusEligible, armyUnits, classOnRoute, personalSkill, unitContext } from '../../src/logic/army'
import { classPool } from '../../src/logic/classes'
import { corrinPair } from '../../src/logic/corrin'
import { dlcClassesFor } from '../../src/logic/progression'
import { skillAccess } from '../../src/logic/skillAccess'
import type { Gender, RunPlan } from '../../src/state/model'
import { emptyRun } from '../../src/state/model'

function reachableSkills(dataset: Dataset, run: RunPlan, unit: UnitDef, roster: UnitDef[]): Map<number, string> {
  const onRoster = new Set(roster.map((item) => item.id))
  const partnersOf = (id: string, kind: 'romantic' | 'a-rank') => supportPartners(dataset, id, kind)
    .map((edge) => dataset.unitsById.get(edgePartner(edge, id)))
    .filter((item): item is UnitDef => item !== undefined && onRoster.has(item.id))
  const fixed = unit.fixedParent ? dataset.unitsById.get(unit.fixedParent) : undefined
  const parents: (UnitDef | undefined)[] = [undefined, ...(fixed ? partnersOf(fixed.id, 'romantic').filter((item) => fixed.isCorrin || item.fixedParent === null) : [])]
  const spouses: (UnitDef | undefined)[] = [undefined, ...partnersOf(unit.id, 'romantic')]
  const donorSets: UnitDef[][] = [[]]
  if (unit.isCorrin) {
    const donors = partnersOf(unit.id, 'a-rank').filter((item) => item.gender === unit.gender)
    donors.forEach((donor, index) => {
      donorSets.push([donor])
      for (const other of donors.slice(index + 1)) donorSets.push([donor, other])
    })
  } else {
    for (const donor of roster) if (aPlusEligible(dataset, unit, donor, undefined)) donorSets.push([donor])
  }

  const talent = run.corrin.builds[run.corrin.gender].talentClassId
  const reached = new Map<number, string>()
  const learn = (classId: number, how: string) => {
    for (const item of dataset.classesById.get(classId)?.skillLearn ?? []) if (!reached.has(item.id)) reached.set(item.id, how)
  }
  for (const parent of parents) {
    for (const spouse of spouses) {
      for (const donors of donorSets) {
        if (spouse && donors.some((donor) => donor.id === spouse.id)) continue
        const pool = classPool(dataset, unit, {
          variableParent: parent,
          sPartner: spouse,
          aPlusPartner: unit.isCorrin ? undefined : donors[0],
          friendshipDonors: unit.isCorrin ? donors : [],
          corrinTalentClassId: talent,
        })
        const how = [parent && `parent ${parent.name}`, spouse && `S ${spouse.name}`, ...donors.map((donor) => `A ${donor.name}`)].filter(Boolean).join(' + ')
        for (const item of pool) if (classOnRoute(dataset, item.classId, run.route)) learn(item.classId, how || 'own')
      }
    }
  }
  if (run.dlc) for (const def of dlcClassesFor(dataset, unit.gender)) learn(def.id, 'DLC')
  const personal = personalSkill(unit, run)
  if (personal !== null) reached.delete(personal)
  return reached
}

it('lists every skill any combination of relationships can teach', async () => {
  const dataset = await loadDataset('ugf-2.5.2')
  const gaps: string[] = []
  let checked = 0
  for (const route of ROUTES) {
    for (const gender of ['female', 'male'] as Gender[]) {
      const base = emptyRun('audit')
      const run: RunPlan = { ...base, route: route.id, corrin: { ...base.corrin, gender } }
      const roster = armyUnits(dataset, run)
      for (const unit of roster) {
        // The other Corrin's run covers units that don't depend on Corrin's gender.
        if (gender === 'male' && !unit.isCorrin && unit.id !== corrinPair(dataset, 'male').kana?.id) continue
        const ctx = unitContext(dataset, run, unit.id)!
        const listed = skillAccess(dataset, run, ctx).byId
        for (const [skillId, how] of reachableSkills(dataset, run, unit, roster)) {
          checked += 1
          const group = listed.get(skillId)?.group
          if (group === undefined || group === 'unavailable') gaps.push(`${route.id} · ${unit.name}: ${dataset.skillsById.get(skillId)?.name ?? skillId} (via ${how})`)
        }
      }
    }
  }
  console.log(`audit:skills — ${checked} reachable unit × skill pairs checked, ${gaps.length} not listed`)
  if (gaps.length) console.log(gaps.join('\n'))
  expect(gaps).toEqual([])
}, 600_000)
