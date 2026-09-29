import { STAT_KEYS, STAT_LABELS } from '../data/types'
import type { StatRow } from '../logic/lenses'
import { formatCell } from '../logic/lenses'

export function StatTable({ row, signed = false, inverse = false, label }: { row: StatRow; signed?: boolean; inverse?: boolean; label?: string }) {
  return (
    <div className={inverse ? 'stat-table inverse' : 'stat-table'} role="table" aria-label={label}>
      <div className="stat-row" role="row">
        {STAT_KEYS.map((key) => (
          <span key={key} className="stat-head" role="columnheader">{STAT_LABELS[key]}</span>
        ))}
      </div>
      <div className="stat-row" role="row">
        {STAT_KEYS.map((key, index) => {
          const value = row[index] ?? null
          const tone = signed && value !== null && value !== 0 ? (value > 0 ? 'up' : 'down') : undefined
          return (
            <span key={key} className="stat-val" data-tone={tone} role="cell">{formatCell(value, signed)}</span>
          )
        })}
      </div>
    </div>
  )
}
