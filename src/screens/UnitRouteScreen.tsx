export function UnitRouteScreen({ unitId }: { unitId: string }) {
  return (
    <section className="card placeholder">
      <span className="kicker">Class route</span>
      <h2>{unitId === '@first' ? 'Unit' : unitId} · route</h2>
      <p className="muted">The seal timeline arrives in Milestone 4.</p>
    </section>
  )
}
