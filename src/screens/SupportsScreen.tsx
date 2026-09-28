import { useMemo, useState } from 'react'
import { sortCharacters, findCharacter, edgePartner } from '../data/loader'
import type { DatasetEdge, SupportKind } from '../data/types'
import { useDataset } from '../data/useDataset'
import { useActivePlan } from '../state/plansStore'

type Filter = 'all' | SupportKind

export function SupportsScreen() {
  const plan = useActivePlan()
  const datasetState = useDataset(plan?.buildProfileId ?? 'ugf-2.5.2')
  const dataset = datasetState.status === 'ready' ? datasetState.dataset : null

  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  const sorted = useMemo(
    () => (dataset ? sortCharacters(dataset.characters) : []),
    [dataset],
  )

  // Default selection is derived (Corrin of the plan's gender, else first character).
  const defaultSelected = useMemo(() => {
    if (!dataset) return null
    const corrinId = plan?.corrin.gender === 'male' ? 'PID_プレイヤー男' : 'PID_プレイヤー女'
    return dataset.characters.find((c) => c.id === corrinId)?.id ?? dataset.characters[0]?.id ?? null
  }, [dataset, plan?.corrin.gender])

  const selected = picked ?? defaultSelected

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? sorted.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
      : sorted
    return list.slice(0, 30)
  }, [sorted, query])

  const character = dataset && selected ? findCharacter(dataset, selected) : undefined

  const partners = useMemo(() => {
    if (!dataset || !selected) return []
    const edges = dataset.edgesByCharacter.get(selected) ?? []
    return edges
      .filter((e) => filter === 'all' || e.info.kind === filter)
      .map((e) => ({ edge: e, other: findCharacter(dataset, edgePartner(e, selected)) }))
      .sort((x, y) => (x.other?.name ?? '').localeCompare(y.other?.name ?? '', 'ja'))
  }, [dataset, selected, filter])

  if (!dataset) {
    return (
      <section className="card">
        <h2>Supports</h2>
        <p className="hint">
          {datasetState.status === 'error'
            ? `Dataset failed to load: ${datasetState.message}`
            : 'Loading support graph…'}
        </p>
      </section>
    )
  }

  if (dataset.meta.status === 'pending') {
    return (
      <section className="card">
        <h2>Supports</h2>
        <div className="empty">
          No support dataset for this build yet. Extract one with{' '}
          <code>tools/extract/extract_ugf_supports.py</code> — see docs/DATA.md.
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="card">
        <h2>Support graph</h2>
        <p className="hint">
          {dataset.meta.label} — {dataset.meta.counts?.characters ?? dataset.characters.length}{' '}
          characters, {dataset.meta.counts?.edges ?? dataset.edges.length} support pairs. UGF grants
          near-universal supports; sibling and platonic pairs cap at A, romantic pairs can reach S.
        </p>
        <div className="field">
          <label htmlFor="char-search">Find a character</label>
          <input
            id="char-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or PID…"
          />
        </div>
        <div className="chiprow">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip ${selected === c.id ? 'chip--accent' : ''}`}
              onClick={() => setPicked(c.id)}
            >
              {c.name}
            </button>
          ))}
          {matches.length === 0 && <span className="chip chip--muted">No match</span>}
        </div>
      </section>

      {character && (
        <section className="card">
          <h2>{character.name}</h2>
          <div className="seg" role="group" aria-label="Support filter" style={{ marginBottom: 12 }}>
            {(
              [
                ['all', 'All'],
                ['romantic', 'Marriage'],
                ['platonic', 'Platonic'],
              ] as Array<[Filter, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {partners.length === 0 ? (
            <div className="empty">No supports in this filter.</div>
          ) : (
            <div className="stack">
              {partners.map(({ edge, other }) => (
                <PartnerRow key={`${edge.a}-${edge.b}`} edge={edge} name={other?.name ?? '?'} />
              ))}
            </div>
          )}

          <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
            Source: {dataset.meta.source?.file ?? 'dataset pack'} ·{' '}
            {dataset.meta.generatedAt ?? 'unknown date'} — see docs/DATA.md for verification notes.
          </p>
        </section>
      )}
    </>
  )
}

function PartnerRow({ edge, name }: { edge: DatasetEdge; name: string }) {
  const { ranks, fast, kind } = edge.info
  return (
    <div className="rowitem">
      <span className="avatar" aria-hidden>
        {name.slice(0, 1)}
      </span>
      <div className="grow">
        <div className="name">{name}</div>
        <div className="meta">{kind === 'romantic' ? 'Can marry (S)' : 'Platonic (A max)'}</div>
      </div>
      <div className="chiprow" style={{ flex: 'none' }}>
        {fast && <span className="chip chip--muted">Fast</span>}
        {(['c', 'b', 'a', 's'] as const).map((rank) => {
          const available = ranks[rank] !== null
          return (
            <span
              key={rank}
              className={`rankdot ${available ? (rank === 's' ? 'rankdot--s' : 'rankdot--on') : ''}`}
              title={available ? `${ranks[rank]} pts` : 'locked'}
            >
              {rank.toUpperCase()}
            </span>
          )
        })}
      </div>
    </div>
  )
}
