import type { ClassDef, Dataset, UnitDef } from '../data/types'

export type ClassBranch = 'own' | 'parent' | 'seal' | 'aplus'

export interface ClassPoolEntry {
  classId: number
  branch: ClassBranch
  /** e.g. "Own", "Parent: Ryoma", "S: Azura", "A+: Hinoka" */
  sourceLabel: string
}

const NON_INHERITABLE_VIA_SEAL = new Set([
  'Nohr Prince',
  'Nohr Princess',
  'Wolfskin',
  'Kitsune',
  'Villager',
])

export function classFamily(name: string): string {
  return name.replace(/\s*\((M|F)\)$/, '')
}

/** Resolve a class id to the variant matching the unit's gender. */
export function sexedClassId(dataset: Dataset, classId: number, gender: 'male' | 'female'): number {
  const def = dataset.classesById.get(classId)
  if (!def) return classId
  const family = classFamily(def.name)
  const suffix = gender === 'male' ? '(M)' : '(F)'
  if (def.name.endsWith(suffix) || !def.name.endsWith('(M)') === !def.name.endsWith('(F)')) {
    // Already correct or gender-neutral.
    if (def.name.endsWith(suffix)) return classId
    if (!def.name.endsWith('(M)') && !def.name.endsWith('(F)')) return classId
  }
  for (const candidate of dataset.classes) {
    if (classFamily(candidate.name) === family && candidate.name.endsWith(suffix)) {
      return candidate.id
    }
  }
  return classId
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

/** All base classes the unit comes with on their own (primary + reclass options). */
export function ownBaseClasses(dataset: Dataset, unit: UnitDef): number[] {
  const bases: number[] = []
  const push = (id: number) => {
    const base = baseOfClass(dataset, id)
    if (!bases.includes(base)) bases.push(base)
  }
  for (const id of unit.classes) push(id)
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
  /** Is the fixed parent Corrin? (Kana) */
  fixedParentIsCorrin?: boolean
}

/**
 * Every class a unit can legitimately be, following Fates class-set rules:
 *  - first-gen: own primary branch + secondary branch
 *  - second-gen: own branch + fixed parent's primary branch + variable parent's
 *    primary branch, then Partner/Friendship Seal branches
 *  - Songstress is never inherited; Nohr Prince(ss)/Wolfskin/Kitsune/Villager
 *    cannot come from seals (only from a parent or on the unit's own set)
 * Duplicate branches fall back to the contributor's next branch.
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

  // Fixed parent's primary branch (second-gen only).
  const fixedParent = unit.fixedParent ? dataset.unitsById.get(unit.fixedParent) : undefined
  if (fixedParent) {
    if (options.fixedParentIsCorrin && options.corrinTalentClassId) {
      addBranch(baseOfClass(dataset, options.corrinTalentClassId), 'parent', 'Parent: Corrin')
    } else {
      const primary = primaryBaseClass(dataset, fixedParent)
      if (!addBranch(primary, 'parent', `Parent: ${fixedParent.name}`)) {
        for (const fallback of secondaryBases(dataset, fixedParent)) {
          if (addBranch(fallback, 'parent', `Parent: ${fixedParent.name}`)) break
        }
      }
    }
  }

  const addContributor = (
    donor: UnitDef | null | undefined,
    branch: ClassBranch,
    prefix: string,
  ) => {
    if (!donor) return
    const label = `${prefix}: ${donor.name}`
    const viaSeal = branch !== 'parent'
    // A seal can't grant Nohr Prince(ss), so Corrin's seal partners get the talent instead. As a
    // variable parent (Shigure), Corrin passes the Nohr Prince(ss) tree, never the talent
    // (Fire Emblem Wiki › Shigure); only Kana, with Corrin as fixed parent, gets the talent.
    if (viaSeal && donor.isCorrin && options.corrinTalentClassId) {
      if (addBranch(baseOfClass(dataset, options.corrinTalentClassId), branch, label)) return
    }
    const primary = primaryBaseClass(dataset, donor)
    const primaryDef = primary !== null ? dataset.classesById.get(primary) : undefined
    const sealBlocked = viaSeal && primaryDef ? NON_INHERITABLE_VIA_SEAL.has(classFamily(primaryDef.name)) : false
    if (!sealBlocked && addBranch(primary, branch, label)) return
    for (const fallback of secondaryBases(dataset, donor)) {
      if (addBranch(fallback, branch, label)) return
    }
  }

  addContributor(options.variableParent, 'parent', 'Parent')
  addContributor(options.sPartner, 'seal', 'S Seal')
  if (unit.isCorrin) {
    for (const donor of options.friendshipDonors ?? []) addContributor(donor, 'aplus', 'Friendship Seal')
  } else {
    addContributor(options.aPlusPartner, 'aplus', 'A+ Seal')
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
