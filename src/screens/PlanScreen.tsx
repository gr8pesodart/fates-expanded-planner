import { useMemo, useState } from 'react'
import { BUILD_PROFILES, getBuildProfile } from '../data/modProfiles'
import { ROUTES, STAT_KEYS, STAT_LABELS, type StatKey } from '../data/types'
import { useDataset } from '../data/useDataset'
import { sortCharacters } from '../data/loader'
import { useActivePlan, usePlansStore, type SealCounts } from '../state/plansStore'

export function PlanScreen() {
  const plan = useActivePlan()
  const plans = usePlansStore((s) => s.plans)
  const createPlan = usePlansStore((s) => s.createPlan)
  const duplicatePlan = usePlansStore((s) => s.duplicatePlan)
  const deletePlan = usePlansStore((s) => s.deletePlan)
  const renamePlan = usePlansStore((s) => s.renamePlan)
  const updatePlan = usePlansStore((s) => s.updatePlan)
  const setActivePlan = usePlansStore((s) => s.setActivePlan)
  const addUnit = usePlansStore((s) => s.addUnit)
  const removeUnit = usePlansStore((s) => s.removeUnit)
  const setCorrin = usePlansStore((s) => s.setCorrin)
  const bumpSeal = usePlansStore((s) => s.bumpSeal)

  const datasetState = useDataset(plan?.buildProfileId ?? 'ugf-2.5.2')
  const dataset = datasetState.status === 'ready' ? datasetState.dataset : null
  const [pick, setPick] = useState('')

  const roster = useMemo(
    () => (dataset ? sortCharacters(dataset.characters.filter((c) => !c.isCorrin)) : []),
    [dataset],
  )

  const nameFor = (characterId: string) =>
    dataset?.characters.find((c) => c.id === characterId)?.name ?? characterId

  if (!plan) {
    return (
      <div className="card">
        <h2>No run open</h2>
        <p className="hint">Create a plan to start tracking a playthrough.</p>
        <button type="button" className="btn btn--solid" onClick={() => createPlan()}>
          Create plan
        </button>
      </div>
    )
  }

  const profile = getBuildProfile(plan.buildProfileId)

  return (
    <>
      <section className="card">
        <h2>Run</h2>
        <div className="field">
          <label htmlFor="plan-select">Open plan</label>
          <select
            id="plan-select"
            value={plan.id}
            onChange={(e) => setActivePlan(e.target.value)}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="plan-name">Name</label>
          <input
            id="plan-name"
            value={plan.name}
            onChange={(e) => renamePlan(plan.id, e.target.value)}
            placeholder="Run name"
          />
        </div>
        <div className="field">
          <label htmlFor="build-select">Game build</label>
          <select
            id="build-select"
            value={plan.buildProfileId}
            onChange={(e) => updatePlan(plan.id, { buildProfileId: e.target.value })}
          >
            {BUILD_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="btnrow">
          <button type="button" className="btn" onClick={() => createPlan()}>
            New
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => duplicatePlan(plan.id)}>
            Duplicate
          </button>
          <button type="button" className="btn btn--danger" onClick={() => deletePlan(plan.id)}>
            Delete
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Path</h2>
        <div className="seg" role="group" aria-label="Route">
          {ROUTES.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={plan.route === r.id}
              onClick={() => updatePlan(plan.id, { route: r.id })}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          {ROUTES.find((r) => r.id === plan.route)?.blurb}
        </p>
      </section>

      <section className="card">
        <h2>Corrin</h2>
        <div className="grid2">
          <div className="field">
            <label htmlFor="corrin-name">Name</label>
            <input
              id="corrin-name"
              value={plan.corrin.name}
              onChange={(e) => setCorrin(plan.id, { name: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Gender</label>
            <div className="seg">
              {(['female', 'male'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={plan.corrin.gender === g}
                  onClick={() => setCorrin(plan.id, { gender: g })}
                >
                  {g === 'female' ? 'F' : 'M'}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="corrin-boon">Boon</label>
            <select
              id="corrin-boon"
              value={plan.corrin.boon ?? ''}
              onChange={(e) =>
                setCorrin(plan.id, { boon: (e.target.value || undefined) as StatKey | undefined })
              }
            >
              <option value="">—</option>
              {STAT_KEYS.map((s) => (
                <option key={s} value={s}>
                  {STAT_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="corrin-bane">Bane</label>
            <select
              id="corrin-bane"
              value={plan.corrin.bane ?? ''}
              onChange={(e) =>
                setCorrin(plan.id, { bane: (e.target.value || undefined) as StatKey | undefined })
              }
            >
              <option value="">—</option>
              {STAT_KEYS.map((s) => (
                <option key={s} value={s}>
                  {STAT_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>
          Talent, voice and asset projection land with the class/stat dataset (docs/DATA.md).
          {plan.corrin.voice ? ` Voice: ${plan.corrin.voice}.` : ''}
        </p>
      </section>

      <section className="card">
        <h2>Roster ({plan.units.length})</h2>
        {datasetState.status === 'loading' && <p className="hint">Loading dataset…</p>}
        {datasetState.status === 'error' && (
          <p className="hint">Dataset failed to load: {datasetState.message}</p>
        )}
        {dataset && (
          <div className="field--inline" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Add unit">
              <option value="">Add a unit…</option>
              {roster.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn"
              style={{ flex: 'none' }}
              disabled={!pick}
              onClick={() => {
                addUnit(plan.id, pick)
                setPick('')
              }}
            >
              Add
            </button>
          </div>
        )}

        {plan.units.length === 0 ? (
          <div className="empty">
            No units planned yet. Add characters above — Corrin is configured in the card above.
          </div>
        ) : (
          <div className="stack">
            {plan.units.map((unit) => (
              <div className="rowitem" key={unit.id}>
                <span className="avatar" aria-hidden>
                  {nameFor(unit.characterId).slice(0, 1)}
                </span>
                <div className="grow">
                  <div className="name">{nameFor(unit.characterId)}</div>
                  <div className="meta">Planned class chain arrives with the class dataset</div>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => removeUnit(plan.id, unit.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Resources</h2>
        <div className="stack">
          {(Object.keys(plan.seals) as Array<keyof SealCounts>).map((seal) => (
            <div className="rowitem" key={seal}>
              <div className="grow">
                <div className="name" style={{ textTransform: 'capitalize' }}>
                  {seal} seal
                </div>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => bumpSeal(plan.id, seal, -1)}
                aria-label={`Fewer ${seal} seals`}
              >
                −
              </button>
              <strong style={{ minWidth: 24, textAlign: 'center' }}>{plan.seals[seal]}</strong>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => bumpSeal(plan.id, seal, 1)}
                aria-label={`More ${seal} seals`}
              >
                +
              </button>
            </div>
          ))}
        </div>
        <div className="chiprow" style={{ marginTop: 12 }}>
          {profile.features.freeRenown && <span className="chip chip--ok">Free renown rewards</span>}
          {profile.features.freeAccessories && (
            <span className="chip chip--ok">Accessories free</span>
          )}
          {profile.features.expandedSupports && (
            <span className="chip chip--accent">Expanded supports</span>
          )}
        </div>
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Mod flags come from the active game build, so plans against vanilla don’t assume free
          resources.
        </p>
      </section>
    </>
  )
}
