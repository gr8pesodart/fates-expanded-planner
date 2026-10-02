import { useEffect, useRef } from 'react'
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

/**
 * Swipe between pages: drags the element's content live (`--swipe-dx`, damped at the ends),
 * commits to the neighbouring page on release, or springs back. Pairs with TabPager or the Roster's
 * stat strips, which ease in from the release offset (`--swipe-from`).
 * animation starts from the release offset (`--swipe-from`).
 */
export function useSwipePager(ref: { current: HTMLElement | null }, index: number, count: number, onChange: (next: number) => void, enabled = true): void {
  const settle = (node: HTMLElement) => {
    delete node.dataset.dragging
    node.style.setProperty('--swipe-dx', '0px')
  }
  useHorizontalSwipe(ref, {
    onDrag(dx) {
      const node = ref.current
      if (!node) return
      const blocked = (dx > 0 && index === 0) || (dx < 0 && index === count - 1)
      holdMotion()
      node.dataset.dragging = ''
      node.style.setProperty('--swipe-dx', `${blocked ? dx / 4 : dx}px`)
    },
    onEnd(dx, velocity) {
      const node = ref.current
      if (!node) return
      const next = index + swipeDirection(dx, velocity)
      if (next !== index && next >= 0 && next < count) {
        node.style.setProperty('--swipe-from', `${dx}px`)
        window.setTimeout(() => node.style.removeProperty('--swipe-from'), 400)
        onChange(next)
      }
      settle(node)
      settleMotion()
    },
    onCancel() {
      if (ref.current) settle(ref.current)
      settleMotion()
    },
  }, enabled)
}
