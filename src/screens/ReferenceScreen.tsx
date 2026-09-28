import { useMemo, useState } from 'react'
import { StatGrid } from '../components/StatGrid'
import { sortClasses, sortUnits } from '../data/loader'
import { skillName, type ClassDef, type Dataset, type UnitDef } from '../data/types'
import { useDataset } from '../data/useDataset'
import { ownBaseClasses, tierLabel } from '../logic/classes'
import { useActivePlan } from '../state/plansStore'

type Tab = 'units' | 'classes' | 'skills'

export function ReferenceScreen() {
  const plan = useActivePlan()
  const datasetState = useDataset(plan?.buildProfileId ?? 'ugf-2.5.2')
  const dataset = datasetState.status === 'ready' ? datasetState.dataset : null
  const [tab, setTab] = useState<Tab>('units')
  const [query, setQuery] = useState('')
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null)
  const [selectedClass, setSelectedClass] = useState<number | null>(null)
  const [tierFilter, setTierFilter] = useState<'all' | ClassDef['tier']>('all')

  const units = useMemo(() => (dataset ? sortUnits(dataset.units) : []), [dataset])
  const classes = useMemo(() => (dataset ? sortClasses(dataset.classes) : []), [dataset])
  const skills = useMemo(
    () =>
      dataset
        ? [...dataset.skillsById.values()].sort((a, b) => a.name.localeCompare(b.name))
        : [],
    [dataset],
  )

  if (!dataset) {
    return (
      <section className="card">
        <h2>Reference</h2>
        <p className="hint">
          {datasetState.status === 'error' ? `Failed: ${datasetState.message}` : 'Loading…'}
        </p>
      </section>
    )
  }

  const q = query.trim().toLowerCase()

  const unitDetail = selectedUnit ? dataset.unitsById.get(selectedUnit) : undefined
  const classDetail = selectedClass !== null ? dataset.classesById.get(selectedClass) : undefined

  return (
    <>
      <section className="card">
        <h2>Reference</h2>
        <div className="seg" role="group" aria-label="Reference section">
          {(
            [
              ['units', `Units (${units.length})`],
              ['classes', `Classes (${classes.length})`],
              ['skills', `Skills (${skills.length})`],
            ] as Array<[Tab, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => {
                setTab(id)
                setSelectedUnit(null)
                setSelectedClass(null)
                setQuery('')
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {tab === 'units' && (
        <>
          {unitDetail ? (
            <UnitReference
              dataset={dataset}
              unit={unitDetail}
              onBack={() => setSelectedUnit(null)}
            />
          ) : (
            <section className="card">
              <div className="field">
                <label htmlFor="ref-search">Find a unit</label>
                <input
                  id="ref-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name…"
                />
              </div>
              <div className="stack">
                {units
                  .filter((u) => q === '' || u.name.toLowerCase().includes(q))
                  .map((u) => (
                    <div className="rowitem" key={u.id}>
                      <button
                        type="button"
                        className="rowtap"
                        onClick={() => setSelectedUnit(u.id)}
                      >
                        <span className="avatar" aria-hidden>
                          {u.name.slice(0, 1)}
                        </span>
                        <span className="grow">
                          <span className="name">{u.name}</span>
                          <span className="meta">
                            {u.gender === 'female' ? 'Female' : 'Male'}
                            {u.fixedParent ? ' · Second gen' : ''}
                          </span>
                        </span>
                        <span className="chev" aria-hidden>
                          ›
                        </span>
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </>
      )}

      {tab === 'classes' && (
        <>
          {classDetail ? (
            <ClassReference
              dataset={dataset}
              cls={classDetail}
              onBack={() => setSelectedClass(null)}
            />
          ) : (
            <section className="card">
              <div className="seg" role="group" aria-label="Class tier" style={{ marginBottom: 12 }}>
                {(['all', 'base', 'promoted', 'special'] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    aria-pressed={tierFilter === tier}
                    onClick={() => setTierFilter(tier)}
                  >
                    {tier === 'all' ? 'All' : tierLabel(tier)}
                  </button>
                ))}
              </div>
              <div className="field">
                <label htmlFor="class-search">Find a class</label>
                <input
                  id="class-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name…"
                />
              </div>
              <div className="stack">
                {classes
                  .filter((c) => tierFilter === 'all' || c.tier === tierFilter)
                  .filter((c) => q === '' || c.name.toLowerCase().includes(q))
                  .map((c) => (
                    <div className="rowitem" key={c.id}>
                      <button
                        type="button"
                        className="rowtap"
                        onClick={() => setSelectedClass(c.id)}
                      >
                        <span className="grow">
                          <span className="name">{c.name}</span>
                          <span className="meta">
                            {tierLabel(c.tier)} · Mov {c.movement}
                            {c.skills.length > 0
                              ? ` · ${c.skills.map((s) => dataset.skillsById.get(s)?.name).join(', ')}`
                              : ''}
                          </span>
                        </span>
                        <span className="chev" aria-hidden>
                          ›
                        </span>
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </>
      )}

      {tab === 'skills' && (
        <section className="card">
          <div className="field">
            <label htmlFor="skill-ref-search">Find a skill</label>
            <input
              id="skill-ref-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name…"
            />
          </div>
          <div className="stack">
            {skills
              .filter((s) => q === '' || s.name.toLowerCase().includes(q))
              .map((s) => (
                <div className="rowitem" key={s.id}>
                  <div className="grow">
                    <div className="name">{s.name}</div>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}
    </>
  )
}

function UnitReference({
  dataset,
  unit,
  onBack,
}: {
  dataset: Dataset
  unit: UnitDef
  onBack: () => void
}) {
  const bases = ownBaseClasses(dataset, unit)
  const personal =
    unit.personalSkills.revelation ?? unit.personalSkills.birthright ?? unit.personalSkills.conquest
  return (
    <>
      <section className="card">
        <div className="detailhead">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
            ‹ Units
          </button>
          <div className="detailhead__name">
            <h2 style={{ margin: 0 }}>{unit.name}</h2>
            <span className="meta">
              {unit.gender === 'female' ? 'Female' : 'Male'}
              {unit.fixedParent ? ` · child of ${dataset.unitsById.get(unit.fixedParent)?.name}` : ''}
            </span>
          </div>
        </div>
      </section>
      <section className="card">
        <h2>Base stats</h2>
        <StatGrid values={unit.baseStats} />
      </section>
      <section className="card">
        <h2>Growths</h2>
        <StatGrid values={unit.growths} suffix="%" emphasizeMax />
      </section>
      <section className="card">
        <h2>Cap modifiers</h2>
        <StatGrid values={unit.capMods} />
      </section>
      <section className="card">
        <h2>Classes</h2>
        <div className="stack">
          {bases.map((baseId) => {
            const base = dataset.classesById.get(baseId)
            if (!base) return null
            const promos = base.promotesTo.map((id) => dataset.classesById.get(id)?.name)
            return (
              <div className="statline" key={baseId}>
                <span className="k">{base.name}</span>
                <span className="v">{promos.filter(Boolean).join(' / ') || '—'}</span>
              </div>
            )
          })}
          <div className="statline">
            <span className="k">Personal skill</span>
            <span className="v">{personal ? skillName(dataset, personal) : '—'}</span>
          </div>
        </div>
      </section>
    </>
  )
}

function ClassReference({
  dataset,
  cls,
  onBack,
}: {
  dataset: Dataset
  cls: ClassDef
  onBack: () => void
}) {
  return (
    <>
      <section className="card">
        <div className="detailhead">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
            ‹ Classes
          </button>
          <div className="detailhead__name">
            <h2 style={{ margin: 0 }}>{cls.name}</h2>
            <span className="meta">
              {tierLabel(cls.tier)} · Mov {cls.movement}
            </span>
          </div>
        </div>
      </section>
      <section className="card">
        <h2>Base stats</h2>
        <StatGrid values={cls.baseStats} />
      </section>
      <section className="card">
        <h2>Growths</h2>
        <StatGrid values={cls.growths} suffix="%" emphasizeMax />
      </section>
      <section className="card">
        <h2>Caps</h2>
        <StatGrid values={cls.caps} emphasizeMax />
      </section>
      <section className="card">
        <h2>Pair-up bonuses</h2>
        <StatGrid values={cls.pairUp} />
      </section>
      <section className="card">
        <h2>Skills & promotion</h2>
        <div className="statline">
          <span className="k">Learns</span>
          <span className="v">
            {cls.skills.map((id) => skillName(dataset, id)).join(', ') || '—'}
          </span>
        </div>
        <div className="statline">
          <span className="k">Promotes to</span>
          <span className="v">
            {cls.promotesTo.map((id) => dataset.classesById.get(id)?.name).filter(Boolean).join(' / ') ||
              '—'}
          </span>
        </div>
        <div className="statline">
          <span className="k">Promotes from</span>
          <span className="v">
            {cls.promotesFrom
              .map((id) => dataset.classesById.get(id)?.name)
              .filter(Boolean)
              .join(' / ') || '—'}
          </span>
        </div>
      </section>
    </>
  )
}
