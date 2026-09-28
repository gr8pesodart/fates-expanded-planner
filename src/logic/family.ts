import type { Dataset, UnitDef } from '../data/types'

/**
 * Children produced by an S-rank pair: any unit whose fixed parent is either
 * partner. Corrin couples produce two children (Kana + the spouse's child).
 */
export function childrenOfPair(dataset: Dataset, a: string, b: string): UnitDef[] {
  return dataset.units.filter((u) => u.fixedParent === a || u.fixedParent === b)
}

export function fixedParentOf(dataset: Dataset, unit: UnitDef): UnitDef | undefined {
  return unit.fixedParent ? dataset.unitsById.get(unit.fixedParent) : undefined
}

/** Can this unit's S partner produce a child with them? */
export function pairProducesChildren(dataset: Dataset, a: string, b: string): boolean {
  return childrenOfPair(dataset, a, b).length > 0
}
