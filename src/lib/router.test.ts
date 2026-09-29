import { describe, expect, it } from 'vitest'
import { parseHash, routeToHash } from './router'

describe('hash router', () => {
  it('opens shared plans directly in the preview lens', () => {
    const route = { name: 'preview', shareToken: 'encoded-plan+token' } as const

    expect(parseHash(routeToHash(route))).toEqual(route)
  })
})
