import type { WarningVM } from '../viewmodels/types'

export function WarningCard({ warning }: { warning: WarningVM }) {
  return (
    <div className="card warncard">
      <span className="chip warn">!</span>
      <span className="warntext">{warning.message}</span>
      {warning.actionLabel && warning.onAction ? (
        <button type="button" className="linkish" onClick={warning.onAction}>
          {warning.actionLabel}
        </button>
      ) : null}
    </div>
  )
}
