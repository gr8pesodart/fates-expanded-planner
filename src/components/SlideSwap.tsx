import { useState } from 'react'
import type { ReactNode } from 'react'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Swaps its content with a horizontal slide when `index` changes: the old content leaves towards
 * one side while the new enters from the other (higher index = content moves left). A parent can
 * drag the current content live through the `--swipe-dx` custom property, and hand the release
 * offset to the exit animation through `--swipe-from`.
 */
export function SlideSwap({ index, children, className = '' }: { index: number; children: ReactNode; className?: string }) {
  // The content last rendered, so the outgoing layer keeps showing what was on screen
  // (React's "storing information from previous renders" pattern: set during render, on change only).
  const [shown, setShown] = useState<{ index: number; node: ReactNode }>({ index, node: children })
  const [leaving, setLeaving] = useState<{ index: number; node: ReactNode; dir: 1 | -1 } | null>(null)
  if (index !== shown.index) {
    setLeaving(reducedMotion() ? null : { index: shown.index, node: shown.node, dir: index > shown.index ? 1 : -1 })
    setShown({ index, node: children })
  } else if (children !== shown.node) {
    setShown({ index, node: children })
  }
  return (
    <div className={`slide-swap ${className}`}>
      {leaving ? (
        <div
          key={leaving.index}
          className="slide-layer out"
          data-dir={leaving.dir}
          aria-hidden="true"
          inert
          onAnimationEnd={(event) => { if (event.target === event.currentTarget) setLeaving(null) }}
        >
          {leaving.node}
        </div>
      ) : null}
      <div key={index} className="slide-layer in" data-dir={leaving?.dir}>{children}</div>
    </div>
  )
}
