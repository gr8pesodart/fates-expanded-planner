import type { RunPillVM } from '../viewmodels/types'

export function RunPill({ vm }: { vm: RunPillVM }) {
  return (
    <button type="button" className="runpill" onClick={vm.onOpenRuns} aria-label={`Run ${vm.runName} — open runs and setup`}>
      <span className="crest" aria-hidden="true">
        {vm.crest}
      </span>
      <b>{vm.runName}</b>
      <span className="meta">
        <span className="chip">{vm.modpackLabel}</span>
        {vm.dlc ? <span className="chip accent">DLC</span> : <span className="chip">No DLC</span>}
        {vm.readOnly ? <span className="chip">Read-only</span> : null}
      </span>
    </button>
  )
}
