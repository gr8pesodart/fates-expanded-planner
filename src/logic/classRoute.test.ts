import { describe, expect, it } from 'vitest'
import type { ClassDef, Dataset, UnitDef } from '../data/types'
import type { ClassStop } from '../state/model'
import type { ClassPoolEntry } from './classes'
import {
  appendClassRouteStop,
  classLevelCap,
  levelAfterClassChange,
  setRouteStopEndLevel,
  skillLearningOnRoute,
  updateRouteStopLevels,
  validateClassRoute,
} from './classRoute'

// Seal and level rules: https://serenesforest.net/fire-emblem-fates/hoshidan-classes/class-changing/
// Eternal Seal rules: https://serenesforest.net/fire-emblem-fates/inventory/items/

function classDef(
  id: number,
  tier: ClassDef['tier'],
  options: Partial<Pick<ClassDef, 'promotesTo' | 'promotesFrom' | 'skills' | 'skillLearn' | 'dlc'>> = {},
): ClassDef {
  return {
    id,
    name: `Class ${id}`,
    ja: '',
    jid: '',
    tier,
    dlc: false,
    baseStats: Array(8).fill(0),
    growths: Array(8).fill(0),
    caps: Array(8).fill(0),
    pairUp: Array(8).fill(0),
    weaponRanks: Array(8).fill(0),
    skills: options.skills ?? [],
    skillLearn: options.skillLearn ?? [],
    promotesTo: options.promotesTo ?? [],
    promotesFrom: options.promotesFrom ?? [],
    movement: 5,
    ...options,
  }
}

function unitDef(): UnitDef {
  return {
    id: 'unit',
    name: 'Unit',
    fid: null,
    slot: 0,
    gender: 'male',
    supportRoute: 7,
    routes: ['revelation'],
    dlc: false,
    levelCap: null,
    baseStats: Array(8).fill(0),
    growths: Array(8).fill(0),
    capMods: Array(8).fill(0),
    classes: [10],
    reclasses: [],
    weaponRanks: Array(8).fill(0),
    personalSkills: { birthright: null, conquest: null, revelation: null },
    supportBonuses: Array.from({ length: 4 }, () => Array(8).fill(0)),
    attackBonuses: Array.from({ length: 5 }, () => Array(4).fill(0)),
    fixedParent: null,
    isCorrin: false,
  }
}

function dataset(classes: ClassDef[]): Dataset {
  const unit = unitDef()
  return {
    meta: { id: 'test', label: 'Test', status: 'extracted' },
    characters: [],
    edges: [],
    edgesByCharacter: new Map(),
    units: [unit],
    unitsById: new Map([[unit.id, unit]]),
    classes,
    classesById: new Map(classes.map((gameClass) => [gameClass.id, gameClass])),
    skillsById: new Map([[101, { id: 101, name: 'Skill One', description: null, icon: 0, dlc: false }], [102, { id: 102, name: 'Skill Two', description: null, icon: 0, dlc: false }]]),
  }
}

const ownPool: ClassPoolEntry[] = [
  { classId: 10, branch: 'own', sourceLabel: 'Own' },
  { classId: 11, branch: 'own', sourceLabel: 'Own' },
  { classId: 12, branch: 'own', sourceLabel: 'Own' },
]

const start: ClassStop = { classId: 10, fromLevel: 1, toLevel: 10, via: 'start' }

