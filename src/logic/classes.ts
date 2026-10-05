import type { ClassDef, Dataset, UnitDef } from '../data/types'

export type ClassBranch = 'own' | 'parent' | 'seal' | 'aplus'

export interface ClassPoolEntry {
  classId: number
  branch: ClassBranch
  /** e.g. "Own", "Parent: Ryoma", "S: Azura", "A+: Hinoka" */
  sourceLabel: string
}

const UNSHAREABLE_CLASS_A = new Set([
  'Nohr Prince',
  'Nohr Princess',
  'Songstress',
  'Villager',
  'Kitsune',
  'Wolfskin',
])

const ALTERNATE_CLASS = new Map<string, string>([
  ['Songstress', 'Troubadour'],
  ['Samurai', 'Mercenary'],
  ['Villager', 'Apothecary'],
  ['Ninja', 'Cavalier'],
  ['Oni Savage', 'Fighter'],
  ['Spear Fighter', 'Knight'],
  ['Diviner', 'Dark Mage'],
  ['Sky Knight', 'Wyvern Rider'],
  ['Archer', 'Thief'],
  ['Kitsune', 'Apothecary'],
  ['Cavalier', 'Ninja'],
  ['Knight', 'Spear Fighter'],
  ['Fighter', 'Oni Savage'],
  ['Mercenary', 'Samurai'],
  ['Outlaw', 'Archer'],
  ['Wyvern Rider', 'Sky Knight'],
  ['Dark Mage', 'Diviner'],
  ['Wolfskin', 'Thief'],
])

export function classFamily(name: string): string {
  return name.replace(/\s*\((M|F)\)$/, '')
}

// Gender-locked classes under their own names. Fire Emblem Wiki › Reclass: "Male characters that would
// reclass to Shrine Maiden, Priestess, or Maid instead reclass to Monk, Great Master, or Butler,
// respectively; and vice versa for female characters." (Nohr Prince/ss is never sealed or inherited,
// but Kana's parent may hold it.)
const NAMED_PAIRS: [male: string, female: string][] = [
  ['Monk', 'Shrine Maiden'],
  ['Great Master', 'Priestess'],
  ['Butler', 'Maid'],
  ['Nohr Prince', 'Nohr Princess'],
]

/** Resolve a class id to the variant matching the unit's gender. */
export function sexedClassId(dataset: Dataset, classId: number, gender: 'male' | 'female'): number {
  const def = dataset.classesById.get(classId)
  if (!def) return classId
  if (def.dlc) {
    const counterpart = dataset.classes.find((candidate) => candidate.dlc && classFamily(candidate.name) === classFamily(def.name) && candidate.jid.endsWith(gender === 'male' ? '男' : '女'))
    if (counterpart) return counterpart.id
  }
  const pair = NAMED_PAIRS.find((names) => names.includes(classFamily(def.name)))
  const wanted = pair
    ? (name: string) => classFamily(name) === pair[gender === 'male' ? 0 : 1]
    : (name: string) => classFamily(name) === classFamily(def.name) && name.endsWith(gender === 'male' ? '(M)' : '(F)')
  // Gender-neutral classes (no suffix, no pair) stay as they are.
  if (!pair && !/\((M|F)\)$/.test(def.name)) return classId
  if (wanted(def.name)) return classId
  return dataset.classes.find((candidate) => wanted(candidate.name))?.id ?? classId
}

/** Base class of a class (itself when already a base/neutral class). */
export function baseOfClass(dataset: Dataset, classId: number): number {
  const def = dataset.classesById.get(classId)
  if (!def) return classId
  if (def.tier === 'promoted' && def.promotesFrom.length > 0) return def.promotesFrom[0]
  return classId
}

/** A unit's own primary base class (the first branch they come with). */
export function primaryBaseClass(dataset: Dataset, unit: UnitDef): number | null {
  const candidates = unit.classes.length > 0 ? unit.classes : unit.reclasses
  for (const id of candidates) {
    const def = dataset.classesById.get(id)
    if (def && def.tier === 'base') return id
  }
  if (candidates.length > 0) return baseOfClass(dataset, candidates[0])
  return null
}

