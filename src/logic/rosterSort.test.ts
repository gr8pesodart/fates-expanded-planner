import { describe, expect, it } from 'vitest'
import { reconcileRosterSort, sortRoster, type RosterSortEntry } from './rosterSort'

function entry(unitId: string, recruitIndex: number, extra: Partial<RosterSortEntry> = {}): RosterSortEntry {
  return { unitId, name: unitId, favourite: false, recruitIndex, fixedParent: null, lensRow: [null, 0, 0, 0, 0, 0, 0, 0, 0], ...extra }
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

  it('filters to first-gen units or children and unlinks partners filtered out', () => {
    const all = [kana, mozu, jakob, corrin]
    expect(ids(sortRoster(all, { kind: 'recruit' }, { generation: 'first' }))).toEqual(['Corrin', 'Jakob', 'Mozu'])
    expect(ids(sortRoster(all, { kind: 'recruit' }, { generation: 'children' }))).toEqual(['Kana'])
    const paired = [{ ...corrin, pairPartner: 'Kana' }, { ...kana, pairPartner: 'Corrin', pairRole: 'back' as const }, jakob]
    expect(ids(sortRoster(paired, { kind: 'recruit' }, { generation: 'first', linkPairs: true }))).toEqual(['Corrin', 'Jakob'])
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

  it('uses recruit order for stat ties even when one entry is a child', () => {
    const rows = [
      entry('Kana', 1, { fixedParent: 'Corrin', lensRow: [null, 20] }),
      entry('Jakob', 2, { lensRow: [null, 20] }),
    ]
    expect(ids(sortRoster(rows, { kind: 'stat', column: 1 }))).toEqual(['Kana', 'Jakob'])
  })

  it('links partners at the earlier sorted position and keeps the front partner on top', () => {
    const corrin = entry('Corrin', 0, { pairPartner: 'Xander', pairRole: 'back' })
    const xander = entry('Xander', 20, { pairPartner: 'Corrin', pairRole: 'front' })
    expect(ids(sortRoster([xander, corrin], { kind: 'recruit' }, { linkPairs: true }))).toEqual(['Xander', 'Corrin'])
    expect(ids(sortRoster([corrin, xander], { kind: 'recruit', direction: 'desc' }, { linkPairs: true }))).toEqual(['Xander', 'Corrin'])
  })

  it('can place a front partner at the back partner’s position when sorting down', () => {
    const corrin = entry('Corrin', 0, { pairPartner: 'Xander', pairRole: 'front' })
    const xander = entry('Xander', 20, { pairPartner: 'Corrin', pairRole: 'back' })
    expect(ids(sortRoster([corrin, xander], { kind: 'recruit', direction: 'desc' }, { linkPairs: true }))).toEqual(['Corrin', 'Xander'])
  })

  it('resets a stat sort to recruit order when the lens blanks that column', () => {
    expect(reconcileRosterSort({ kind: 'stat', column: 0 }, [corrin, jakob])).toEqual({ kind: 'recruit', direction: 'asc' })
    expect(reconcileRosterSort({ kind: 'stat', column: 1 }, [corrin, jakob])).toEqual({ kind: 'stat', column: 1 })
  })
})
