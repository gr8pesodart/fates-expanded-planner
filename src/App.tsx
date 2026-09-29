import { useEffect, useState } from 'react'
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
import { usePairingsVM } from './viewmodels/usePairingsVM'

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
  const [theme, setTheme] = useState<'paper' | 'night'>('paper')

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'night' ? 'night' : 'paper'
  }, [theme])

  const themeAttr = theme === 'night' ? 'night' : undefined

  if (route.name === 'setup') {
    return (
      <div className="app setupapp" data-route={shell.runPill.route} data-theme={themeAttr}>
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
    <div className="app" data-route={shell.runPill.route} data-theme={themeAttr}>
      <header className="appbar">
        <RunPill vm={shell.runPill} />
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
      <aside className="sidepane">
        <UnitListPane
          query={shell.query}
          onSearch={shell.onSearch}
          filters={shell.filters}
          units={shell.units}
          activeId={activeUnitId}
        />
      </aside>
      <main className="appbody">
        <Screen route={route} />
      </main>
    </div>
  )
}
