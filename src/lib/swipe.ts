import { useEffect, useLayoutEffect, useRef } from 'react'
import { holdMotion, settleMotion } from './motion'

export interface SwipeHandlers {
  /** Horizontal offset while a horizontal drag is in progress. */
  onDrag(dx: number): void
  /** The drag ended; velocity is px/ms (negative = leftwards). */
  onEnd(dx: number, velocity: number): void
  /** The gesture turned out not to be ours (vertical scroll, or cancelled by the browser). */
  onCancel(): void
}

// iOS's own back gesture starts at the left screen edge; leave that strip to the system.
const EDGE = 24
const LOCK = 8
// Horizontal scrollers and form controls own their own horizontal gestures.
const IGNORE = 'input, select, textarea, .rail, .char-tabs, [data-swipe-ignore]'

/** A committed swipe: far enough, or a quick flick. */
export function swipeDirection(dx: number, velocity: number): -1 | 0 | 1 {
  if (Math.abs(dx) < 16) return 0
  if (Math.abs(dx) > 48 || Math.abs(velocity) > 0.3) return dx < 0 ? 1 : -1
  return 0
}

/**
 * Direction-locked horizontal swipe on touch pointers. Pair with `touch-action: pan-y` on the
 * element so vertical scrolling stays native (the browser cancels the pointer when it takes over).
 */
export function useHorizontalSwipe(ref: { current: HTMLElement | null }, handlers: SwipeHandlers, enabled = true): void {
  const latest = useRef(handlers)
  useEffect(() => {
    latest.current = handlers
  })
  useEffect(() => {
    const node = ref.current
    if (!node || !enabled) return
    let start: { id: number; x: number; y: number; t: number } | null = null
    let horizontal = false
    let lastX = 0
    let lastT = 0
    let velocity = 0

    const down = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || start) return
      if (event.clientX < EDGE || (event.target instanceof Element && event.target.closest(IGNORE))) return
      start = { id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp }
      horizontal = false
      lastX = event.clientX
      lastT = event.timeStamp
      velocity = 0
    }
    const move = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      if (!horizontal) {
        if (Math.abs(dy) > LOCK && Math.abs(dy) >= Math.abs(dx)) {
          start = null
          return
        }
        if (Math.abs(dx) < LOCK || Math.abs(dx) < Math.abs(dy) * 1.2) return
        horizontal = true
      }
      const dt = event.timeStamp - lastT
      if (dt > 0) velocity = (event.clientX - lastX) / dt
      lastX = event.clientX
      lastT = event.timeStamp
      latest.current.onDrag(dx)
    }
    const up = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return
      const dx = event.clientX - start.x
      const wasHorizontal = horizontal
      start = null
      horizontal = false
      if (wasHorizontal) latest.current.onEnd(dx, event.timeStamp - lastT > 80 ? 0 : velocity)
    }
    const cancel = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return
      const wasHorizontal = horizontal
      start = null
      horizontal = false
      if (wasHorizontal) latest.current.onCancel()
    }

    node.addEventListener('pointerdown', down)
    node.addEventListener('pointermove', move)
    node.addEventListener('pointerup', up)
    node.addEventListener('pointercancel', cancel)
    return () => {
      node.removeEventListener('pointerdown', down)
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', cancel)
    }
  }, [ref, enabled])
}

let lastRelease = { dx: 0, at: -Infinity }

/**
 * Where the last committed swipe let go, for content that re-centres on the new page and eases in
 * from there (the Roster's stat strips). 0 when the change didn't come from a swipe (a rail tap).
 */
export function releaseOffset(): number {
  return performance.now() - lastRelease.at < 300 ? lastRelease.dx : 0
}

/** Dragged targets get their own compositor layer (CSS `[data-dragging]`), so moving them repaints nothing. */
const markDragging = (targets: HTMLElement[]) => {
  for (const target of targets) target.toggleAttribute('data-dragging', true)
}

const offsetTo = (targets: HTMLElement[], offset: string) => {
  for (const target of targets) target.style.translate = offset
}

/**
 * Lets go of the drag: each target eases from its offset back to 0. A Web Animation rather than a CSS
 * transition, so content that remounts or re-centres on the new page (StatStrip) can clear the inline
 * offset itself and run its own animation without a transition fighting it.
 */
const release = (targets: HTMLElement[], ms: number) => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  for (const target of targets) {
    const offset = target.style.translate
    target.style.removeProperty('translate')
    target.removeAttribute('data-dragging')
    if (offset && offset !== '0px' && !reduced && target.isConnected) {
      target.animate({ translate: [offset, '0px'] }, { duration: ms, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
    }
  }
}

/** The TabPager's track, the default thing a swipe pager drags. */
export const PAGER_TRACK = ':scope > .pager > .pager-track'

/**
 * Swipe between pages: drags the `targets` inside the element live (an inline `translate`, damped at
 * the ends), commits to the neighbouring page on release, or springs back.
 *
 * Only the targets are written to, never the swipe surface: a custom property on the surface is
 * inherited by every node below it, so each pointermove restyled the whole page (thousands of nodes;
 * 100-200 ms a frame on a phone). `translate` isn't inherited and composes with the targets' own
 * `transform`, so their CSS keeps placing the page (TabPager transitions it) while the offset eases
 * out over `releaseMs`.
 */
export function useSwipePager(ref: { current: HTMLElement | null }, index: number, count: number, onChange: (next: number) => void, { enabled = true, targets = PAGER_TRACK, releaseMs = 380 }: { enabled?: boolean; targets?: string; releaseMs?: number } = {}): void {
  const dragged = useRef<HTMLElement[]>([])
  const fallback = useRef(0)
  const settle = () => {
    window.clearTimeout(fallback.current)
    release(dragged.current, releaseMs)
    dragged.current = []
  }
  // A committed swipe lets go once the new page is in the DOM (some owners navigate, which lands a
  // task later), so the page change and the release start on the same frame instead of springing back.
  useLayoutEffect(settle, [index, releaseMs])
  useHorizontalSwipe(ref, {
    onDrag(dx) {
      const node = ref.current
      if (!node) return
      if (!dragged.current.length) {
        holdMotion()
        dragged.current = [...node.querySelectorAll<HTMLElement>(targets)]
        markDragging(dragged.current)
      }
      const blocked = (dx > 0 && index === 0) || (dx < 0 && index === count - 1)
      offsetTo(dragged.current, `${blocked ? dx / 4 : dx}px`)
    },
    onEnd(dx, velocity) {
      const next = index + swipeDirection(dx, velocity)
      if (next !== index && next >= 0 && next < count) {
        lastRelease = { dx, at: performance.now() }
        fallback.current = window.setTimeout(settle, 500)
        onChange(next)
      } else {
        settle()
      }
      settleMotion()
    },
    onCancel() {
      settle()
      settleMotion()
    },
  }, enabled)
}
