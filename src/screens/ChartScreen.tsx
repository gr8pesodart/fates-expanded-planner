import { Fragment, memo, useMemo } from 'react'
import { usePlanner } from '../app/plannerContext'
import { usePickers } from '../app/pickerStore'
import { useUi } from '../app/ui'
import type { ChartDisplay } from '../app/ui'
import type { RosterEntry } from '../app/selectors'
import { useSortedRoster } from '../app/selectors'
import { ClassSprite, Portrait, SkillIcon } from '../components/art'
import { EditButton, StarButton } from '../components/controls'
import { Icon } from '../components/icons'
import { SealTally } from '../components/SealTally'
import { StatTable } from '../components/StatTable'
import { SwapButton } from '../components/SwapButton'
import { UnitNote } from '../components/UnitNote'
import { SortIcon } from '../components/SortIcon'
import { chartCards } from '../logic/chart'
import { classFamily } from '../logic/classes'
import type { LensId } from '../logic/lenses'
import { lensDef, lensRow } from '../logic/lenses'
import { buildProgression, expectedFinal, routeSteps } from '../logic/progression'
import { toggleFavourite } from '../logic/relationships'
import { runTallyItems } from '../logic/tally'
import { navigate } from '../lib/router'
import { useScrolled } from '../lib/useScrolled'

const STAT_FIELDS: Exclude<LensId, 'effectivePairUp'>[] = ['expectedFinal', 'statModifiers', 'personalGrowths', 'effectiveGrowths', 'maxStats', 'personalPairUp', 'baseStats', 'classGrowths', 'classPairUp']

export function ChartScreen() {
  const { rosterLens, chartSort, chartFavouritesFirst, chartFavouritesOnly, chartLinkPairs, chartGeneration, chartDisplay } = useUi()
  const { dataset, run, readOnly } = usePlanner()
  const openPicker = usePickers((state) => state.open)
  const { entries, sort } = useSortedRoster(rosterLens, chartSort, { favouritesFirst: chartFavouritesFirst, linkPairs: chartLinkPairs, generation: chartGeneration })
  const { sentinelRef, scrolled } = useScrolled()
  const visibleEntries = useMemo(() => chartFavouritesOnly ? entries.filter((entry) => entry.favourite) : entries, [entries, chartFavouritesOnly])
  const byId = useMemo(() => new Map(visibleEntries.map((entry) => [entry.unitId, entry])), [visibleEntries])
  const cards = useMemo(() => chartCards(visibleEntries.map((entry) => entry.unitId), run, chartLinkPairs), [visibleEntries, run, chartLinkPairs])
  // Cumulative over the whole run: every roster unit's planned path, memoised away from tab changes.
  const tally = useMemo(() => runTallyItems(dataset, run, entries.map((entry) => entry.ctx)), [dataset, run, entries])
  return (
    <section className="screen chart" aria-labelledby="chart-title">
      <span ref={sentinelRef} className="sticky-sentinel" aria-hidden="true" />
      <div className="chart-sticky-head" data-scrolled={scrolled}>
        <div className="screen-head">
          <h1 id="chart-title" className="screen-title">Chart</h1>
          <div className="chart-head-actions">
            {readOnly ? <span className="badge">Shared · read-only</span> : null}
            <button type="button" className="icon-btn sort-btn" aria-label="Choose chart information" onClick={() => openPicker({ chartDisplay: true })}>
              <Icon name="tune" size={30} />
            </button>
            <button type="button" className="icon-btn sort-btn" aria-label={`Sort: ${sort.kind}. Change chart sort`} onClick={() => openPicker({ sort: 'chart' })}>
              <SortIcon sort={sort} size={34} />
            </button>
          </div>
        </div>
      </div>
      {visibleEntries.length ? <ChartList cards={cards} byId={byId} display={chartDisplay} /> : <p className="empty-note chart-empty">{chartFavouritesOnly ? 'No favourites match these filters.' : 'No characters match these filters.'}</p>}
      <div className="chart-seal-float">
        <SealTally items={tally} />
      </div>
    </section>
  )
}

