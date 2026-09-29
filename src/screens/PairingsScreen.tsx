import { Sprite } from '../components/Sprite'

export function PairingsScreen() {
  return (
    <section className="card placeholder">
      <span className="kicker">Roster · Pairings</span>
      <h2>Pairings lens</h2>
      <p className="muted">Unit grid, compare tray and partner picker arrive in Milestone 2.</p>
      <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center' }}>
        <Sprite label="Ryoma" tone="hoshido" />
        <Sprite label="Camilla" tone="nohr" />
        <Sprite label="Shiro" />
        <Sprite label="Azura" />
      </div>
    </section>
  )
}
