import { useMemo, useState, useSyncExternalStore } from 'react'
import { Pickers } from './app/pickers'
import { PlannerProvider } from './app/planner'
import { Nav } from './components/Nav'
import { Toaster } from './components/Sheet'
import { sectionOf, useRoute } from './lib/router'
import type { AppRoute } from './lib/router'
import { CharacterScreen } from './screens/CharacterScreen'
import { ChartScreen } from './screens/ChartScreen'
import { NewRunScreen } from './screens/NewRunScreen'
import { RosterScreen } from './screens/RosterScreen'
import { RunsScreen } from './screens/RunsScreen'
import type { RunPlan } from './state/model'
import { decodeSharedRun } from './state/serialization'
import { useActiveRun, usePlansStore } from './state/store'

const DESKTOP = '(min-width: 1024px)'

function useDesktop(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(DESKTOP)
      query.addEventListener('change', notify)
      return () => query.removeEventListener('change', notify)
    },
    () => window.matchMedia(DESKTOP).matches,
  )
}

function Loading() {
  return <p className="loading" role="status">Loading game data…</p>
}

function Section({ route }: { route: AppRoute }) {
  switch (route.name) {
    case 'chart':
      return <ChartScreen />
    case 'runs':
      return <RunsScreen />
    case 'new-run':
      return <NewRunScreen />
    default:
      return <RosterScreen />
  }
}

/**
 * On mobile the character page is a layer over the screen it was opened from, which stays mounted
 * (and keeps its scroll) underneath. Closing it — including iOS's swipe-back, which previews a
 * snapshot of that screen — reveals exactly what the snapshot showed, instead of re-rendering the
 * roster from scratch and visibly popping.
 */
function MobileMain({ route, backdrop }: { route: AppRoute; backdrop: AppRoute }) {
  const layered = route.name === 'unit'
  return (
    <>
      <div className="base-layer" inert={layered || undefined}>
        <Section route={layered ? backdrop : route} />
      </div>
      {route.name === 'unit' ? (
        <div className="character-layer">
          <CharacterScreen key={route.unitId} unitId={route.unitId} tab={route.tab} />
        </div>
      ) : null}
    </>
  )
}

/** Desktop: the roster stays beside the character page (two panes). */
function DesktopMain({ route }: { route: AppRoute }) {
  switch (route.name) {
    case 'chart':
      return <ChartScreen />
    case 'runs':
      return <RunsScreen />
    case 'new-run':
      return <NewRunScreen />
    case 'unit':
      return (
        <div className="two-pane">
          <RosterScreen activeUnitId={route.unitId} />
          <CharacterScreen key={route.unitId} unitId={route.unitId} tab={route.tab} embedded />
        </div>
      )
    default:
      return (
        <div className="two-pane">
          <RosterScreen />
          <div className="pane-empty"><p className="muted">Open a character to plan their relationships, classes and progression.</p></div>
        </div>
      )
  }
}

export default function App() {
  const route = useRoute()
  const desktop = useDesktop()
  // The screen a character page was opened from (a deep link falls back to the roster).
  const [backdrop, setBackdrop] = useState<AppRoute>(() => (route.name === 'unit' ? { name: 'roster' } : route))
  if (route.name !== 'unit' && route !== backdrop) setBackdrop(route)
  const run = useActiveRun()
  const onboarded = usePlansStore((state) => state.onboarded)
  const sharedRun: RunPlan | null = useMemo(() => {
    if (route.name !== 'chart' || !route.shareToken) return null
    try {
      return decodeSharedRun(route.shareToken)
    } catch {
      return null
    }
  }, [route])
  const shownRun = sharedRun ?? run
  const firstRun = !onboarded && !sharedRun

  return (
    <div className="app" data-route={shownRun.route} data-shared={sharedRun ? '' : undefined}>
      <PlannerProvider sharedRun={sharedRun} fallback={<Loading />}>
        {firstRun ? (
          <main className="main"><NewRunScreen first /></main>
        ) : (
          <>
            {sharedRun ? null : <Nav section={sectionOf(route)} />}
            <main className="main">
              {sharedRun ? <ChartScreen /> : desktop ? <DesktopMain route={route} /> : <MobileMain route={route} backdrop={backdrop} />}
            </main>
            <Pickers />
          </>
        )}
        <Toaster />
      </PlannerProvider>
    </div>
  )
}
