import { describe, expect, it } from 'vitest'
import { settleSpring, SPRING_OMEGA } from './spring'

describe('settleSpring', () => {
  it('starts at the release offset and ends at rest', () => {
    const spring = settleSpring(250, 0)
    expect(spring.values[0]).toBe(250)
    expect(spring.values.at(-1)).toBe(0)
    expect(spring.offsets[0]).toBe(0)
    expect(spring.offsets.at(-1)).toBe(1)
    expect(spring.values).toHaveLength(spring.offsets.length)
  })

  it('leaves at the finger speed', () => {
    const spring = settleSpring(250, -1.5)
    const step = spring.duration / (spring.values.length - 1)
    const speed = (spring.values[1] - spring.values[0]) / step
    expect(speed).toBeCloseTo(-1.5, 0)
  })

  it('a slow release starts slowly instead of jumping', () => {
    const spring = settleSpring(250, 0)
    const first = 250 - spring.values[1]
    const second = spring.values[1] - spring.values[2]
    // Picks up speed from rest (the old fixed ease-out jumped 24-43 px in its first frame).
    expect(first).toBeLessThan(10)
    expect(second).toBeGreaterThan(first)
  })

  it('never overshoots rest, even for a hard flick', () => {
    for (const v0 of [-0.5, -2, -8]) {
      const spring = settleSpring(300, v0)
      expect(Math.min(...spring.values)).toBeGreaterThanOrEqual(0)
    }
    expect(Math.max(...settleSpring(-300, 8).values)).toBeLessThanOrEqual(0)
  })

  it('a speed away from rest carries on briefly, then returns', () => {
    const spring = settleSpring(40, 0.6)
    expect(Math.max(...spring.values)).toBeGreaterThan(40)
    expect(spring.values.at(-1)).toBe(0)
  })

  it('settles a full page from rest in about half a second', () => {
    const { duration } = settleSpring(390, 0)
    expect(duration).toBeGreaterThan(400)
    expect(duration).toBeLessThan(800)
    expect(SPRING_OMEGA).toBeGreaterThan(0)
  })
})
