import { describe, expect, it } from 'vitest'
import { reconcileRosterSort, sortRoster, type RosterSortEntry } from './rosterSort'

function entry(unitId: string, recruitIndex: number, extra: Partial<RosterSortEntry> = {}): RosterSortEntry {
  return { unitId, name: unitId, favourite: false, recruitIndex, fixedParent: null, lensRow: [null, 0, 0, 0, 0, 0, 0, 0], ...extra }
}

const ids = (list: RosterSortEntry[]) => list.map((e) => e.unitId)

describe('roster sort', () => {
  const corrin = entry('Corrin', 0)
  const mozu = entry('Mozu', 5)
  const kana = entry('Kana', 1, { fixedParent: 'Corrin' })
  const jakob = entry('Jakob', 2)

  it('places optional recruits at their chapter and children after every first-gen unit', () => {
    expect(ids(sortRoster([kana, mozu, jakob, corrin], { kind: 'recruit' }))).toEqual(['Corrin', 'Jakob', 'Mozu', 'Kana'])
  })

  it('always lists favourites first', () => {
    const favKana = { ...kana, favourite: true }
    expect(ids(sortRoster([corrin, mozu, favKana, jakob], { kind: 'recruit' }))[0]).toBe('Kana')
  })

  it('breaks stat ties by recruit order', () => {
    const rows = [
      entry('Mozu', 5, { lensRow: [null, 40, 0, 0, 0, 0, 0, 0] }),
      entry('Jakob', 2, { lensRow: [null, 40, 0, 0, 0, 0, 0, 0] }),
      entry('Corrin', 0, { lensRow: [null, 10, 0, 0, 0, 0, 0, 0] }),
    ]
    expect(ids(sortRoster(rows, { kind: 'stat', column: 1 }))).toEqual(['Jakob', 'Mozu', 'Corrin'])
  })

  it('resets a stat sort to recruit order when the lens blanks that column', () => {
    expect(reconcileRosterSort({ kind: 'stat', column: 0 }, [corrin, jakob])).toEqual({ kind: 'recruit' })
    expect(reconcileRosterSort({ kind: 'stat', column: 1 }, [corrin, jakob])).toEqual({ kind: 'stat', column: 1 })
  })
})
