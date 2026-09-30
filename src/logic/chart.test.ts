import { describe, expect, it } from 'vitest'
import { emptyRun } from '../state/model'
import { chartCards } from './chart'
import { setBond, swapPair } from './relationships'

describe('chartCards', () => {
  it('anchors linked pairs at the first-listed partner while keeping the front row first', () => {
    let run = setBond(emptyRun('t'), 'b', 'pairPartner', 'c')
    run = swapPair(run, 'b')
    expect(chartCards(['a', 'b', 'c', 'd'], run)).toEqual([
      { kind: 'solo', unitId: 'a' },
      { kind: 'pair', front: 'c', back: 'b' },
      { kind: 'solo', unitId: 'd' },
    ])
  })

  it('anchors an unlinked pair at the front character\'s sort position', () => {
    const run = swapPair(setBond(emptyRun('t'), 'b', 'pairPartner', 'c'), 'b')
    expect(chartCards(['a', 'b', 'c', 'd'], run, false)).toEqual([
      { kind: 'solo', unitId: 'a' },
      { kind: 'pair', front: 'c', back: 'b' },
      { kind: 'solo', unitId: 'd' },
    ])
  })

  it('shows a unit solo when its partner is not on the roster', () => {
    const run = setBond(emptyRun('t'), 'a', 'pairPartner', 'z')
    expect(chartCards(['a'], run)).toEqual([{ kind: 'solo', unitId: 'a' }])
  })
})
