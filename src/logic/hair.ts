import { CORRIN_HAIR_COLOURS } from '../data/hairColours'
import type { Dataset } from '../data/types'
import type { RunPlan } from '../state/model'
import { variableParentOf } from './relationships'

/**
 * The hair colour a unit shows in this run, or null for the extracted default.
 *  - Corrin: the colour chosen on the Avatar tab (default: the first swatch, white).
 *  - Children: the variable parent's colour — mothers pass their hair colour, and male Kana takes
 *    his father's (Fire Emblem Wiki › Inheritance), which in planner terms is always the variable
 *    parent; a parent who is Corrin or a child resolves recursively. Shigure's hair is fixed (his
 *    head has no recolourable pixels, so whatever this returns is unused).
 *  - Everyone else: their own FaceData colour (only matters as a parent).
 * `defaults` gives a unit's FaceData colour (sprites manifest › hairColours).
 */
export function hairColourOf(dataset: Dataset, run: RunPlan, unitId: string, defaults: (unitId: string) => string | null, depth = 0): string | null {
  const unit = dataset.unitsById.get(unitId)
  if (!unit) return null
  if (unit.isCorrin) return corrinHairColour(run)
  if (unit.fixedParent === null) return defaults(unitId)
  const parent = variableParentOf(dataset, run, unitId)
  if (!parent || depth > 2) return null
  return hairColourOf(dataset, run, parent, defaults, depth + 1)
}

export function corrinHairColour(run: RunPlan): string {
  return run.corrin.hairColour ?? CORRIN_HAIR_COLOURS[0]
}
