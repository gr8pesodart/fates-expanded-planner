import { describe, expect, it } from 'vitest'
import { pairUpBonus } from './pairUp'

const classBonus = [0, 2, 0, 1, 1, 0, 0, 2]
const rows = [
  [0, 0, 0, 0, 1, 0, 0, 0],
  [0, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 2, 0, 0, 0],
]

describe('pairUpBonus', () => {
  it('adds only the class bonus before support rank C', () => {
    expect(pairUpBonus(classBonus, rows, null)).toEqual(classBonus)
  })

  it('adds the C row at C rank', () => {
    expect(pairUpBonus(classBonus, rows, 'C')).toEqual([0, 2, 0, 1, 2, 0, 0, 2])
  })

  it('cumulates C and B rows at B rank', () => {
    expect(pairUpBonus(classBonus, rows, 'B')).toEqual([0, 3, 0, 1, 2, 0, 0, 2])
  })

  it('cumulates C, B and A rows at A rank', () => {
    expect(pairUpBonus(classBonus, rows, 'A')).toEqual([0, 3, 0, 2, 2, 0, 0, 2])
  })

  it('cumulates all four rows at S rank without mutating input', () => {
    const classBefore = [...classBonus]
    const rowsBefore = rows.map((row) => [...row])

    expect(pairUpBonus(classBonus, rows, 'S')).toEqual([0, 3, 0, 2, 4, 0, 0, 2])
    expect(classBonus).toEqual(classBefore)
    expect(rows).toEqual(rowsBefore)
  })

  it('treats missing rank rows and stats as zero', () => {
    expect(pairUpBonus([0, 1], [[0, 2], [0, 3]], 'S')).toEqual([0, 6, 0, 0, 0, 0, 0, 0])
  })
})
