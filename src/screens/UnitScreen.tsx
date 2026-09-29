import { Sprite } from '../components/Sprite'

export function UnitScreen({ unitId }: { unitId: string }) {
  return (
    <section className="card placeholder">
      <span className="kicker">Roster · Individual</span>
      <h2>{unitId === '@first' ? 'Unit' : unitId}</h2>
      <p className="muted">Stats, classes, skills and pair-up arrive in Milestone 3.</p>
      <Sprite label={unitId === '@first' ? 'Un' : unitId} size="lg" />
    </section>
  )
}
