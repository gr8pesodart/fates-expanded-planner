import { describe, expect, it } from 'vitest'
import { emptyRun } from '../state/model'
import { chartCards } from './chart'
import { setBond, swapPair } from './relationships'

describe('chartCards', () => {
  it('lists pairs front-first in roster order, then solos', () => {
    let run = setBond(emptyRun('t'), 'b', 'pairPartner', 'c')
    run = swapPair(run, 'b')
    expect(chartCards(['a', 'b', 'c', 'd'], run)).toEqual([
      { kind: 'pair', front: 'c', back: 'b' },
      { kind: 'solo', unitId: 'a' },
      { kind: 'solo', unitId: 'd' },
    ])
  })

  it('shows a unit solo when its partner is not on the roster', () => {
    const run = setBond(emptyRun('t'), 'a', 'pairPartner', 'z')
    expect(chartCards(['a'], run)).toEqual([{ kind: 'solo', unitId: 'a' }])
  })
})
