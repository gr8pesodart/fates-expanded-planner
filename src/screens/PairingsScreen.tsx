import { Sprite } from '../components/Sprite'

const UNITS = [
  { id: 'PID_リョウマ', label: 'Ryoma' },
  { id: 'PID_カミラ', label: 'Camilla' },
  { id: 'PID_シノノメ', label: 'Shiro' },
  { id: 'PID_アクア', label: 'Azura' },
]

const SKILLS = [
  { id: 131, label: 'Aggressor' },
  { id: 39, label: 'Vantage' },
  { id: 57, label: 'Duelist\u2019s Blow' },
  { id: 24, label: 'Rally Speed' },
]

export function PairingsScreen() {
  return (
    <section className="card placeholder">
      <span className="kicker">Roster · Pairings</span>
      <h2>Pairings lens</h2>
      <p className="muted">Unit grid, compare tray and partner picker arrive in Milestone 2.</p>
      <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center' }}>
        {UNITS.map((unit) => (
          <Sprite key={unit.id} kind="unit" id={unit.id} label={unit.label} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center' }}>
        {SKILLS.map((skill) => (
          <Sprite key={skill.id} kind="skill" id={skill.id} label={skill.label} size="sm" />
        ))}
        <Sprite kind="class" id={33} label="Samurai (M)" size="sm" />
        <Sprite kind="class" id={31} label="Swordmaster (M)" size="sm" />
      </div>
    </section>
  )
}
