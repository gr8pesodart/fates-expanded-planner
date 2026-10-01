import sprites from './sprites.json'

/**
 * Corrin's 30 hair colours in creation-screen order, from the ROM's GameData/MyUnitEdit.bin
 * colour table (tools/assets/extract_sprites.py › corrin_hair_swatches). The first (white) is the
 * default.
 */
export const CORRIN_HAIR_COLOURS: readonly string[] = (sprites as { corrinHairColours?: string[] }).corrinHairColours ?? ['#f6f4ef']
