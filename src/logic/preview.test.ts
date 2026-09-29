import { describe, expect, it } from 'vitest'
import { groupPreviewUnits } from './preview'

describe('groupPreviewUnits', () => {
  it('orders a reciprocal pair by explicit front and back roles', () => {
    const groups = groupPreviewUnits(['back-unit', 'front-unit'], {
      'front-unit': { combatPartner: 'back-unit', combatRole: 'front' },
      'back-unit': { combatPartner: 'front-unit', combatRole: 'back' },
    })

    expect(groups.duos).toEqual([{ front: 'front-unit', back: 'back-unit' }])
    expect(groups.solos).toEqual([])
    expect(groups.unassigned).toEqual([])
  })

  it('keeps one-sided assignments and incomplete reciprocal pairs as solos', () => {
    const groups = groupPreviewUnits(['one-sided', 'target', 'no-role-a', 'no-role-b'], {
      'one-sided': { combatPartner: 'target', combatRole: 'front' },
      target: {},
      'no-role-a': { combatPartner: 'no-role-b', combatRole: 'front' },
      'no-role-b': { combatPartner: 'no-role-a' },
    })

    expect(groups.duos).toEqual([])
    expect(groups.solos).toEqual(['one-sided', 'target', 'no-role-a', 'no-role-b'])
    expect(groups.incompleteAssignments['one-sided']).toMatch(/not reciprocal/)
    expect(groups.incompleteAssignments['no-role-a']).toMatch(/Choose front or back/)
    expect(groups.incompleteAssignments['no-role-b']).toMatch(/Choose front or back/)
  })

  it('does not duplicate units when roster input or reciprocal links repeat', () => {
    const groups = groupPreviewUnits(['front', 'back', 'front', 'solo', 'solo'], {
      front: { combatPartner: 'back', combatRole: 'front' },
      back: { combatPartner: 'front', combatRole: 'back' },
      solo: { combatRole: 'front' },
    })

    expect(groups.duos).toEqual([{ front: 'front', back: 'back' }])
    expect(groups.solos).toEqual(['solo'])
    expect([...groups.duos.flatMap((duo) => [duo.front, duo.back]), ...groups.solos, ...groups.unassigned])
      .toHaveLength(3)
  })

  it('separates units with no saved plan from planned solos', () => {
    const groups = groupPreviewUnits(['planned', 'new'], { planned: {} })

    expect(groups.solos).toEqual(['planned'])
    expect(groups.unassigned).toEqual(['new'])
  })
})
