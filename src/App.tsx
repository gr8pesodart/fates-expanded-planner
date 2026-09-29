import { useMemo, useSyncExternalStore } from 'react'
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

function Main({ route, desktop }: { route: AppRoute; desktop: boolean }) {
  switch (route.name) {
    case 'chart':
      return <ChartScreen />
    case 'runs':
      return <RunsScreen />
    case 'new-run':
      return <NewRunScreen />
    case 'unit':
      if (!desktop) return <CharacterScreen unitId={route.unitId} tab={route.tab} />
      return (
        <div className="two-pane">
          <RosterScreen activeUnitId={route.unitId} />
          <CharacterScreen unitId={route.unitId} tab={route.tab} embedded />
        </div>
      )
    default:
      if (!desktop) return <RosterScreen />
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
              {sharedRun ? <ChartScreen /> : <Main route={route} desktop={desktop} />}
            </main>
            <Pickers />
          </>
        )}
        <Toaster />
      </PlannerProvider>
    </div>
  )
}
