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

/**
 * How a grey hair layer takes a colour.
 *  - `sprite` (map sprites): the mask's main lit grey 0xBB shows exactly the colour, darker greys
 *    shade it (tools/assets/extract_sprites.py › tint_ramp); overlay washed their 0x44–0xBB ramp out.
 *  - `overlay` (talk portraits, cut-ins): overlay blend with the grey as the base
 *    (tools/assets/extract_portraits.py › tint_overlay). Measured against the game's own child hair
 *    sheets: 9.7 mean error, at the sheets' own brightness offset, vs 33 for the sprite formula.
 *    Serenes Forest's Kamui customizer tints the avatar the same way.
 */
export type HairTintMode = 'sprite' | 'overlay'

const HAIR_REFERENCE_GREY = 0xbb

/** One channel of the tint: grey value → tinted value, for a colour channel 0–255. */
export function tintChannel(grey: number, colour: number, mode: HairTintMode): number {
  if (mode === 'sprite') return Math.min(255, Math.floor((grey * colour) / HAIR_REFERENCE_GREY))
  return grey < 128
    ? Math.floor((2 * grey * colour) / 255)
    : 255 - Math.floor((2 * (255 - grey) * (255 - colour)) / 255)
}

/** Per-channel 256-entry lookup tables for `#rrggbb`. */
export function hairTintTables(hex: string, mode: HairTintMode): Uint8Array[] {
  return [1, 3, 5].map((offset) => {
    const colour = parseInt(hex.slice(offset, offset + 2), 16)
    const table = new Uint8Array(256)
    for (let grey = 0; grey < 256; grey += 1) table[grey] = tintChannel(grey, colour, mode)
    return table
  })
}