/** All own base-class branches: primary class plus reclass fields, not its promoted companion. */
export function ownBaseClasses(dataset: Dataset, unit: UnitDef): number[] {
  const bases: number[] = []
  const push = (id: number) => {
    const base = baseOfClass(dataset, id)
    if (!bases.includes(base)) bases.push(base)
  }
  const primary = primaryBaseClass(dataset, unit)
  if (primary !== null) push(primary)
  for (const id of unit.reclasses) push(id)
  return bases
}

/** Secondary branches a contributor can pass on when their primary is taken. */
function secondaryBases(dataset: Dataset, unit: UnitDef): number[] {
  const secondary: number[] = []
  const own = ownBaseClasses(dataset, unit)
  const primary = primaryBaseClass(dataset, unit)
  for (const base of own) {
    if (base !== primary) secondary.push(base)
  }
  return secondary
}

function alternateBase(dataset: Dataset, classId: number | null): number | null {
  if (classId === null) return null
  const def = dataset.classesById.get(classId)
  const alternate = def ? ALTERNATE_CLASS.get(classFamily(def.name)) : undefined
  if (!alternate) return null
  return dataset.classes.find((candidate) => candidate.tier === 'base' && classFamily(candidate.name) === alternate)?.id ?? null
}

function classSlots(dataset: Dataset, unit: UnitDef, corrinTalentClassId?: number | null): [number | null, number | null, number | null, number | null] {
  const classA = primaryBaseClass(dataset, unit)
  const fixedParentIsCorrin = unit.fixedParent ? dataset.unitsById.get(unit.fixedParent)?.isCorrin === true : false
  const classB = (unit.isCorrin || fixedParentIsCorrin) && corrinTalentClassId
    ? baseOfClass(dataset, corrinTalentClassId)
    : secondaryBases(dataset, unit)[0] ?? null
  return [classA, classB, alternateBase(dataset, classA), alternateBase(dataset, classB)]
}

function sharedClass(
  dataset: Dataset,
  recipient: UnitDef,
  donor: UnitDef,
  corrinTalentClassId: number | null | undefined,
): number | null {
  const [classA, classB, alternateA, alternateB] = classSlots(dataset, donor, corrinTalentClassId)
  const fixedParentIsCorrin = donor.fixedParent ? dataset.unitsById.get(donor.fixedParent)?.isCorrin === true : false
  const slots = [classA, classB, donor.isCorrin || fixedParentIsCorrin ? alternateB : alternateA]
  let index = UNSHAREABLE_CLASS_A.has(classFamily(dataset.classesById.get(classA ?? -1)?.name ?? '')) ? 1 : 0
  const recipientA = primaryBaseClass(dataset, recipient)
  while (index < slots.length) {
    const classId = slots[index]
    if (classId === null || classId === undefined) {
      index += 1
      continue
    }
    if (recipientA !== null && sexedClassId(dataset, classId, recipient.gender) === sexedClassId(dataset, recipientA, recipient.gender)) {
      index += 1
      continue
    }
    return classId
  }
  return null
}

/** Expand a base class into its full class chain (base + promotions), sexed. */
export function branchChain(dataset: Dataset, baseId: number, gender: 'male' | 'female'): number[] {
  const base = dataset.classesById.get(baseId)
  const chain: number[] = [sexedClassId(dataset, baseId, gender)]
  if (base) {
    for (const promo of base.promotesTo) {
      const sexed = sexedClassId(dataset, promo, gender)
      if (!chain.includes(sexed)) chain.push(sexed)
    }
  }
  return chain
}

