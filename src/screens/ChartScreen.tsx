import { Fragment, memo, useMemo, useRef } from 'react'
import { usePlanner } from '../app/plannerContext'
import { usePickers } from '../app/pickerStore'
import { useUi } from '../app/ui'
import type { ChartTab } from '../app/ui'
import type { RosterEntry } from '../app/selectors'
import { useSortedRoster } from '../app/selectors'
import { ClassSprite, Portrait, SkillIcon } from '../components/art'
import { EditButton, Rail, StarButton } from '../components/controls'
import { SealTally } from '../components/SealTally'
import { StatTable } from '../components/StatTable'
import { SwapButton } from '../components/SwapButton'
import { PagerPage, TabPager } from '../components/TabPager'
import { preloadCutinArt } from '../data/art'
import { SortIcon } from '../components/SortIcon'
import { chartCards } from '../logic/chart'
import { classFamily } from '../logic/classes'
import { lensRow } from '../logic/lenses'
import { buildProgression, routeSteps } from '../logic/progression'
import { toggleFavourite } from '../logic/relationships'
import { runTallyItems } from '../logic/tally'
import { navigate } from '../lib/router'
import { useSwipePager } from '../lib/swipe'
import { useMountedTabs } from '../lib/useMountedTabs'
import { useScrolled } from '../lib/useScrolled'

const TABS: { id: ChartTab; label: string }[] = [
  { id: 'full', label: 'Full' },
  { id: 'skills', label: 'Skills Only' },
  { id: 'progression', label: 'Skills + Progression' },
  { id: 'pairUp', label: 'Skills + Pair Up' },
]
const TAB_IDS = TABS.map((tab) => tab.id)

/** What a chart row shows under its name line, per tab. */
interface RowParts {
  skills: boolean
  route: boolean
  pairUp: boolean
}

// Every tab keeps the skills; front and back units both show their pair-up bonus (owner, v3.4).
// Constant objects, so memoised rows see the same parts on every render.
const PARTS: Record<ChartTab, RowParts> = {
  full: { skills: true, route: true, pairUp: true },
  skills: { skills: true, route: false, pairUp: false },
  progression: { skills: true, route: true, pairUp: false },
  pairUp: { skills: true, route: false, pairUp: true },
}

export function ChartScreen() {
  const { rosterLens, chartSort, chartFavouritesFirst, chartLinkPairs, chartGeneration, chartTab, setChartTab } = useUi()
  const { dataset, run, readOnly } = usePlanner()
  const openPicker = usePickers((state) => state.open)
  const { entries, sort } = useSortedRoster(rosterLens, chartSort, { favouritesFirst: chartFavouritesFirst, linkPairs: chartLinkPairs, generation: chartGeneration })
  const { sentinelRef, scrolled } = useScrolled()
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.unitId, entry])), [entries])
  const cards = useMemo(() => chartCards(entries.map((entry) => entry.unitId), run, chartLinkPairs), [entries, run, chartLinkPairs])
  // Cumulative over the whole run: every roster unit's planned path, memoised away from tab changes.
  const tally = useMemo(() => runTallyItems(dataset, run, entries.map((entry) => entry.ctx)), [dataset, run, entries])
  const pagesRef = useRef<HTMLDivElement>(null)
  const tabIndex = TABS.findIndex((tab) => tab.id === chartTab)
  // Tabs swipe like the character page: each tab is a full chart, mounted once seen.
  useSwipePager(pagesRef, tabIndex, TABS.length, (next) => setChartTab(TABS[next].id))
  const mounted = useMountedTabs(chartTab, TAB_IDS, 600)
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
        <Rail variant="tabs" label="Chart shows" items={TABS} active={chartTab} onSelect={setChartTab} />
      </div>
      <div ref={pagesRef} className="chart-pages" data-swipe>
        <TabPager index={tabIndex}>
          {TABS.map((tab) => (
            <PagerPage key={tab.id} active={tab.id === chartTab} label={tab.label}>
              {mounted.has(tab.id) ? <ChartList tab={tab.id} cards={cards} byId={byId} /> : null}
            </PagerPage>
          ))}
        </TabPager>
      </div>
      <div className="chart-seal-float">
        <SealTally items={tally} />
      </div>
    </section>
  )
}

/**
 * One tab's chart. Memoised on its inputs, so changing tab (a swipe or a rail tap) re-renders none of
 * the lists - only which page is active. Re-rendering every row of all four tabs on each change
 * blocked the main thread right as a swipe let go (a visible stutter on the Chart).
 */
const ChartList = memo(function ChartList({ tab, cards, byId }: { tab: ChartTab; cards: ReturnType<typeof chartCards>; byId: Map<string, RosterEntry> }) {
  return (
    <ul className="chart-list">
      {cards.map((card) => {
        if (card.kind === 'solo') {
          const entry = byId.get(card.unitId)
          return entry ? <li key={card.unitId} className="chart-card"><ChartRow entry={entry} parts={PARTS[tab]} /></li> : null
        }
        const front = byId.get(card.front)
        const back = byId.get(card.back)
        if (!front || !back) return null
        return (
          <li key={`${card.front}+${card.back}`} className="chart-card pair">
            <ChartRow entry={front} parts={PARTS[tab]} />
            <div className="chart-swap">
              <SwapButton unitId={card.front} frontName={front.name} backName={back.name} />
            </div>
            <ChartRow entry={back} parts={PARTS[tab]} />
          </li>
        )
      })}
    </ul>
  )
})

function ChartRow({ entry, parts }: { entry: RosterEntry; parts: RowParts }) {
  const { dataset, run, readOnly, mutate } = usePlanner()
  const openPicker = usePickers((state) => state.open)
  const { ctx, name, unitId } = entry
  const classDef = dataset.classesById.get(ctx.currentClassId)
  const skills = ctx.plan.skills.filter((id): id is number => id !== null)
  const steps = useMemo(
    () => (parts.route ? routeSteps(buildProgression(dataset, run, ctx), ctx.start) : []),
    [parts.route, dataset, run, ctx],
  )
  return (
    <div className="chart-row" onPointerEnter={() => preloadCutinArt(unitId)} onFocusCapture={() => preloadCutinArt(unitId)}>
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
          {parts.skills ? skills.map((id) => (
            <SkillIcon key={id} skillId={id} name={dataset.skillsById.get(id)?.name ?? 'Skill'} size={24} />
          )) : null}
          {readOnly ? null : <EditButton size={20} label={`Open ${name}`} onClick={() => navigate({ name: 'unit', unitId, tab: 'profile' })} />}
        </div>
      </div>
      {parts.route ? (
        <p className="chart-route" aria-label={`${name}'s class path`}>
          {steps.map((step, index) => (
            <Fragment key={`${index}-${step.classId}`}>
              {index ? <span className="chart-route-arrow" aria-hidden="true">→</span> : null}
              <span className="chart-route-step">Lv {step.level}: {classFamily(dataset.classesById.get(step.classId)?.name ?? '?')}</span>
            </Fragment>
          ))}
        </p>
      ) : null}
      {parts.pairUp ? (
        <div className="chart-pairup">
          <span className="sub-title">Pair Up Bonuses</span>
          <StatTable row={lensRow(dataset, run, ctx, 'effectivePairUp')} signed label={`${name} pair up bonuses`} />
        </div>
      ) : null}
    </div>
  )
}
