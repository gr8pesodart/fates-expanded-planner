import { FIRST_UNIT, lensOf, navigate, routeToHash, useRoute } from './lib/router'
import type { AppRoute } from './lib/router'
import { PairingsScreen } from './screens/PairingsScreen'
import { PreviewScreen } from './screens/PreviewScreen'
import { SetupScreen } from './screens/SetupScreen'
import { UnitRouteScreen } from './screens/UnitRouteScreen'
import { UnitScreen } from './screens/UnitScreen'

const LENS_ORDER = ['pairings', 'individual', 'preview'] as const
const LENS_LABELS: Record<(typeof LENS_ORDER)[number], string> = {
  pairings: 'Pairings',
  individual: 'Individual',
  preview: 'Preview',
}

function lensTarget(lens: (typeof LENS_ORDER)[number], route: AppRoute): AppRoute {
  if (lens === 'pairings') return { name: 'pairings' }
  if (lens === 'preview') return { name: 'preview' }
  const unitId = route.name === 'unit' || route.name === 'unit-route' ? route.unitId : FIRST_UNIT
  return { name: 'unit', unitId }
}

function RunPill({ route }: { route: AppRoute }) {
  const runName = 'New run'
  return (
    <div className="row">
      <div className="runpill">
        <span className="crest">{runName[0]}</span>
        <b>{runName}</b>
        <span className="meta">
          <span className="chip">UGF 2.5.2</span>
          <span className="chip accent">DLC</span>
        </span>
      </div>
      <a
        className="setup-link"
        href={routeToHash({ name: 'setup' })}
        aria-current={route.name === 'setup' ? 'page' : undefined}
      >
        Setup
      </a>
    </div>
  )
}

function LensSwitcher({ route }: { route: AppRoute }) {
  const active = lensOf(route)
  const index = LENS_ORDER.indexOf(active)
  return (
    <nav className="lens" aria-label="Roster lens">
      <span className="thumb" style={{ transform: `translateX(${index * 100}%)` }} aria-hidden="true" />
      {LENS_ORDER.map((lens) => (
        <button
          key={lens}
          type="button"
          aria-pressed={active === lens}
          onClick={() => navigate(lensTarget(lens, route))}
        >
          {LENS_LABELS[lens]}
        </button>
      ))}
    </nav>
  )
}

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
  return (
    <div className="app" data-route="revelation">
      <header className="appbar">
        <RunPill route={route} />
        <LensSwitcher route={route} />
      </header>
      <main className="appbody">
        <Screen route={route} />
      </main>
    </div>
  )
}