interface PoolOptions {
  /** The chosen variable parent for second-gen units. */
  variableParent?: UnitDef | null
  /** S-rank partner (Partner Seal classes). */
  sPartner?: UnitDef | null
  /** A+ partner (Friendship Seal classes). */
  aPlusPartner?: UnitDef | null
  /** Corrin can use a Friendship Seal with any same-gender A-rank partner. */
  friendshipDonors?: UnitDef[]
  /** Corrin's chosen talent branch (applies to Corrin and their child). */
  corrinTalentClassId?: number | null
}

/**
 * Every class a unit can legitimately use. Parent inheritance walks Class A, B,
 * Alternate A and Alternate B, while seals use their shorter sharing priority.
 * Songstress is never inherited.
 */
export function classPool(dataset: Dataset, unit: UnitDef, options: PoolOptions = {}): ClassPoolEntry[] {
  const entries: ClassPoolEntry[] = []
  const usedBases = new Set<number>()

  const addBranch = (baseId: number | null, branch: ClassBranch, sourceLabel: string) => {
    if (baseId === null) return
    const sexedBase = sexedClassId(dataset, baseId, unit.gender)
    if (usedBases.has(sexedBase)) return false
    const def = dataset.classesById.get(sexedBase)
    if (!def) return false
    // Never passed on, but Azura's own set still includes it.
    if (branch !== 'own' && classFamily(def.name) === 'Songstress') return false
    usedBases.add(sexedBase)
    for (const classId of branchChain(dataset, sexedBase, unit.gender)) {
      entries.push({ classId, branch, sourceLabel })
    }
    return true
  }

  // Own branches.
  for (const base of ownBaseClasses(dataset, unit)) {
    addBranch(base, 'own', 'Own')
  }
  if (unit.isCorrin && options.corrinTalentClassId) {
    addBranch(baseOfClass(dataset, options.corrinTalentClassId), 'own', 'Talent')
  }

  // Inheritance checks the father before the mother, even for Shigure, whose
  // fixed parent is Azura. Keep fixed-before-variable order for UGF same-sex pairs.
  const fixedParent = unit.fixedParent ? dataset.unitsById.get(unit.fixedParent) : undefined
  const parents = [fixedParent, options.variableParent].filter((parent, index, all): parent is UnitDef => Boolean(parent) && all.findIndex((entry) => entry?.id === parent?.id) === index)
  const orderedParents = parents.length === 2 && parents[0].gender !== parents[1].gender
    ? [...parents].sort((a, b) => a.gender === 'male' ? -1 : b.gender === 'male' ? 1 : 0)
    : parents
  for (const parent of orderedParents) {
    const label = `Parent: ${parent.name}`
    for (const classId of classSlots(dataset, parent, options.corrinTalentClassId)) {
      if (classId !== null && addBranch(classId, 'parent', label)) break
    }
  }

  const addSealContributor = (donor: UnitDef | null | undefined, branch: ClassBranch, prefix: string) => {
    if (!donor) return
    const classId = sharedClass(dataset, unit, donor, options.corrinTalentClassId)
    if (classId !== null) addBranch(classId, branch, `${prefix}: ${donor.name}`)
  }

  addSealContributor(options.sPartner, 'seal', 'S Seal')
  if (unit.isCorrin) {
    for (const donor of options.friendshipDonors ?? []) addSealContributor(donor, 'aplus', 'Friendship Seal')
  } else {
    addSealContributor(options.aPlusPartner, 'aplus', 'A+ Seal')
  }

  return entries
}

/** Look up a class in a pool. */
export function poolHasClass(pool: ClassPoolEntry[], classId: number): boolean {
  return pool.some((entry) => entry.classId === classId)
}

export function classNamesGrouped(dataset: Dataset, entries: ClassPoolEntry[]): string {
  return entries.map((e) => dataset.classesById.get(e.classId)?.name ?? '?').join(', ')
}

export function tierLabel(tier: ClassDef['tier']): string {
  return tier === 'promoted' ? 'Promoted' : tier === 'base' ? 'Base' : 'Special'
}
