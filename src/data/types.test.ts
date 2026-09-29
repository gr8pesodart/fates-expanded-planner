import { describe, expect, it } from 'vitest'
import { decodeSupportType } from './types'

describe('decodeSupportType', () => {
  it('decodes the romantic type (4/9/14/20)', () => {
    const info = decodeSupportType(0x140e0904)
    expect(info.kind).toBe('romantic')
    expect(info.fast).toBe(false)
    expect(info.ranks).toEqual({ c: 4, b: 9, a: 14, s: 20 })
  })

  it('decodes the platonic type (S locked)', () => {
    const info = decodeSupportType(0xff0e0904)
    expect(info.kind).toBe('platonic')
    expect(info.ranks).toEqual({ c: 4, b: 9, a: 14, s: null })
  })

  it('decodes the fast romantic type (3/7/12/18)', () => {
    const info = decodeSupportType(0x120c0703)
    expect(info.kind).toBe('romantic')
    expect(info.fast).toBe(true)
    expect(info.ranks).toEqual({ c: 3, b: 7, a: 12, s: 18 })
  })

  it('decodes the fast platonic type', () => {
    const info = decodeSupportType(0xff0c0703)
    expect(info.kind).toBe('platonic')
    expect(info.fast).toBe(true)
    expect(info.ranks).toEqual({ c: 3, b: 7, a: 12, s: null })
  })
})
