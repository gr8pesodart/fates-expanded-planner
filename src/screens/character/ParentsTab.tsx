import { useMemo, useState } from 'react'
import { usePlanner } from '../../app/plannerContext'
import { ClassSprite } from '../../components/art'
import { Segmented } from '../../components/controls'
import { StatTable } from '../../components/StatTable'
import { displayName, recruitmentOf, unitContext } from '../../logic/army'
import { classFamily, classPool } from '../../logic/classes'
import { lensRow } from '../../logic/lenses'
import { setVariableParent } from '../../logic/relationships'
import { fixedParentIsCorrin } from '../../logic/stats'
import { candidatesFor, compareRecruitOrder, recruitIndex } from '../../app/selectors'
import type { UnitContext } from '../../logic/army'

type ParentSort = 'recruit' | 'name' | 'availability'

function availabilityOrder(chapter: string): number {
  if (/^prologue$/i.test(chapter)) return 0
  if (/anna on the run/i.test(chapter)) return 6.5
  const match = chapter.match(/(chapter|paralogue)\s+(\d+)/i)
  if (!match) return Number.POSITIVE_INFINITY
  const number = Number(match[2])
  if (/later/i.test(chapter)) return number + 0.1
  return match[1].toLowerCase() === 'paralogue' ? 7.5 + number / 100 : number
}

export function ParentsTab({ ctx }: { ctx: UnitContext }) {
  const { dataset, run, readOnly, mutate } = usePlanner()
  const [sort, setSort] = useState<ParentSort>('recruit')
  const fixed = ctx.unit.fixedParent ? dataset.unitsById.get(ctx.unit.fixedParent) : undefined
  // Only Corrin can marry into the second generation, so only Kana can have a child as Parent B.
  const choices = useMemo(() => fixed
    ? candidatesFor(dataset, run, ctx.unit.id, 'parent').filter((item) => fixed.isCorrin || item.unit.fixedParent === null)
    : [], [dataset, run, ctx.unit.id, fixed])
  const prepared = useMemo(() => choices.map((choice) => {
    const candidateRun = fixed ? setVariableParent(dataset, run, ctx.unit.id, choice.unit.id) : run
    const candidateCtx = unitContext(dataset, candidateRun, ctx.unit.id)
    const parentOrder = fixed ? recruitIndex(dataset, run, fixed) : Infinity
    const earlierThanPrimary = recruitIndex(dataset, run, choice.unit) < parentOrder
    const pool = classPool(dataset, ctx.unit, {
      variableParent: choice.unit,
      corrinTalentClassId: run.corrin.talentClassId,
      fixedParentIsCorrin: fixedParentIsCorrin(dataset, ctx.unit),
    })
    // Only this candidate's contribution; the fixed parent's branch is the same on every card.
    const inherited = [...new Set(pool.filter((entry) => entry.branch === 'parent' && entry.sourceLabel === `Parent: ${choice.unit.name}`).map((entry) => entry.classId))]
    return {
      ...choice,
      earlierThanPrimary,
      availability: recruitmentOf(dataset, run, choice.unit.id)?.chapter ?? 'Route start',
      inherited,
      modifiers: candidateCtx ? lensRow(dataset, candidateRun, candidateCtx, 'statModifiers') : [],
      growths: candidateCtx ? lensRow(dataset, candidateRun, candidateCtx, 'personalGrowths') : [],
    }
  }), [choices, dataset, fixed, run, ctx.unit])
  const sorted = [...prepared].sort((a, b) => {
    const recruit = compareRecruitOrder(dataset, run, a.unit, b.unit)
    if (sort === 'name') return a.name.localeCompare(b.name) || recruit
    if (sort === 'availability') return availabilityOrder(a.availability) - availabilityOrder(b.availability) || recruit
    return recruit
  })
  const select = (parentId: string) => mutate((current) => setVariableParent(dataset, current, ctx.unit.id, parentId))
  const modifierRows = prepared.map((item) => item.modifiers)
  const growthRows = prepared.map((item) => item.growths)

  return (
    <section className="panel-section parents-tab" aria-labelledby="parents-title">
      <div className="section-head">
        <div>
          <h2 id="parents-title" className="section-title">Parents</h2>
          {fixed ? <p className="muted parent-primary">Parent A · {displayName(fixed)}</p> : null}
        </div>
        <Segmented<ParentSort> label="Sort parents" value={sort} options={[{ id: 'recruit', label: 'Recruit' }, { id: 'name', label: 'Name' }, { id: 'availability', label: 'Chapter' }]} onChange={setSort} />
      </div>
      {sorted.length === 0 ? <p className="empty-note">No second parents are available on this route.</p> : null}
      <div className="parent-cards">
        {sorted.map((choice) => {
          const active = choice.unit.id === ctx.variableParent?.id
          return (
            <button key={choice.unit.id} type="button" className="parent-card" aria-pressed={active} disabled={readOnly} onClick={() => select(choice.unit.id)}>
              <span className="parent-card-head">
                <span className="parent-name">{choice.name}</span>
                <span className={`parent-availability${choice.earlierThanPrimary ? ' muted' : ''}`}>
                  {choice.availability}{choice.earlierThanPrimary && fixed ? ` · available before ${displayName(fixed)}` : ''}
                </span>
              </span>
              <span className="parent-inheritance-label">Inherited class tree</span>
              <span className="parent-class-tree">
                {choice.inherited.map((classId) => {
                  const def = dataset.classesById.get(classId)
                  return def ? <span key={classId} className="parent-class"><ClassSprite unitId={ctx.unit.id} classId={classId} name={def.name} size={32} /><span>{classFamily(def.name)}</span></span> : null
                })}
              </span>
              <span className="parent-stat-block">
                <span className="parent-inheritance-label">Inherited stat modifiers</span>
                <StatTable row={choice.modifiers} signed referenceRows={modifierRows} label={`${choice.name} inherited stat modifiers`} />
              </span>
              <span className="parent-stat-block">
                <span className="parent-inheritance-label">Inherited stat growths</span>
                <StatTable row={choice.growths} referenceRows={growthRows} label={`${choice.name} inherited stat growths`} />
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
