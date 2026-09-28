import { BUILD_PROFILES, getBuildProfile } from '../data/modProfiles'
import { datasetStats } from '../data/types'
import { useDataset } from '../data/useDataset'
import { useActivePlan, usePlansStore } from '../state/plansStore'

export function ReferenceScreen() {
  const plan = useActivePlan()
  const updatePlan = usePlansStore((s) => s.updatePlan)
  const profile = getBuildProfile(plan?.buildProfileId ?? 'ugf-2.5.2')
  const datasetState = useDataset(profile.packId)
  const dataset = datasetState.status === 'ready' ? datasetState.dataset : null

  return (
    <>
      <section className="card">
        <h2>Game build</h2>
        {plan && (
          <div className="field">
            <label htmlFor="ref-build">Planned build</label>
            <select
              id="ref-build"
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
        )}
        <div className="chiprow" style={{ marginBottom: 12 }}>
          {profile.features.expandedSupports && (
            <span className="chip chip--accent">Expanded supports</span>
          )}
          {profile.features.freeRenown && <span className="chip chip--ok">Free renown</span>}
          {profile.features.freeAccessories && (
            <span className="chip chip--ok">Free accessories</span>
          )}
          {profile.features.voiceSelect && <span className="chip">Voice select</span>}
          {profile.features.cosmeticTextures && <span className="chip">Texture pack</span>}
        </div>

        {profile.mods.length === 0 ? (
          <div className="empty">No mods recorded for this build.</div>
        ) : (
          <div className="stack">
            {profile.mods.map((mod) => (
              <div className="rowitem" key={mod.name}>
                <div className="grow">
                  <div className="name">
                    {mod.name}
                    {mod.version ? ` ${mod.version}` : ''}
                  </div>
                  <div className="meta">{mod.effect}</div>
                </div>
                <div className="chiprow" style={{ flex: 'none' }}>
                  <span className={`chip ${mod.gameplay ? 'chip--gold' : 'chip--muted'}`}>
                    {mod.gameplay ? 'Gameplay' : 'Cosmetic'}
                  </span>
                  {mod.url && (
                    <a className="chip" href={mod.url} target="_blank" rel="noreferrer">
                      Page
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {profile.notes.length > 0 && (
          <ul className="prose" style={{ margin: '12px 0 0', paddingLeft: 18 }}>
            {profile.notes.map((n) => (
              <li key={n} style={{ color: 'var(--ink-2)', fontSize: 13.5 }}>
                {n}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Dataset</h2>
        {!dataset && (
          <p className="hint">
            {datasetState.status === 'error'
              ? `Failed: ${datasetState.message}`
              : 'Loading…'}
          </p>
        )}
        {dataset && (
          <div>
            <div className="statline">
              <span className="k">Pack</span>
              <span className="v">{dataset.meta.id}</span>
            </div>
            <div className="statline">
              <span className="k">Status</span>
              <span className="v">{dataset.meta.status}</span>
            </div>
            {dataset.meta.status === 'extracted' && (
              <>
                <div className="statline">
                  <span className="k">Characters / supports</span>
                  <span className="v">
                    {datasetStats(dataset).characters} / {datasetStats(dataset).edges}
                  </span>
                </div>
                <div className="statline">
                  <span className="k">Romantic / platonic pairs</span>
                  <span className="v">
                    {datasetStats(dataset).romantic} / {datasetStats(dataset).platonic}
                  </span>
                </div>
                <div className="statline">
                  <span className="k">Generated</span>
                  <span className="v">{dataset.meta.generatedAt ?? '—'}</span>
                </div>
                <div className="statline">
                  <span className="k">Source hash</span>
                  <span className="v" style={{ fontSize: 12 }}>
                    {dataset.meta.source?.sha256.slice(0, 16) ?? '—'}…
                  </span>
                </div>
              </>
            )}
            <ul className="prose" style={{ margin: '12px 0 0', paddingLeft: 18 }}>
              {(dataset.meta.notes ?? []).map((n) => (
                <li key={n} style={{ color: 'var(--ink-2)', fontSize: 13.5 }}>
                  {n}
                </li>
              ))}
            </ul>
            <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
              Regenerate: <code>python tools/extract/extract_ugf_supports.py</code> (reads the UGF
              Paragon export). Full pipeline: docs/DATA.md.
            </p>
          </div>
        )}
      </section>

      <section className="card">
        <h2>On the roadmap</h2>
        <ul className="prose" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Class/skill dataset → reclass chains, skills and stat projection per unit.</li>
          <li>Marriage planner: enforce UGF pair rules, track S/A+ slots per unit.</li>
          <li>Children: inheritance of growths, classes and caps from the chosen parents.</li>
          <li>Route-aware availability: Birthright / Conquest / Revelation rosters.</li>
          <li>Renown, seals and gold pacing that respects the installed mods.</li>
        </ul>
      </section>
    </>
  )
}
