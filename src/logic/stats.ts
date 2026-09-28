import type { Dataset, StatKey, UnitDef } from '../data/types'
import { BOONS, BANES, NO_BOON } from '../data/boons'
import { classFamily, primaryBaseClass } from './classes'

export interface StatProjection {
  /** Personal bases + class bases. */
  stats: number[]
  /** Personal growths (+ boon/bane, + child average) + class growths. */
  growths: number[]
  /** Class caps + personal cap modifiers. */
  caps: number[]
  /** Whether child growth averaging is applied. */
  childAveraged: boolean
}

interface ProjectionOptions {
  corrinBoon?: StatKey | null
  corrinBane?: StatKey | null
  /** For second-gen units: the chosen parent who supplies the other half. */
  variableParentId?: string | null
}

function addition(base: number[], extra: number[] | null | undefined): number[] {
  if (!extra) return [...base]
  return base.map((value, index) => value + extra[index])
}

/**
 * Personal growths / cap mods after Corrin boons and child averaging.
 * Children: growths = floor((child + variable parent) / 2); cap mods =
 * fixed parent + variable parent (+1 for a non-child partner), per Fates.
 */
function personalStatMods(
  dataset: Dataset,
  unit: UnitDef,
  options: ProjectionOptions,
): { growths: number[]; capMods: number[]; childAveraged: boolean } {
  let growths = [...unit.growths]
  let capMods = [...unit.capMods]

  if (unit.isCorrin) {
    const boon = options.corrinBoon ? BOONS[options.corrinBoon] : NO_BOON
    const bane = options.corrinBane ? BANES[options.corrinBane] : NO_BOON
    growths = growths.map((v, i) => v + boon.growths[keyAt(i)] + bane.growths[keyAt(i)])
    capMods = capMods.map((v, i) => v + (boon.capMods[keyAt(i)] ?? 0) + (bane.capMods[keyAt(i)] ?? 0))
  }

  let childAveraged = false
  const variableParent = options.variableParentId
    ? dataset.unitsById.get(options.variableParentId)
    : undefined
  if (unit.fixedParent && variableParent) {
    const fixedParent = dataset.unitsById.get(unit.fixedParent)
    let parentGrowths = [...variableParent.growths]
    let parentCapMods = [...variableParent.capMods]

    if (variableParent.isCorrin) {
      const boon = options.corrinBoon ? BOONS[options.corrinBoon] : NO_BOON
      const bane = options.corrinBane ? BANES[options.corrinBane] : NO_BOON
      parentGrowths = parentGrowths.map(
        (v, i) => v + boon.growths[keyAt(i)] + bane.growths[keyAt(i)],
      )
      parentCapMods = parentCapMods.map(
        (v, i) => v + (boon.capMods[keyAt(i)] ?? 0) + (bane.capMods[keyAt(i)] ?? 0),
      )
    }

    growths = growths.map((v, i) => Math.floor((v + parentGrowths[i]) / 2))
    if (fixedParent) {
      capMods = capMods.map((_value, i) => {
        if (i === 0) return 0 // HP caps never take modifiers
        const bonus = variableParent.fixedParent ? 0 : 1
        return fixedParent.capMods[i] + parentCapMods[i] + bonus
      })
    }
    childAveraged = true
  }

  return { growths, capMods, childAveraged }
}

const KEY_ORDER: StatKey[] = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res']

function keyAt(index: number): StatKey {
  return KEY_ORDER[index]
}

export function projectUnit(
  dataset: Dataset,
  unit: UnitDef,
  classId: number | undefined,
  options: ProjectionOptions = {},
): StatProjection {
  const { growths: personalGrowths, capMods, childAveraged } = personalStatMods(dataset, unit, options)
  const classDef = classId !== undefined ? dataset.classesById.get(classId) : undefined

  const stats = classDef ? addition(unit.baseStats, classDef.baseStats) : [...unit.baseStats]
  const growths = classDef ? addition(personalGrowths, classDef.growths) : personalGrowths
  const caps = classDef
    ? classDef.caps.map((cap, i) => (i === 0 ? cap : cap + capMods[i]))
    : capMods.map((v) => v)

  return { stats, growths, caps, childAveraged }
}

/** Is this unit a child of Corrin (Kana)? */
export function fixedParentIsCorrin(dataset: Dataset, unit: UnitDef): boolean {
  if (!unit.fixedParent) return false
  return dataset.unitsById.get(unit.fixedParent)?.isCorrin === true
}

export function isSongstress(dataset: Dataset, unit: UnitDef): boolean {
  const primary = primaryBaseClass(dataset, unit)
  if (primary === null) return false
  const def = dataset.classesById.get(primary)
  return def !== undefined && classFamily(def.name) === 'Songstress'
}
