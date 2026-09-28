import { STAT_KEYS, STAT_LABELS } from '../data/types'

interface StatGridProps {
  values: number[]
  suffix?: string
  /** Highlight the strongest value in the row (optional). */
  emphasizeMax?: boolean
}

export function StatGrid({ values, suffix = '', emphasizeMax = false }: StatGridProps) {
  const max = emphasizeMax ? Math.max(...values) : null
  return (
    <div className="statgrid">
      {STAT_KEYS.map((key, index) => {
        const value = values[index]
        const isMax = emphasizeMax && max !== null && value === max && values.some((v) => v !== value)
        return (
          <div className={`statcell ${isMax ? 'statcell--max' : ''}`} key={key}>
            <span className="statcell__label">{STAT_LABELS[key]}</span>
            <span className="statcell__value">
              {value}
              {suffix}
            </span>
          </div>
        )
      })}
    </div>
  )
}
