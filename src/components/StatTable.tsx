import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { STAT_TABLE_KEYS, STAT_TABLE_LABELS } from '../data/types'
import type { StatRow } from '../logic/lenses'
import { formatCell } from '../logic/lenses'
import { SETTLE_EASE, SETTLE_MS, swipeSettling } from '../lib/swipe'

export interface StatTableProps {
  row: StatRow
  /** Greyed values without colouring (e.g. an expected final row that never leaves a base class). */
  muted?: boolean
  signed?: boolean
  inverse?: boolean
  label?: string
  referenceRows?: StatRow[]
  /** Parent-inheritance tables have no Mov (the Parents design drops the column). */
  mov?: boolean
}

/** The Roster's lens strip: the neighbouring lenses' tables sit either side, ready for a swipe. */
export interface StatSlide {
  index: number
  prev?: StatTableProps
  next?: StatTableProps
}

export function StatTable({ slide, ...props }: StatTableProps & { slide?: StatSlide }) {
  return slide ? <StatStrip slide={slide} current={props} /> : <Table {...props} />
}

function Table({ row, signed = false, inverse = false, muted = false, label, referenceRows, mov = true }: StatTableProps) {
  const keys = mov ? STAT_TABLE_KEYS : STAT_TABLE_KEYS.filter((key) => key !== 'mov')
  const columns: CSSProperties | undefined = mov ? undefined : { gridTemplateColumns: `repeat(${keys.length}, minmax(0, 1fr))` }
  return (
    <div className={['stat-table', inverse ? 'inverse' : '', muted ? 'muted' : ''].filter(Boolean).join(' ')} role="table" aria-label={label}>
      <div className="stat-row" role="row" style={columns}>
        {keys.map((key) => (
          <span key={key} className="stat-head" role="columnheader">{STAT_TABLE_LABELS[key]}</span>
        ))}
      </div>
      <div className="stat-row" role="row" style={columns}>
        {keys.map((key, index) => {
          const value = row[index] ?? null
          const tone = signed && value !== null && value !== 0 ? (value > 0 ? 'up' : 'down') : undefined
          const reference = referenceRows?.map((candidate) => candidate[index]).filter((item): item is number => item !== null && item !== undefined) ?? []
          const colors = muted || value === null || reference.length < 2 ? undefined : statTone(value, reference)
          return <span key={key} className={`stat-val${colors ? ' colorized' : ''}${value === null ? ' empty' : ''}`} data-tone={tone} style={colors} role="cell">{formatCell(value, signed)}</span>
        })}
      </div>
    </div>
  )
}

/**
 * Previous / current / next lens side by side. The track follows the Roster's live drag (an inline
 * `transform`). Pages are keyed by lens, so a lens change reuses the two tables already built and only
 * adds the newly exposed neighbour (remounting all three in every row stalled the swipe's release).
 * After a swipe the swipe's own spring keeps moving the track; a rail tap slides it in here.
 */
function StatStrip({ slide, current }: { slide: StatSlide; current: StatTableProps }) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [shown, setShown] = useState({ index: slide.index, dir: 0 })
  if (slide.index !== shown.index) setShown({ index: slide.index, dir: slide.index > shown.index ? 1 : -1 })
  useLayoutEffect(() => {
    const track = trackRef.current
    // A swipe is already carrying the track to this lens (useSwipePager hands its spring over).
    if (!track || !shown.dir || swipeSettling()) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // A rail tap: the new lens's table sat one page (track width + --strip-gap) to that side.
    // In % so no row has to measure itself mid-commit.
    track.animate({ transform: [`translateX(calc(${shown.dir} * (100% + var(--strip-gap))))`, 'translateX(0px)'] }, { duration: SETTLE_MS, easing: SETTLE_EASE })
  }, [shown])
  const pages = [
    { lens: slide.index - 1, props: slide.prev },
    { lens: slide.index, props: current },
    { lens: slide.index + 1, props: slide.next },
  ]
  return (
    <div className="stat-strip">
      <div ref={trackRef} className="stat-strip-track">
        {pages.map(({ lens, props }) => {
          const side = lens !== slide.index
          return (
            <div key={lens} className="stat-strip-page" aria-hidden={side || undefined} inert={side}>
              {props ? <Table {...props} /> : null}
            </div>
          )
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
