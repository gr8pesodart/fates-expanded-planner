import type { StatRowVM } from '../viewmodels/types'

export interface StatBarsProps {
  rows: StatRowVM[]
  showCaps?: boolean
}

export function StatBars({ rows, showCaps = true }: StatBarsProps) {
  return (
    <div className="stats">
      {rows.map((row) => (
        <div className="stat" key={row.key}>
          <span className="k">{row.label}</span>
          <span className="v">
            {row.value}
            {row.delta ? <span className="delta">+{row.delta}</span> : null}
          </span>
          <span className="bar">
            <b style={{ width: `${row.personalGrowth}%` }} />
            <u style={{ width: `${row.classGrowth}%` }} />
          </span>
          {showCaps ? <span className="cap">{row.cap}</span> : <span />}
        </div>
      ))}
    </div>
  )
}
