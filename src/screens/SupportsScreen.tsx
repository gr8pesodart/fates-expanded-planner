import { useDataset } from '../data/useDataset'
import { childrenOfPair } from '../logic/family'
import { unitName, type Dataset } from '../data/types'
import { useActivePlan } from '../state/plansStore'

export function SupportsScreen() {
  const plan = useActivePlan()
  const datasetState = useDataset(plan?.buildProfileId ?? 'ugf-2.5.2')
  const dataset = datasetState.status === 'ready' ? datasetState.dataset : null

  if (!plan || !dataset) {
    return (
      <section className="card">
        <h2>Pairings</h2>
        <p className="hint">
          {datasetState.status === 'error' ? `Failed: ${datasetState.message}` : 'Loading…'}
        </p>
      </section>
    )
  }

  const roster = new Map(plan.units.map((u) => [u.characterId, u]))

  type PairRow = {
    key: string
    a: string
    b: string
    children: string[]
    mutual: boolean
  }

  const rows: PairRow[] = []
  const seen = new Set<string>()
  for (const unit of plan.units) {
    if (!unit.sPartnerId) continue
    const [a, b] = [unit.characterId, unit.sPartnerId].sort()
    const key = `${a}::${b}`
    if (seen.has(key)) continue
    seen.add(key)
    const mutual =
      roster.get(a)?.sPartnerId === b && roster.get(b)?.sPartnerId === a
    rows.push({
      key,
      a,
      b,
      mutual,
      children: childrenOfPair(dataset, a, b).map((c) => c.name),
    })
  }

  const matched = rows.filter((r) => r.mutual)
  const broken = rows.filter((r) => !r.mutual)
  const unpaired = plan.units.filter((u) => !u.sPartnerId)

  return (
    <>
      <section className="card">
        <h2>Pairings</h2>
        <p className="hint">
          Set S ranks on a unit’s card in the Army tab. Mutual pairs are ready; mismatches below
          need the other side set too.
        </p>
        {matched.length === 0 ? (
          <div className="empty">No mutual S-rank pairs yet.</div>
        ) : (
          <div className="stack">
            {matched.map((row) => (
              <div className="rowitem" key={row.key}>
                <div className="grow">
                  <div className="name">
                    {unitName(dataset, row.a)} ❤ {unitName(dataset, row.b)}
                  </div>
                  {row.children.length > 0 && (
                    <div className="meta">Children: {row.children.join(' + ')}</div>
                  )}
                </div>
                <span className="chip chip--ok">S</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {broken.length > 0 && (
        <section className="card">
          <h2>One-sided S ranks</h2>
          <div className="stack">
            {broken.map((row) => {
              const aHas = roster.get(row.a)?.sPartnerId === row.b
              const from = aHas ? row.a : row.b
              const to = aHas ? row.b : row.a
              const toHas = roster.get(to)?.sPartnerId
              return (
                <div className="rowitem" key={row.key}>
                  <div className="grow">
                    <div className="name">
                      {unitName(dataset, from)} → {unitName(dataset, to)}
                    </div>
                    <div className="meta">
                      {unitName(dataset, to)}{' '}
                      {toHas
                        ? `is set to ${unitName(dataset, toHas)} instead`
                        : 'has no S rank set'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="card">
        <h2>Unpaired</h2>
        {unpaired.length === 0 ? (
          <div className="empty">Everyone in the army has an S rank.</div>
        ) : (
          <div className="chiprow">
            {unpaired.map((u) => (
              <span className="chip" key={u.id}>
                {unitName(dataset as Dataset, u.characterId)}
              </span>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
