export interface EmptyStateProps {
  kicker: string
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ kicker, title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <section className="card empty">
      <span className="kicker">{kicker}</span>
      <h3>{title}</h3>
      <p className="muted">{body}</p>
      {actionLabel && onAction ? (
        <button type="button" className="btn accent" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  )
}
