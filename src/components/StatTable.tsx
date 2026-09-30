import type { CSSProperties } from 'react'
import { STAT_TABLE_KEYS, STAT_TABLE_LABELS } from '../data/types'
import type { StatRow } from '../logic/lenses'
import { formatCell } from '../logic/lenses'

export function StatTable({ row, signed = false, inverse = false, label, referenceRows }: { row: StatRow; signed?: boolean; inverse?: boolean; label?: string; referenceRows?: StatRow[] }) {
  return (
    <div className={inverse ? 'stat-table inverse' : 'stat-table'} role="table" aria-label={label}>
      <div className="stat-row" role="row">
        {STAT_TABLE_KEYS.map((key) => (
          <span key={key} className="stat-head" role="columnheader">{STAT_TABLE_LABELS[key]}</span>
        ))}
      </div>
      <div className="stat-row" role="row">
        {STAT_TABLE_KEYS.map((key, index) => {
          const value = row[index] ?? null
          const tone = signed && value !== null && value !== 0 ? (value > 0 ? 'up' : 'down') : undefined
          const reference = referenceRows?.map((candidate) => candidate[index]).filter((item): item is number => item !== null && item !== undefined) ?? []
          const colors = value === null || reference.length < 2 ? undefined : statTone(value, reference)
          return <span key={key} className={`stat-val${colors ? ' colorized' : ''}${value === null ? ' empty' : ''}`} data-tone={tone} style={colors} role="cell">{formatCell(value, signed)}</span>
        })}
      </div>
    </div>
  )
}

function statTone(value: number, values: number[]): CSSProperties {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const mean = values.reduce((sum, item) => sum + item, 0) / values.length
  const stop = value <= mean ? (mean === min ? 1 : Math.max(0, Math.min(1, (value - min) / (mean - min)))) : (max === mean ? 0 : Math.max(0, Math.min(1, (value - mean) / (max - mean))))
  const color = value <= mean
    ? `color-mix(in oklab, var(--stat-low) ${Math.round((1 - stop) * 100)}%, var(--stat-mid))`
    : `color-mix(in oklab, var(--stat-mid) ${Math.round((1 - stop) * 100)}%, var(--stat-high))`
  return { color }
}
