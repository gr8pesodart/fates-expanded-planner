export function SetupScreen() {
  return (
    <section className="card placeholder">
      <span className="kicker">Setup</span>
      <h2>Run setup</h2>
      <p className="muted">
        Modpack, DLC, route and run name land in Milestone 1. This screen is the shell placeholder.
      </p>
      <div style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap' }}>
        <span className="chip accent">UGF 2.5.2</span>
        <span className="chip">DLC on</span>
        <span className="chip">Revelation</span>
      </div>
    </section>
  )
}
