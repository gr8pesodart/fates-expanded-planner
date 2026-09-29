import { describe, expect, it } from 'vitest'
import { parseHash, routeToHash } from './router'

describe('hash router', () => {
  it('opens shared plans directly in the chart', () => {
    const route = { name: 'chart', shareToken: 'encoded-plan+token' } as const
    expect(parseHash(routeToHash(route))).toEqual(route)
  })

  it('round-trips character tabs and defaults to the profile tab', () => {
    const route = { name: 'unit', unitId: 'PID_リョウマ', tab: 'progression' } as const
    expect(parseHash(routeToHash(route))).toEqual(route)
    expect(parseHash('#/unit/PID_x')).toEqual({ name: 'unit', unitId: 'PID_x', tab: 'profile' })
    expect(parseHash('#/nope')).toEqual({ name: 'roster' })
  })
})
