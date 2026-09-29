import type { CompareTrayVM } from '../viewmodels/types'
import { Sprite } from './Sprite'

export function CompareTray({ vm }: { vm: CompareTrayVM }) {
  if (vm.pinnedCount < 2) {
    return (
      <div className="tray slim">
        <span className="grab" aria-hidden="true" />
        <div className="trayhead">
          <b>Compare · {vm.pinnedCount} pinned</b>
          <button type="button" className="chipbtn" onClick={vm.onClear}>
            <span className="chip traybtn">Clear</span>
          </button>
        </div>
        <p className="trayhint">Pin one more unit to line up growths, class offers and the child preview.</p>
      </div>
    )
  }

  const statRows: { key: string; index: number }[] = [
    { key: 'STR', index: 1 },
    { key: 'SPD', index: 4 },
  ]
  const bestValue = (index: number): number => Math.max(...vm.columns.map((column) => column.growths[index]))

  return (
    <div className="tray" data-testid="compare-tray">
      <span className="grab" aria-hidden="true" />
      <div className="trayhead">
        <b>Compare · {vm.pinnedCount} pinned</b>
        <div className="trayactions">
          <button type="button" className="chipbtn" onClick={vm.onClear}>
            <span className="chip traybtn">Clear</span>
          </button>
        </div>
      </div>
      <div className="cmp" style={{ ['--cols' as string]: vm.columns.length }}>
        <span />
        {vm.columns.map((column) => (
          <span className="h" key={column.id}>
            <button type="button" className="cmpwho" onClick={() => vm.onOpenUnit(column.id)}>
              <Sprite label={column.name} src={column.sprite.src} tone={column.sprite.tone} size="sm" />
              {column.isChildPreview ? `→ ${column.name}` : column.name}
            </button>
            {column.isChildPreview ? null : (
              <button type="button" className="unpin" aria-label={`Unpin ${column.name}`} onClick={() => vm.onUnpin(column.id)}>
                ×
              </button>
            )}
          </span>
        ))}
        {statRows.map((row) => (
          <span className="cmprow" key={row.key}>
            <span className="k">{row.key}</span>
            {vm.columns.map((column) => (
              <span key={column.id} className={column.growths[row.index] === bestValue(row.index) ? 'best' : undefined}>
                {column.growths[row.index]}
              </span>
            ))}
          </span>
        ))}
        <span className="cmprow">
          <span className="k">OFFER</span>
          {vm.columns.map((column) => (
            <span key={column.id}>{column.offer}</span>
          ))}
        </span>
        <span className="cmprow">
          <span className="k">SKILL</span>
          {vm.columns.map((column) => (
            <span key={column.id}>{column.personalSkill}</span>
          ))}
        </span>
        {vm.child ? (
          <span className="cmprow">
            <span className="k">CHILD</span>
            {vm.columns.map((column) =>
              column.isChildPreview ? (
                <span key={column.id} className="num">
                  {vm.child?.growths.join(' ')}
                </span>
              ) : (
                <span key={column.id} className="muted">
                  —
                </span>
              ),
            )}
          </span>
        ) : null}
      </div>
    </div>
  )
}
