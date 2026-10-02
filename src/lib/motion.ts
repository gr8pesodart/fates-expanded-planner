/**
 * App-wide "something is sliding" flag. Swipes and pager moves hold it; sprite animations pause while
 * it's held, so a swipe doesn't re-render dozens of animated sprites every frame (owner, v3.4: swipes
 * lagged with many sprites animating).
 */
let holds = 0
let release: number | undefined
const listeners = new Set<() => void>()

const notify = () => listeners.forEach((listener) => listener())

export function motionPaused(): boolean {
  return holds > 0
}

export function onMotionChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Hold the pause while a drag is under way (call `settleMotion` when it ends). */
export function holdMotion(): void {
  window.clearTimeout(release)
  if (holds === 0) {
    holds = 1
    notify()
  }
}

/** Keep the pause for the length of the settling slide, then let sprites move again. */
export function settleMotion(ms = 420): void {
  holdMotion()
  release = window.setTimeout(() => {
    holds = 0
    notify()
  }, ms)
}
