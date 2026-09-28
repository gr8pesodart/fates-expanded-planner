import { useMemo, useState } from 'react'
import { BUILD_PROFILES } from '../data/modProfiles'
import { ROUTES, STAT_KEYS, STAT_LABELS, unitName, type Dataset, type StatKey } from '../data/types'
import { BOONS, BANES } from '../data/boons'
import { sortUnits } from '../data/loader'
import { useDataset } from '../data/useDataset'
import { classFamily } from '../logic/classes'
import { useActivePlan, usePlansStore } from '../state/plansStore'
import { UnitDetail } from './UnitDetail'

const CORRIN_TALENT_EXCLUDED = new Set(['Nohr Prince', 'Nohr Princess', 'Songstress'])

function talentOptions(dataset: Dataset, gender: 'male' | 'female') {
  const suffix = gender === 'male' ? '(M)' : '(F)'
  const seen = new Set<string>()
  const options: { id: number; name: string }[] = []
  for (const cls of dataset.classes) {
    if (cls.tier !== 'base') continue
    const family = classFamily(cls.name)
    if (CORRIN_TALENT_EXCLUDED.has(family)) continue
    const gendered = cls.name.endsWith('(M)') || cls.name.endsWith('(F)')
    if (gendered && !cls.name.endsWith(suffix)) continue
    if (seen.has(family)) continue
    seen.add(family)
    options.push({ id: cls.id, name: family })
  }
  return options.sort((a, b) => a.name.localeCompare(b.name))
}

export function ArmyScreen() {
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

  const datasetState = useDataset(plan?.buildProfileId ?? 'ugf-2.5.2')
  const dataset = datasetState.status === 'ready' ? datasetState.dataset : null

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const selectedPlanUnit = plan?.units.find((u) => u.id === selectedUnitId) ?? null

  const candidates = useMemo(() => {
    if (!plan || !dataset) return []
    const q = query.trim().toLowerCase()
    if (!q) return []
    const inRoster = new Set(plan.units.map((u) => u.characterId))
    return sortUnits(dataset.units)
      .filter((u) => !u.isCorrin && !inRoster.has(u.id))
      .filter((u) => u.name.toLowerCase().includes(q))
      .slice(0, 10)
  }, [plan, dataset, query])

  if (!plan) {
    return (
      <section className="card">
        <h2>No run open</h2>
        <button type="button" className="btn btn--solid" onClick={() => createPlan()}>
          Create run
        </button>
      </section>
    )
  }

  if (dataset && selectedPlanUnit) {
    return (
      <UnitDetail
        plan={plan}
        dataset={dataset}
        planUnit={selectedPlanUnit}
        onBack={() => setSelectedUnitId(null)}
        onRemove={() => {
          removeUnit(plan.id, selectedPlanUnit.id)
          setSelectedUnitId(null)
        }}
      />
    )
  }

  return (
    <>
      <section className="card">
        <h2>Runs</h2>
        <div className="chiprow runrow">
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`chip ${p.id === plan.id ? 'chip--accent' : ''}`}
              onClick={() => setActivePlan(p.id)}
            >
              {p.name}
            </button>
          ))}
          <button type="button" className="chip chip--muted" onClick={() => createPlan()}>
            + New run
          </button>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="run-name">Run name</label>
          <input
            id="run-name"
            value={plan.name}
            onChange={(e) => renamePlan(plan.id, e.target.value)}
          />
        </div>
        <div className="btnrow">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => duplicatePlan(plan.id)}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="btn btn--danger btn--sm"
            disabled={plans.length <= 1}
            onClick={() => deletePlan(plan.id)}
          >
            Delete run
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Game build</h2>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="build-select">Which mods are installed</label>
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
                  {BOONS[s].label} ({STAT_LABELS[s]})
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
                  {BANES[s].label} ({STAT_LABELS[s]})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="corrin-talent">Talent (starting reclass branch)</label>
          <select
            id="corrin-talent"
            value={plan.corrin.talentClassId ?? ''}
            disabled={!dataset}
            onChange={(e) =>
              setCorrin(plan.id, {
                talentClassId: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          >
            <option value="">—</option>
            {dataset &&
              talentOptions(dataset, plan.corrin.gender).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
      </section>

      <section className="card">
        <h2>Roster ({plan.units.length})</h2>
        {!dataset && (
          <p className="hint">
            {datasetState.status === 'error'
              ? `Dataset failed to load: ${datasetState.message}`
              : 'Loading unit data…'}
          </p>
        )}
        {dataset && (
          <>
            <div className="field">
              <label htmlFor="unit-search">Add a unit</label>
              <input
                id="unit-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a name…"
              />
            </div>
            {query.trim() !== '' && (
              <div className="chiprow" style={{ marginBottom: 12 }}>
                {candidates.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="chip"
                    onClick={() => {
                      setQuery('')
                      const id = addUnit(plan.id, u.id)
                      setSelectedUnitId(id)
                    }}
                  >
                    + {u.name}
                    {u.fixedParent ? ' (child)' : ''}
                  </button>
                ))}
                {candidates.length === 0 && (
                  <span className="chip chip--muted">No match (or already added)</span>
                )}
              </div>
            )}
          </>
        )}

        {plan.units.length === 0 ? (
          <div className="empty">
            Search a name above to add units. Corrin is configured in the card above.
          </div>
        ) : (
          <div className="stack">
            {plan.units.map((pu) => {
              const unit = dataset?.unitsById.get(pu.characterId)
              const cls =
                pu.classId !== undefined ? dataset?.classesById.get(pu.classId) : undefined
              const partner = pu.sPartnerId ? unitName(dataset, pu.sPartnerId) : null
              return (
                <div className="rowitem" key={pu.id}>
                  <button
                    type="button"
                    className="rowtap"
                    onClick={() => setSelectedUnitId(pu.id)}
                  >
                    <span className="avatar" aria-hidden>
                      {(unit?.name ?? pu.characterId).slice(0, 1)}
                    </span>
                    <span className="grow">
                      <span className="name">{unitName(dataset, pu.characterId)}</span>
                      <span className="meta">
                        {cls?.name ?? 'No class chosen'}
                        {partner ? ` · ❤ ${partner}` : ''}
                        {pu.skills && pu.skills.length > 0 ? ` · ${pu.skills.length} skills` : ''}
                      </span>
                    </span>
                    <span className="chev" aria-hidden>
                      ›
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => removeUnit(plan.id, pu.id)}
                  >
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
