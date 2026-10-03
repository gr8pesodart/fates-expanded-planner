import { useEffect, useLayoutEffect, useRef } from 'react'
import { holdMotion, settleMotion } from './motion'
import { settleSpring } from './spring'
import type { SpringFrames } from './spring'

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
const VELOCITY_WINDOW = 80
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
    // Recent [x, time] samples: release speed is averaged over the last VELOCITY_WINDOW ms, not the
    // last two events (single-event deltas swing wildly with touch sampling).
    let samples: [number, number][] = []
    const velocity = () => {
      const [x0, t0] = samples[0]
      const [x1, t1] = samples[samples.length - 1]
      return t1 > t0 ? (x1 - x0) / (t1 - t0) : 0
    }

    const down = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || start) return
      if (event.clientX < EDGE || (event.target instanceof Element && event.target.closest(IGNORE))) return
      start = { id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp }
      horizontal = false
      samples = [[event.clientX, event.timeStamp]]
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
      samples.push([event.clientX, event.timeStamp])
      while (samples.length > 2 && event.timeStamp - samples[0][1] > VELOCITY_WINDOW) samples.shift()
      latest.current.onDrag(dx)
    }
    const up = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return
      const dx = event.clientX - start.x
      const wasHorizontal = horizontal
      start = null
      horizontal = false
      // A finger that stopped before lifting has no speed left.
      const still = event.timeStamp - samples[samples.length - 1][1] > VELOCITY_WINDOW
      if (wasHorizontal) latest.current.onEnd(dx, still ? 0 : velocity())
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
 * Page changes that don't come from a swipe (rail taps) slide with these: TabPager's CSS transition
 * (`.pager-track` in components.css - keep the literal copy equal) and StatStrip's ease-in.
 */
export const SETTLE_MS = 480
export const SETTLE_EASE = 'cubic-bezier(0.33, 1, 0.68, 1)'

let settling = false

/**
 * True between a committed swipe's release and its hand-over to the new page: content that would
 * animate its own page change (StatStrip) leaves it to the swipe, which is already moving it.
 */
export function swipeSettling(): boolean {
  return settling
}

/** Dragged targets get their own compositor layer (CSS `[data-dragging]`), so moving them repaints nothing. */
const markDragging = (targets: HTMLElement[]) => {
  for (const target of targets) target.toggleAttribute('data-dragging', true)
}

