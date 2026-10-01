import { useMemo } from 'react'
import { usePickers } from '../../app/pickerStore'
import { usePlanner } from '../../app/plannerContext'
import { useUi } from '../../app/ui'
import { ClassSprite, Portrait } from '../../components/art'
import { StarButton } from '../../components/controls'
import { UnitLink } from '../../components/relations'
import { SortIcon } from '../../components/SortIcon'
import { StatTable } from '../../components/StatTable'
import type { UnitContext } from '../../logic/army'
import { displayName, recruitmentOf } from '../../logic/army'
import { classPool } from '../../logic/classes'
import { compareParents, parentRows, parentSortIcon } from '../../logic/parents'
import { setVariableParent, toggleFavouriteParent } from '../../logic/relationships'
import { fixedParentIsCorrin } from '../../logic/stats'
import { corrinBuild } from '../../state/model'
import { defaultHairColour } from '../../data/art'
import { hairColourOf } from '../../logic/hair'
import { navigate } from '../../lib/router'
import { candidatesFor, compareRecruitOrder } from '../../app/selectors'

/** Chapter number for "how much later" notes; null when the label has none (paralogues, route start). */
function chapterNumber(label: string): number | null {
  if (/^prologue$/i.test(label)) return 0
  const match = label.match(/chapter\s+(\d+)/i)
  return match ? Number(match[1]) : null
}

/** Figma 15:1542: Parent A as a link, then Parent B candidates with a sort sheet. */
export function ParentsTab({ ctx }: { ctx: UnitContext }) {
  const { dataset, run, readOnly, mutate } = usePlanner()
  const { parentSort, parentEffective } = useUi()
  const openPicker = usePickers((state) => state.open)
  const fixed = ctx.unit.fixedParent ? dataset.unitsById.get(ctx.unit.fixedParent) : undefined
  const fixedChapter = fixed ? recruitmentOf(dataset, run, fixed.id)?.chapter ?? null : null
  const fixedOrder = fixedChapter ? chapterNumber(fixedChapter) : null
  const prepared = useMemo(() => {
    if (!fixed) return []
    // Only Corrin can marry into the second generation, so only Kana can have a child as Parent B.
    return candidatesFor(dataset, run, ctx.unit.id, 'parent')
      .filter((item) => fixed.isCorrin || item.unit.fixedParent === null)
      .map((choice) => {
        const pool = classPool(dataset, ctx.unit, {
          variableParent: choice.unit,
          corrinTalentClassId: corrinBuild(run).talentClassId,
          fixedParentIsCorrin: fixedParentIsCorrin(dataset, ctx.unit),
        })
        // Only this candidate's contribution; the fixed parent's branch is the same on every card.
        const inherited = [...new Set(pool.filter((entry) => entry.branch === 'parent' && entry.sourceLabel === `Parent: ${choice.unit.name}`).map((entry) => entry.classId))]
        return { ...choice, inherited, chapter: recruitmentOf(dataset, run, choice.unit.id)?.chapter ?? 'Route start', rows: parentRows(dataset, run, ctx, choice.unit, !parentEffective) }
      })
  }, [dataset, run, ctx, fixed, parentEffective])
  const favouriteParents = ctx.plan.favouriteParents ?? []
  const starred = (id: string) => (favouriteParents.includes(id) ? 0 : 1)
  // Starred candidates first (always on, like class favourites), then the chosen sort.
  const sorted = [...prepared].sort((a, b) => starred(a.unit.id) - starred(b.unit.id) || compareParents(a, b, parentSort, compareRecruitOrder(dataset, run, a.unit, b.unit)))
  const reference = {
    modifiers: prepared.map((item) => item.rows.modifiers),
    growths: prepared.map((item) => item.rows.growths),
    pairUp: prepared.map((item) => item.rows.pairUp),
  }
  const select = (parentId: string) => mutate((current) => setVariableParent(dataset, current, ctx.unit.id, parentId))
  const open = (unitId: string) => navigate({ name: 'unit', unitId, tab: 'profile' })

  return (
    <>
      <section className="panel-section parents-tab" aria-labelledby="parent-a-title">
        <h2 id="parent-a-title" className="section-title">Parent A</h2>
        {fixed ? <UnitLink unit={fixed} onOpen={() => open(fixed.id)} /> : null}
      </section>
      <section className="panel-section parents-tab" aria-labelledby="parent-b-title">
        <div className="section-head">
          <h2 id="parent-b-title" className="section-title">Parent B</h2>
          <button type="button" className="icon-btn sort-btn" aria-label="Sort parents" onClick={() => openPicker({ sort: 'parents' })}>
            <SortIcon sort={parentSortIcon(parentSort)} size={30} />
          </button>
        </div>
        {sorted.length === 0 ? <p className="empty-note">No second parents are available on this route.</p> : null}
        <div className="parent-cards">
          {sorted.map((choice) => {
            const active = choice.unit.id === ctx.variableParent?.id
            // The child's sprites wear the hair colour this candidate would pass on.
            const hair = hairColourOf(dataset, run, choice.unit.id, defaultHairColour)
            const name = displayName(choice.unit, run)
            const order = chapterNumber(choice.chapter)
            const earlier = order !== null && fixedOrder !== null && order < fixedOrder
            const later = order !== null && fixedOrder !== null && order > fixedOrder ? order - fixedOrder : 0
            return (
              <article key={choice.unit.id} className="parent-card" data-active={active || undefined}>
                <button type="button" className="parent-card-select" aria-pressed={active} aria-label={`Choose ${name} as ${displayName(ctx.unit, run)}'s other parent`} disabled={readOnly} onClick={() => select(choice.unit.id)} />
                <div className="parent-card-head">
                  <Portrait unitId={choice.unit.id} name={name} className="chip-32" />
                  <span className="parent-name">{name}</span>
                  <StarButton on={favouriteParents.includes(choice.unit.id)} name={name} light={active} disabled={readOnly} onToggle={() => mutate((next) => toggleFavouriteParent(next, ctx.unit.id, choice.unit.id))} />
                  <span className="parent-class-tree" aria-label="Inherited class tree">
                    {choice.inherited.map((classId) => {
                      const def = dataset.classesById.get(classId)
                      return def ? <ClassSprite key={classId} unitId={ctx.unit.id} classId={classId} name={def.name} size={32} hair={hair} /> : null
                    })}
                  </span>
                </div>
                <p className={`parent-availability${earlier ? ' muted' : ''}`}>
                  {choice.chapter}
                  {later ? <b> (+{later} chapter{later === 1 ? '' : 's'})</b> : null}
                </p>
                <ParentTable title="Inherited stat modifiers" row={choice.rows.modifiers} reference={reference.modifiers} signed inverse={active} />
                <ParentTable title="Inherited stat growths" row={choice.rows.growths} reference={reference.growths} inverse={active} />
                <ParentTable title="Inherited pair up bonuses" row={choice.rows.pairUp} reference={reference.pairUp} signed inverse={active} />
              </article>
            )
          })}
        </div>
      </section>
    </>
  )
}

function ParentTable({ title, row, reference, signed = false, inverse }: { title: string; row: (number | null)[]; reference: (number | null)[][]; signed?: boolean; inverse: boolean }) {
  return (
    <div className="parent-stat-block">
      <h3 className="parent-inheritance-label">{title}</h3>
      <StatTable row={row} signed={signed} inverse={inverse} mov={false} referenceRows={reference} label={title} />
    </div>
  )
}
