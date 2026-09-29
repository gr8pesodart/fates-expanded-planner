import type { CSSProperties } from 'react'

export interface GrowthSparkProps {
  values: number[]
  best?: number
  label?: string
}

export function GrowthSpark({ values, best = -1, label }: GrowthSparkProps) {
  return (
    <div className="spark" role="img" aria-label={label ?? 'growth sparkline'}>
      {values.map((value, index) => (
        <i
          key={index}
          className={index === best ? 'hi' : undefined}
          style={{ '--v': value } as CSSProperties}
        />
      ))}
    </div>
  )
}