const offsetTo = (targets: HTMLElement[], offset: number) => {
  for (const target of targets) target.style.transform = `translateX(${offset}px)`
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The animated drag offset right now (px), for picking a moving page up mid-flight. */
const currentOffset = (target: HTMLElement): number => {
  const value = getComputedStyle(target).transform
  return value === 'none' ? 0 : new DOMMatrixReadOnly(value).m41
}

const timelineNow = (): number | null => {
  const now = document.timeline.currentTime
  return typeof now === 'number' ? now : null
}

/**
 * Runs a sampled spring on `transform`, around `base` px, from `startTime` on the document timeline
 * (default: this frame). Setting the start time - rather than letting the animation wait for its first
 * frame - means it runs from the very next frame, and the hand-over to the new page can reuse the
 * first spring's start time so both describe the same instant. `hold` keeps the last frame until the
 * spring is replaced.
 */
const play = (target: HTMLElement, spring: SpringFrames, base: number, { startTime = timelineNow(), hold = false }: { startTime?: number | null; hold?: boolean } = {}): Animation => {
  const keyframes = spring.values.map((value, i) => ({ transform: `translateX(${base + value}px)`, offset: spring.offsets[i] }))
  const animation = target.animate(keyframes, { duration: spring.duration, fill: hold ? 'forwards' : 'none' })
  if (startTime !== null) animation.startTime = startTime
  return animation
}

/** Cancels this hook's springs on a target (CSS transitions, e.g. a rail tap's slide, are left alone). */
const stop = (target: HTMLElement) => {
  for (const animation of target.getAnimations()) {
    if (!(animation instanceof CSSTransition) && !(animation instanceof CSSAnimation)) animation.cancel()
  }
}

/** The TabPager's track, the default thing a swipe pager drags. */
export const PAGER_TRACK = ':scope > .pager > .pager-track'

/**
 * One page's width for a target, in px: its parent's width plus its own flex gap (TabPager track:
 * the viewport; Roster strip: the strip, + --strip-gap between tables). Read once per release.
 */
const pageSize = (target: HTMLElement): number => {
  const gap = parseFloat(getComputedStyle(target).columnGap)
  return (target.parentElement?.clientWidth ?? 0) + (Number.isFinite(gap) ? gap : 0)
}

/**
 * Swipe between pages: drags the `targets` inside the element live (an inline `transform`, damped at
 * the ends), commits to the neighbouring page on release, or springs back.
 *
 * Only the targets are written to, never the swipe surface: a custom property on the surface is
 * inherited by every node below it, so each pointermove restyled the whole page (thousands of nodes;
 * 100-200 ms a frame on a phone). Drag and release move `transform`, never `translate`: WebKit
 * pre-paints the whole path of a transform animation, but with `translate` an incoming page was only
 * painted as far as the screen edge at release and showed black beyond it until the main thread
 * (busy with the owner's re-render) caught up (owner's iPhone recording, Profile -> Stats).
 * `transform` isn't inherited and composes with the targets' own
 * page position (the `translate` property: TabPager's inline style, StatStrip's CSS).
 *
 * Release: a spring (lib/spring.ts) starting at the finger's speed, playing the moment the finger
 * lifts - not when React has rendered the new page (the Chart's render showed as a stutter). It aims
 * at the new page in the old layout; when the owner commits the new index, the same spring is
 * swapped for one around the new layout sharing its start time, so the motion carries straight on.
 */
export function useSwipePager(ref: { current: HTMLElement | null }, index: number, count: number, onChange: (next: number) => void, { enabled = true, targets = PAGER_TRACK }: { enabled?: boolean; targets?: string } = {}): void {
  const dragged = useRef<HTMLElement[]>([])
  const carry = useRef(0)
  const flight = useRef<{ spring: SpringFrames; startTime: number | null; targets: HTMLElement[] } | null>(null)
  const fallback = useRef(0)

  // The new page is in the DOM: continue the release around it.
  useLayoutEffect(() => {
    const current = flight.current
    if (!current) return
    flight.current = null
    settling = false
    window.clearTimeout(fallback.current)
    // Its page position just jumped by one page; it mustn't transition there as well.
    for (const target of current.targets) {
      stop(target)
      target.style.transition = 'none'
    }
    void getComputedStyle(current.targets[0] ?? document.body).translate
    for (const target of current.targets) {
      target.style.removeProperty('transition')
      if (target.isConnected && !reducedMotion()) play(target, current.spring, 0, { startTime: current.startTime })
    }
  }, [index])

  const springBack = (list: HTMLElement[], from: number, velocity: number) => {
    const spring = settleSpring(from, velocity)
    for (const target of list) {
      target.style.removeProperty('transform')
      target.removeAttribute('data-dragging')
      if (!reducedMotion()) play(target, spring, 0)
    }
    settleMotion(spring.duration)
  }

  useHorizontalSwipe(ref, {
    onDrag(dx) {
      const node = ref.current
      if (!node) return
      if (!dragged.current.length) {
        holdMotion()
        dragged.current = [...node.querySelectorAll<HTMLElement>(targets)]
        // Caught mid-settle: pick the page up where it is rather than snapping it to rest.
        const first = dragged.current[0]
        carry.current = first && !flight.current ? currentOffset(first) : 0
        for (const target of dragged.current) stop(target)
        markDragging(dragged.current)
      }
      const offset = carry.current + dx
      const blocked = (offset > 0 && index === 0) || (offset < 0 && index === count - 1)
      offsetTo(dragged.current, blocked ? offset / 4 : offset)
    },
    onEnd(dx, velocity) {
      const list = dragged.current
      dragged.current = []
      const offset = carry.current + dx
      const dir = swipeDirection(offset, velocity)
      const next = index + dir
      const blocked = (offset > 0 && index === 0) || (offset < 0 && index === count - 1)
      if (next === index || next < 0 || next >= count || !list.length) {
        springBack(list, blocked ? offset / 4 : offset, blocked ? velocity / 4 : velocity)
        return
      }
      // Aim at the neighbouring page: it sits one page away, so the spring's rest is there.
      const page = pageSize(list[0])
      const spring = settleSpring(offset + dir * page, velocity)
      const startTime = timelineNow()
      for (const target of list) {
        target.style.removeProperty('transform')
        target.removeAttribute('data-dragging')
        if (!reducedMotion()) play(target, spring, -dir * page, { startTime, hold: true })
      }
      flight.current = { spring, startTime, targets: list }
      settling = true
      // If the owner never moves to the new page, don't leave it parked there.
      fallback.current = window.setTimeout(() => {
        if (!flight.current) return
        flight.current = null
        settling = false
        const from = list[0] ? currentOffset(list[0]) : 0
        for (const target of list) stop(target)
        springBack(list, from, 0)
      }, 1000)
      settleMotion(spring.duration)
      // A new animation only starts once a frame is painted, and the owner's re-render would otherwise
      // run in this same task (React flushes pointer events synchronously) and hold the page still
      // until it finished. Let the spring start first; the compositor keeps it moving while React works.
      requestAnimationFrame(() => window.setTimeout(() => onChange(next)))
    },
    onCancel() {
      const list = dragged.current
      dragged.current = []
      springBack(list, list[0] ? currentOffset(list[0]) : 0, 0)
    },
  }, enabled)
}