const ChartList = memo(function ChartList({ cards, byId, display }: { cards: ReturnType<typeof chartCards>; byId: Map<string, RosterEntry>; display: ChartDisplay }) {
  return (
    <ul className="chart-list">
      {cards.map((card) => {
        if (card.kind === 'solo') {
          const entry = byId.get(card.unitId)
          return entry ? <li key={card.unitId} className="chart-card"><ChartRow entry={entry} display={display} /></li> : null
        }
        const front = byId.get(card.front)
        const back = byId.get(card.back)
        if (!front || !back) return null
        return (
          <li key={`${card.front}+${card.back}`} className="chart-card pair">
            <ChartRow entry={front} display={display} />
            <div className="chart-swap">
              <SwapButton unitId={card.front} frontName={front.name} backName={back.name} />
            </div>
            <ChartRow entry={back} display={display} />
          </li>
        )
      })}
    </ul>
  )
})

function ChartRow({ entry, display }: { entry: RosterEntry; display: ChartDisplay }) {
  const { dataset, run, readOnly, mutate } = usePlanner()
  const openPicker = usePickers((state) => state.open)
  const { ctx, name, unitId } = entry
  const classDef = dataset.classesById.get(ctx.currentClassId)
  const skills = ctx.plan.skills.filter((id): id is number => id !== null)
  const steps = useMemo(
    () => (display.progression ? routeSteps(buildProgression(dataset, run, ctx), ctx.start) : []),
    [display.progression, dataset, run, ctx],
  )
  return (
    <div className="chart-row">
      <div className="chart-row-top">
        <div className="roster-id">
          <Portrait unitId={unitId} name={name} className="chip-32" />
          {/* Same as the Roster: the sprite opens the class picker. */}
          <button type="button" className="sprite-btn" aria-label={`${classDef?.name ?? 'Class'} - choose ${name}'s class`} disabled={readOnly} onClick={() => openPicker({ classes: unitId })}>
            <ClassSprite unitId={unitId} classId={ctx.currentClassId} name={classDef?.name ?? 'Class'} size={32} />
          </button>
          <span className="unit-name">{name}</span>
          <StarButton heart on={entry.favourite} name={name} disabled={readOnly} onToggle={() => mutate((next) => toggleFavourite(next, unitId))} />
        </div>
        <div className="chart-skills">
          {display.skills ? skills.map((id) => (
            <SkillIcon key={id} skillId={id} name={dataset.skillsById.get(id)?.name ?? 'Skill'} size={24} />
          )) : null}
          {readOnly ? null : <EditButton size={20} label={`Open ${name}`} onClick={() => navigate({ name: 'unit', unitId, tab: 'profile' })} />}
        </div>
      </div>
      {display.notes ? <UnitNote unitId={unitId} name={name} /> : null}
      {display.progression ? (
        <p className="chart-route" aria-label={`${name}'s class path`}>
          {steps.map((step, index) => (
            <Fragment key={`${index}-${step.classId}`}>
              {index ? <span className="chart-route-arrow" aria-hidden="true">→</span> : null}
              <span className="chart-route-step">Lv {step.level}: {classFamily(dataset.classesById.get(step.classId)?.name ?? '?')}</span>
            </Fragment>
          ))}
        </p>
      ) : null}
      {display.pairUp ? (
        <div className="chart-pairup">
          <span className="sub-title">Pair Up Bonuses</span>
          <StatTable row={lensRow(dataset, run, ctx, 'effectivePairUp')} signed label={`${name} pair up bonuses`} />
        </div>
      ) : null}
      {STAT_FIELDS.filter((id) => display[id]).map((id) => {
        const lens = lensDef(id)
        const final = id === 'expectedFinal' ? expectedFinal(dataset, run, ctx) : null
        return <div key={id} className="chart-stat"><span className="sub-title">{lens.label}</span><StatTable row={final?.row ?? lensRow(dataset, run, ctx, id)} signed={lens.signed} muted={final?.base} label={`${name} ${lens.label}`} /></div>
      })}
    </div>
  )
}