describe('class route rules', () => {
  const classes = [
    classDef(10, 'base', { promotesTo: [11], skills: [101, 102], skillLearn: [{ id: 101, level: 1 }, { id: 102, level: 10 }] }),
    classDef(11, 'promoted', { promotesFrom: [10] }),
    classDef(12, 'base'),
    classDef(13, 'special'),
    classDef(14, 'promoted'),
    classDef(15, 'promoted', { dlc: true }),
    classDef(16, 'base'),
  ]

  it('uses the base, promoted and special level caps, with Eternal Seal increments', () => {
    expect(classLevelCap('base')).toBe(20)
    expect(classLevelCap('promoted')).toBe(20)
    expect(classLevelCap('special')).toBe(40)
    expect(classLevelCap('promoted', 2)).toBe(30)
  })

  it('carries levels across reclasses and maps promoted/special levels by twenty', () => {
    expect(levelAfterClassChange('base', 'promoted', 17)).toBe(17)
    expect(levelAfterClassChange('promoted', 'special', 15)).toBe(35)
    expect(levelAfterClassChange('special', 'promoted', 35)).toBe(15)
    expect(appendClassRouteStop(dataset(classes), [start], 12, 'heart')).toEqual([
      start,
      { classId: 12, fromLevel: 10, toLevel: 20, via: 'heart' },
    ])
  })

  it('resets a Master Seal promotion to level 1 after the base class reaches level 10', () => {
    const data = dataset(classes)
    const route = appendClassRouteStop(data, [start], 11, 'heart')
    expect(route).toEqual([
      start,
      { classId: 11, fromLevel: 1, toLevel: 20, via: 'master' },
    ])
    expect(validateClassRoute(data, route, { classPool: ownPool, dlcEnabled: true })).toEqual([])
    const tooEarly = [{ ...start, toLevel: 9 }, route[1]]
    expect(validateClassRoute(data, tooEarly, { classPool: ownPool, dlcEnabled: true }).map((issue) => issue.id))
      .toContain('promotion-level-1')
  })

  it('requires ordered seal transitions and correct level carry', () => {
    const data = dataset(classes)
    const wrongSeal: ClassStop[] = [start, { classId: 12, fromLevel: 10, toLevel: 20, via: 'partner' }]
    expect(validateClassRoute(data, wrongSeal, { classPool: ownPool, dlcEnabled: true }).map((issue) => issue.id))
      .toContain('seal-source-1')
    const wrongLevel: ClassStop[] = [start, { classId: 12, fromLevel: 11, toLevel: 20, via: 'heart' }]
    expect(validateClassRoute(data, wrongLevel, { classPool: ownPool, dlcEnabled: true }).map((issue) => issue.id))
      .toContain('level-carry-1')
    const unavailable: ClassStop[] = [start, { classId: 14, fromLevel: 10, toLevel: 20, via: 'heart' }]
    expect(validateClassRoute(data, unavailable, { classPool: ownPool.slice(0, 1), dlcEnabled: true }).map((issue) => issue.id))
      .toContain('class-unavailable-1')
  })

  it('requires max level and an eligible class before an Eternal Seal cap increase', () => {
    const data = dataset(classes)
    const route: ClassStop[] = [
      { classId: 11, fromLevel: 1, toLevel: 20, via: 'start' },
      { classId: 11, fromLevel: 20, toLevel: 25, via: 'eternal' },
      { classId: 11, fromLevel: 25, toLevel: 30, via: 'eternal' },
    ]
    expect(validateClassRoute(data, route, { classPool: ownPool, dlcEnabled: true })).toEqual([])
    const ineligible: ClassStop[] = [start, { classId: 10, fromLevel: 10, toLevel: 25, via: 'eternal' }]
    expect(validateClassRoute(data, ineligible, { classPool: ownPool, dlcEnabled: true }).map((issue) => issue.id))
      .toContain('eternal-base-1')
  })

  it('warns when DLC is off and Offspring Seal recruitment chapter is unspecified', () => {
    const data = dataset(classes)
    const childPool = [...ownPool, { classId: 16, branch: 'parent' as const, sourceLabel: 'Parent: Example' }]
    const route: ClassStop[] = [
      start,
      { classId: 15, fromLevel: 10, toLevel: 20, via: 'dlc' },
      { classId: 16, fromLevel: 20, toLevel: 20, via: 'offspring' },
    ]
    const issues = validateClassRoute(data, route, { classPool: childPool, dlcEnabled: false })
    expect(issues.map((issue) => issue.id)).toContain('dlc-off-1')
    expect(issues.map((issue) => issue.id)).toContain('offspring-chapter-2')
    expect(validateClassRoute(data, route, { classPool: childPool, dlcEnabled: false, chapterTarget: 23 })
      .map((issue) => issue.id)).not.toContain('offspring-chapter-2')
  })

  it('finds skills learned within the stop range and leaves later skills unreachable', () => {
    const data = dataset(classes)
    const unit = data.units[0]
    expect(skillLearningOnRoute(data, unit, ownPool, [start], 'revelation', 102)).toEqual({
      classId: 10,
      level: 10,
      stopIndex: 0,
      onArrival: false,
    })
    expect(skillLearningOnRoute(data, unit, ownPool, [
      { classId: 12, fromLevel: 1, toLevel: 10, via: 'start' },
      { classId: 10, fromLevel: 10, toLevel: 20, via: 'heart' },
    ], 'revelation', 102)?.onArrival).toBe(true)
    expect(skillLearningOnRoute(data, unit, ownPool, [{ ...start, toLevel: 9 }], 'revelation', 102)).toBeNull()
  })

  it('updates one stop range immutably for level controls', () => {
    const route = [start, { classId: 11, fromLevel: 1, toLevel: 20, via: 'master' as const }]
    expect(updateRouteStopLevels(route, 1, { toLevel: 15 })).toEqual([
      start,
      { classId: 11, fromLevel: 1, toLevel: 15, via: 'master' },
    ])
    expect(updateRouteStopLevels(route, 4, { toLevel: 15 })).toBe(route)
  })

  it('recalculates later carried levels when an earlier stop ends at a different level', () => {
    const data = dataset(classes)
    const route: ClassStop[] = [
      { classId: 10, fromLevel: 1, toLevel: 10, via: 'start' },
      { classId: 11, fromLevel: 1, toLevel: 18, via: 'master' },
      { classId: 12, fromLevel: 18, toLevel: 20, via: 'heart' },
    ]

    expect(setRouteStopEndLevel(data, route, 1, 15)).toEqual([
      route[0],
      { ...route[1], toLevel: 15 },
      { ...route[2], fromLevel: 15 },
    ])
    expect(setRouteStopEndLevel(data, route, 8, 15)).toBe(route)
  })
})
