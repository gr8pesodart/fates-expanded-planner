import { useEffect, useState, type ReactElement } from 'react'
import { Sigil, IconPlan, IconSupports, IconReference, IconSettings } from './components/icons'
import { PlanScreen } from './screens/PlanScreen'
import { SupportsScreen } from './screens/SupportsScreen'
import { ReferenceScreen } from './screens/ReferenceScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { useActivePlan, usePlansStore } from './state/plansStore'
import { getBuildProfile } from './data/modProfiles'
import { ROUTES } from './data/types'
import { clearShareHash, readSharedPlan } from './lib/share'

type TabId = 'plan' | 'supports' | 'reference' | 'settings'

const TABS: ReadonlyArray<{
  id: TabId
  label: string
  icon: (p: { className?: string }) => ReactElement
}> = [
  { id: 'plan', label: 'Plan', icon: IconPlan },
  { id: 'supports', label: 'Supports', icon: IconSupports },
  { id: 'reference', label: 'Reference', icon: IconReference },
  { id: 'settings', label: 'Saves', icon: IconSettings },
]

export default function App() {
  const [tab, setTab] = useState<TabId>('plan')
  const plan = useActivePlan()
  const importBundle = usePlansStore((s) => s.importBundle)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const shared = readSharedPlan()
    if (!shared) return
    const result = importBundle(
      JSON.stringify({ app: 'fates-expanded-planner', schema: 1, plans: [shared] }),
    )
    clearShareHash()
    // One-time import of a plan embedded in the URL hash on first mount.
    // oxlint-disable-next-line react/set-state-in-effect
    setNotice(
      'imported' in result
        ? `Imported shared plan “${shared.name}”.`
        : `Shared plan “${shared.name}” is already saved on this device.`,
    )
  }, [importBundle])

  const profile = getBuildProfile(plan?.buildProfileId ?? 'ugf-2.5.2')
  const route = ROUTES.find((r) => r.id === plan?.route) ?? ROUTES[2]

  return (
    <div className="app" data-route={plan?.route ?? 'revelation'}>
      <header className="topbar">
        <span className="sigil" aria-hidden>
          <Sigil />
        </span>
        <div className="titleblock">
          <h1>Fates Expanded Planner</h1>
          <p className="sub">
            {plan ? plan.name : 'No run yet'} · {profile.short}
          </p>
        </div>
        <span className="route-pin">{route.label}</span>
      </header>

      <main className="shell">
        {notice && (
          <div className="banner" role="status">
            <span>{notice}</span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => setNotice(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="screen" key={tab}>
          {tab === 'plan' && <PlanScreen />}
          {tab === 'supports' && <SupportsScreen />}
          {tab === 'reference' && <ReferenceScreen />}
          {tab === 'settings' && <SettingsScreen />}
        </div>

        <p className="footnote">
          Fan-made planner for a modded copy of Fire Emblem Fates. Not affiliated with Nintendo or
          Intelligent Systems.
        </p>
      </main>

      <nav className="tabbar" aria-label="Main">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
