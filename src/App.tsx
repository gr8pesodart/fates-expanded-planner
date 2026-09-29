import { useEffect, useMemo, useState } from 'react'
import { LensSwitcher } from './components/LensSwitcher'
import { RunPill } from './components/RunPill'
import { UnitListPane } from './components/UnitListPane'
import { lensOf, navigate, useRoute } from './lib/router'
import type { AppRoute, Lens } from './lib/router'
import { PairingsScreen } from './screens/PairingsScreen'
import { PreviewScreen } from './screens/PreviewScreen'
import { SetupScreen } from './screens/SetupScreen'
import { UnitRouteScreen } from './screens/UnitRouteScreen'
import { UnitScreen } from './screens/UnitScreen'
import { getBuildProfile } from './data/modProfiles'
import { ROUTES } from './data/types'
import { emptyRun } from './state/model'
import { usePlansStore } from './state/store'
import { decodeSharedRun } from './state/serialization'
import { usePairingsVM } from './viewmodels/usePairingsVM'
import type { RunPillVM } from './viewmodels/types'

const EMPTY_RUN = emptyRun('empty-run')

function Screen({ route }: { route: AppRoute }) {
  switch (route.name) {
    case 'setup':
      return <SetupScreen />
    case 'unit':
      return <UnitScreen unitId={route.unitId} />
    case 'unit-route':
      return <UnitRouteScreen unitId={route.unitId} />
    case 'preview':
      return <PreviewScreen />
    default:
      return <PairingsScreen />
  }
}

export default function App() {
  const route = useRoute()
  const shell = usePairingsVM()
  const localRun = usePlansStore((state) => state.runs.find((item) => item.id === state.activeRunId)) ?? EMPTY_RUN
  const sharedRun = useMemo(() => {
    if (route.name !== 'preview' || !route.shareToken) return null
    try {
      return decodeSharedRun(route.shareToken)
    } catch {
      return null
    }
  }, [route])
  const run = sharedRun ?? localRun
  const [theme, setTheme] = useState<'paper' | 'night'>('paper')

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'night' ? 'night' : 'paper'
  }, [theme])

  const themeAttr = theme === 'night' ? 'night' : undefined
  const profile = getBuildProfile(run.modpackId)
  const runPill: RunPillVM = {
    runName: run.name,
    crest: run.name.trim().charAt(0).toUpperCase() || 'R',
    modpackLabel: profile.id === 'ugf-2.5.2' ? 'UGF 2.5.2' : profile.short,
    dlc: run.dlc,
    route: run.route,
    routeLabel: ROUTES.find((item) => item.id === run.route)?.label ?? run.route,
    readOnly: Boolean(sharedRun),
    onOpenRuns: () => navigate({ name: 'setup' }),
    onOpenSetup: () => navigate({ name: 'setup' }),
  }

  if (route.name === 'setup') {
    return (
      <div className="app setupapp" data-route={run.route} data-theme={themeAttr}>
        <main className="appbody wide">
          <SetupScreen />
        </main>
      </div>
    )
  }

  const activeUnitId = route.name === 'unit' || route.name === 'unit-route' ? route.unitId : undefined
  const lens = lensOf(route)
  const onSelectLens = (next: Lens): void => {
    if (next === 'pairings') navigate({ name: 'pairings' })
    else if (next === 'preview') navigate({ name: 'preview' })
    else navigate({ name: 'unit', unitId: activeUnitId ?? shell.units[0]?.id ?? '' })
  }

  return (
    <div className={sharedRun ? 'app shared-preview' : 'app'} data-route={run.route} data-theme={themeAttr}>
      <header className="appbar">
        <RunPill vm={runPill} />
        <div className="appbarrow">
          <LensSwitcher active={lens} onSelect={onSelectLens} />
          <button
            type="button"
            className="themebtn"
            aria-label={theme === 'night' ? 'Switch to paper theme' : 'Switch to night theme'}
            aria-pressed={theme === 'night'}
            onClick={() => setTheme((current) => (current === 'night' ? 'paper' : 'night'))}
          >
            {theme === 'night' ? '☀' : '☾'}
          </button>
        </div>
      </header>
      {sharedRun ? null : (
        <aside className="sidepane">
          <UnitListPane
            query={shell.query}
            onSearch={shell.onSearch}
            filters={shell.filters}
            units={shell.units}
            activeId={activeUnitId}
          />
        </aside>
      )}
      <main className="appbody">
        <Screen route={route} />
      </main>
    </div>
  )
}
