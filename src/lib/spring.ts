/**
 * Release physics for swipes: a critically damped spring (no bounce) from the page's offset at
 * release back to rest, starting at the finger's speed - so letting go continues the drag instead of
 * restarting it at a fixed curve (owner, v3.4: a fixed ease-out still felt "snappy" after a slow drag
 * and sluggish after a flick). Sampled into keyframes so a Web Animation runs it on the compositor.
 */

/** Stiffness, 1/ms. From rest a full page settles in ~0.5 s; most of the travel is in the first ~250 ms. */
export const SPRING_OMEGA = 0.016

const FRAME = 1000 / 60
const REST = 0.5
const MAX_MS = 1200

export interface SpringFrames {
  /** Offset from rest in px at each sample; the last is 0. */
  values: number[]
  /** 0..1, one per value (WAAPI keyframe offsets). */
  offsets: number[]
  duration: number
}

/**
 * x(t) = (x0 + (v + ωx0)t)e^(-ωt): starts at `x0` px from rest moving at `v0` px/ms. A flick toward
 * rest faster than ω·|x0| would carry the page past it (critically damped springs overshoot once),
 * so that speed is capped - the page then decays straight in.
 */
export function settleSpring(x0: number, v0: number, omega = SPRING_OMEGA): SpringFrames {
  const towardRest = x0 !== 0 && Math.sign(v0) === -Math.sign(x0)
  const v = towardRest ? Math.sign(v0) * Math.min(Math.abs(v0), omega * Math.abs(x0)) : v0
  const at = (t: number) => (x0 + (v + omega * x0) * t) * Math.exp(-omega * t)
  let duration = FRAME
  while (duration < MAX_MS && (Math.abs(at(duration)) > REST || Math.abs(at(duration + FRAME)) > REST)) duration += FRAME
  const steps = Math.max(1, Math.round(duration / FRAME))
  const values: number[] = []
  const offsets: number[] = []
  for (let step = 0; step <= steps; step += 1) {
    offsets.push(step / steps)
    values.push(step === steps ? 0 : at((duration * step) / steps))
  }
  return { values, offsets, duration }
}
