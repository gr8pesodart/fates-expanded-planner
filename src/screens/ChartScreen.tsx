import { usePlanner } from '../app/plannerContext'
import { usePickers } from '../app/pickerStore'
import { useUi } from '../app/ui'
import type { RosterEntry } from '../app/selectors'
import { useSortedRoster } from '../app/selectors'
import { ClassSprite, Portrait, SkillIcon } from '../components/art'
import { EditButton, StarButton } from '../components/controls'
import { SwapButton } from '../components/SwapButton'
import { preloadSplashArt } from '../data/art'
import { SortIcon } from '../components/SortIcon'
import { chartCards } from '../logic/chart'
import { toggleFavourite } from '../logic/relationships'
import { navigate } from '../lib/router'
import { useScrolled } from '../lib/useScrolled'

export function ChartScreen() {
  const { rosterLens, chartSort, chartFavouritesFirst, chartLinkPairs, chartGeneration } = useUi()
  const { run, readOnly } = usePlanner()
  const openPicker = usePickers((state) => state.open)
  const { entries, sort } = useSortedRoster(rosterLens, chartSort, { favouritesFirst: chartFavouritesFirst, linkPairs: chartLinkPairs, generation: chartGeneration })
  const { sentinelRef, scrolled } = useScrolled()
  const byId = new Map(entries.map((entry) => [entry.unitId, entry]))
  const cards = chartCards(entries.map((entry) => entry.unitId), run, chartLinkPairs)
  return (
    <section className="screen chart" aria-labelledby="chart-title">
      <span ref={sentinelRef} className="sticky-sentinel" aria-hidden="true" />
      <div className="chart-sticky-head" data-scrolled={scrolled}>
        <div className="screen-head">
          <h1 id="chart-title" className="screen-title">Chart</h1>
          <div className="chart-head-actions">
            {readOnly ? <span className="badge">Shared · read-only</span> : null}
            <button type="button" className="icon-btn sort-btn" aria-label={`Sort: ${sort.kind}. Change chart sort`} onClick={() => openPicker({ sort: 'chart' })}>
              <SortIcon sort={sort} size={34} />
            </button>
          </div>
        </div>
      </div>
      <ul className="chart-list">
        {cards.map((card) => {
          if (card.kind === 'solo') {
            const entry = byId.get(card.unitId)
            return entry ? <li key={card.unitId} className="chart-card"><ChartRow entry={entry} /></li> : null
          }
          const front = byId.get(card.front)
          const back = byId.get(card.back)
          if (!front || !back) return null
          return (
            <li key={`${card.front}+${card.back}`} className="chart-card pair">
              <ChartRow entry={front} />
              <SwapButton unitId={card.front} frontName={front.name} backName={back.name} />
              <ChartRow entry={back} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ChartRow({ entry }: { entry: RosterEntry }) {
  const { dataset, readOnly, mutate } = usePlanner()
  const { ctx, name, unitId } = entry
  const classDef = dataset.classesById.get(ctx.currentClassId)
  const skills = ctx.plan.skills.filter((id): id is number => id !== null)
  return (
    <div className="chart-row" onPointerEnter={() => preloadSplashArt(unitId)} onFocusCapture={() => preloadSplashArt(unitId)}>
      <div className="roster-id">
        <Portrait unitId={unitId} name={name} className="chip-24" />
        <ClassSprite unitId={unitId} classId={ctx.currentClassId} name={classDef?.name ?? 'Class'} size={24} />
        <span className="unit-name">{name}</span>
        <StarButton on={entry.favourite} name={name} disabled={readOnly} onToggle={() => mutate((run) => toggleFavourite(run, unitId))} />
      </div>
      <div className="chart-skills">
        {skills.map((id) => (
          <SkillIcon key={id} skillId={id} name={dataset.skillsById.get(id)?.name ?? 'Skill'} size={20} />
        ))}
        {readOnly ? null : <EditButton size={20} label={`Open ${name}`} onClick={() => navigate({ name: 'unit', unitId, tab: 'profile' })} />}
      </div>
    </div>
  )
}
