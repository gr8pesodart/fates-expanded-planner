import { Chip } from '../components/Chip'
import { DuoCard, PreviewSlotRow } from '../components/DuoCard'
import { usePreviewVM } from '../viewmodels/usePreviewVM'

export function PreviewScreen() {
  const vm = usePreviewVM()

  if (vm.shareError) {
    return (
      <section className="previewscreen" data-testid="preview">
        <header className="previewhead">
          <div>
            <span className="kicker">Shared plan</span>
            <h2>Invalid share link</h2>
            <p className="muted">This link is incomplete or uses a plan format this version cannot read.</p>
          </div>
        </header>
        <div className="warncard">
          <span className="chip warn">!</span>
          <span className="warntext">{vm.shareError}</span>
        </div>
        <a className="btn ghost" href="#/preview">Open your saved preview</a>
      </section>
    )
  }

  return (
    <section className="previewscreen" data-testid="preview">
      <header className="previewhead">
        <div>
          <span className="kicker">{vm.shareMode ? 'Preview · shared read-only' : 'Preview · read-only'}</span>
          <h2>{vm.runPill.runName}</h2>
          <p className="muted">
            {vm.runPill.routeLabel} · {vm.duoCount * 2 + vm.soloCount + vm.unassignedCount} units · permanent decisions
            stay full-strength, planned class and skills fade.
          </p>
        </div>
        <div className="previewactions">
          <button type="button" className="btn ghost" onClick={vm.onCopyLink}>
            {vm.copied ? 'Copied ✓' : 'Copy share link'}
          </button>
          <button type="button" className="btn ghost" onClick={vm.onPrint}>
            Print
          </button>
        </div>
      </header>

      {vm.loading ? (
        <p className="muted">Loading the selected game build…</p>
      ) : (
        <>
          <p className="group-h">Duos · {vm.duoCount}</p>
          {vm.duos.map((duo) => (
            <DuoCard key={duo.id} vm={duo} />
          ))}

          <p className="group-h">Solo · {vm.soloCount}</p>
          {vm.solos.map((slot) => (
            <div className="duo solo" key={slot.id}>
              <PreviewSlotRow slot={slot} />
            </div>
          ))}

          <p className="group-h">Unassigned · {vm.unassignedCount}</p>
          <div className="unassigned">
            {vm.unassigned.map((slot) => (
              <button type="button" key={slot.id} className="chipbtn" onClick={slot.onOpen}>
                <Chip>{slot.name}</Chip>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
