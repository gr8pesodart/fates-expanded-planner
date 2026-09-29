import { describe, expect, it } from 'vitest'
import {
  CHILD_PREVIEWS,
  CLASS_POOLS,
  INITIAL_PLANS,
  PAIRS,
  PROTO_CLASSES,
  PROTO_SKILLS,
  PROTO_UNITS,
  ROSTER_IDS,
} from './fixtures'

describe('prototype fixtures', () => {
  it('every roster entry resolves to a real unit row', () => {
    for (const id of ROSTER_IDS) expect(PROTO_UNITS[id], id).toBeTruthy()
  })

  it('every class pool class exists in the generated table', () => {
    for (const [unitId, groups] of Object.entries(CLASS_POOLS)) {
      for (const group of groups) {
        for (const classId of group.classIds) {
          expect(PROTO_CLASSES[classId], `${unitId} -> ${classId}`).toBeTruthy()
        }
      }
    }
  })

  it('every plan route, class and skill id exists', () => {
    for (const [unitId, plan] of Object.entries(INITIAL_PLANS)) {
      if (plan.classId !== undefined) expect(PROTO_CLASSES[plan.classId], unitId).toBeTruthy()
      for (const stop of plan.route) expect(PROTO_CLASSES[stop.classId], `${unitId} route`).toBeTruthy()
      for (const skillId of plan.skills) {
        if (skillId !== null) expect(PROTO_SKILLS[skillId], `${unitId} skill`).toBeTruthy()
      }
    }
  })

  it('pairs reference real units and children', () => {
    for (const pair of PAIRS) {
      expect(PROTO_UNITS[pair.a], pair.a).toBeTruthy()
      expect(PROTO_UNITS[pair.b], pair.b).toBeTruthy()
      if (pair.childId) expect(PROTO_UNITS[pair.childId]?.fixedParent, pair.childId).toBeTruthy()
    }
  })

  it('child previews have eight growth values', () => {
    for (const [key, preview] of Object.entries(CHILD_PREVIEWS)) {
      expect(preview.growths, key).toHaveLength(8)
      expect(PROTO_UNITS[preview.childId], key).toBeTruthy()
    }
  })
})
