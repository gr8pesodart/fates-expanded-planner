import { usePlanner } from '../app/plannerContext'
import { useUi } from '../app/ui'
import type { RosterEntry } from '../app/selectors'
import { useSortedRoster } from '../app/selectors'
import { ClassSprite, SkillIcon } from '../components/art'
import { EditButton, StarButton } from '../components/controls'
import { Icon } from '../components/icons'
import { chartCards } from '../logic/chart'
import { swapPair, toggleFavourite } from '../logic/relationships'
import { navigate } from '../lib/router'

export function ChartScreen() {
  const { rosterLens, rosterSort } = useUi()
  const { run, readOnly, mutate } = usePlanner()
  const { entries } = useSortedRoster(rosterLens, rosterSort)
  const byId = new Map(entries.map((entry) => [entry.unitId, entry]))
  const cards = chartCards(entries.map((entry) => entry.unitId), run)
  return (
    <section className="screen chart" aria-labelledby="chart-title">
      <div className="screen-head">
        <h1 id="chart-title" className="screen-title">Chart</h1>
        {readOnly ? <span className="badge">Shared · read-only</span> : null}
      </div>
      <ul className="chart-list">
        {cards.map((card) => {
          if (card.kind === 'solo') {
            const entry = byId.get(card.unitId)
            return entry ? <li key={card.unitId} className="chart-card"><ChartRow entry={entry} /></li> : null
          }
          const front = byId.get(card.front)
          const back = byId.get(card.back)
          if (!front || !back) return null
          return (
            <li key={`${card.front}+${card.back}`} className="chart-card pair">
              <ChartRow entry={front} />
              <button
                type="button"
                className="swap-btn"
                aria-label={`Swap ${front.name} and ${back.name}`}
                disabled={readOnly}
                onClick={() => mutate((next) => swapPair(next, card.front))}
              >
                <Icon name="swap" size={20} />
              </button>
              <ChartRow entry={back} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ChartRow({ entry }: { entry: RosterEntry }) {
  const { dataset, readOnly, mutate } = usePlanner()
  const { ctx, name, unitId } = entry
  const classDef = dataset.classesById.get(ctx.currentClassId)
  const skills = ctx.plan.skills.filter((id): id is number => id !== null)
  return (
    <div className="chart-row">
      <div className="roster-id">
        <ClassSprite unitId={unitId} classId={ctx.currentClassId} name={classDef?.name ?? 'Class'} size={24} tile />
        <span className="unit-name">{name}</span>
        <StarButton on={entry.favourite} name={name} disabled={readOnly} onToggle={() => mutate((run) => toggleFavourite(run, unitId))} />
      </div>
      <div className="chart-skills">
        {skills.map((id) => (
          <SkillIcon key={id} skillId={id} name={dataset.skillsById.get(id)?.name ?? 'Skill'} size={20} />
        ))}
        {readOnly ? null : <EditButton size={20} label={`Open ${name}`} onClick={() => navigate({ name: 'unit', unitId, tab: 'profile' })} />}
      </div>
    </div>
  )
}
