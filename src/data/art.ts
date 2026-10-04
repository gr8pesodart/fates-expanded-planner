import { assetUrl } from './assets'

/**
 * v3 art manifests (docs/ASSETS.md). Each is optional at build time: until its extractor has run,
 * lookups fall back to the v2 set (bust faces, body-only class sprites) or a monogram.
 */
type Box = [number, number, number, number]

export interface PortraitHair {
  file: string
  w: number
  h: number
}

export interface PortraitEntry {
  file: string
  w: number
  h: number
  face: Box
  bust: Box
  /** Same-canvas recolourable hair layer (children, Corrin); tinted per run in Portrait. */
  hair?: PortraitHair
  /** FaceData's face rect (top of hair to chin) on this canvas; the character hero is placed by it. */
  faceRect: Box
}

export interface SpriteImage {
  file: string
  /** Cell size. Strips are frame-major, then draw-priority bands back to front. */
  w: number
  h: number
  layers?: number
  frameCount?: number
  animation?: SpriteAnimationFrame[]
  /** Same-layout strip of the untinted recolourable hair pixels (tinted per run in ClassSprite). */
  hair?: string
}

export interface SpriteHeadOffset { x: number; y: number; variant?: 'small' | 'large' }

/**
 * [cell, delay (1/60 s)] or [cell, delay, headX, headY] when the head bobs off the body's rest
 * offset. The head always shows the same cell as the body (tools/assets/extract_sprites.py ›
 * compact_animation).
 */
export type SpriteAnimationFrame = [cell: number, delay: number, headX?: number, headY?: number]

export interface SpriteBody extends SpriteImage {
  /** Mounted (and some other) classes draw the unit's 16×16 "small" head cell instead of the 32×32 one. */
  head: SpriteHeadOffset | null
}

interface SpriteHead extends SpriteImage {
  small?: SpriteImage
}

interface PortraitManifest { generatedAt?: string; units: Record<string, PortraitEntry> }
interface SpriteManifest {
  generatedAt?: string
  bodies: Record<string, SpriteBody>
  heads: Record<string, SpriteHead>
  genericHeads?: Record<string, SpriteHead>
  unique?: Record<string, Record<string, SpriteImage>>
  /** FaceData default hair colour per unit (`#rrggbb`). */
  hairColours?: Record<string, string>
}
interface VanityManifest {
  generatedAt: string
  dragonHare: { portraits: Record<string, PortraitEntry> }
  furryFates: {
    portraits: Record<string, PortraitEntry>
    sprites: Pick<SpriteManifest, 'bodies' | 'heads'> & { unitBodies: Record<string, Record<string, SpriteBody>> }
  }
}

const manifests = import.meta.glob<{ default: unknown }>(['./portraits.json', './sprites.json', './vanityArt.json'], { eager: true })

function manifest<T>(name: string): T | null {
  return (manifests[`./${name}.json`]?.default as T | undefined) ?? null
}

const PORTRAITS = manifest<PortraitManifest>('portraits')
const SPRITES = manifest<SpriteManifest>('sprites')
const VANITY = manifest<VanityManifest>('vanityArt')

export const ASSETS_ENABLED = import.meta.env.VITE_ASSETS !== 'off'

const BASE_URL = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
// Asset URLs carry the manifest's generation stamp: the service worker caches images CacheFirst by
// URL, and regenerated files keep their names (the sprite strips changed layout on regeneration).
const url = (file: string, version?: string) => `${BASE_URL}${file}${version ? `?v=${encodeURIComponent(version)}` : ''}`

export interface PortraitArt {
  src: string
  /** Crop box in image pixels; null means the image is already a face crop. */
  box: Box | null
  w: number
  h: number
  /** Tinted at run time over the base (same canvas). */
  hair: PortraitHair | null
}

const hairArt = (hair: PortraitHair | undefined, version?: string): PortraitHair | null =>
  hair ? { ...hair, file: url(hair.file, version) } : null

function portraitEntry(unitId: string, mods: readonly string[]): { entry: PortraitEntry; version?: string } | null {
  const variant = mods.includes('dragon-hare-corrin') ? VANITY?.dragonHare.portraits[unitId] : undefined
  const furry = mods.includes('furry-fates') ? VANITY?.furryFates.portraits[unitId] : undefined
  if (variant || furry) return { entry: (variant ?? furry)!, version: VANITY?.generatedAt }
  const base = PORTRAITS?.units[unitId]
  return base ? { entry: base, version: PORTRAITS?.generatedAt } : null
}

export function portraitArt(unitId: string, crop: 'face' | 'bust', mods: readonly string[] = []): PortraitArt | null {
  if (!ASSETS_ENABLED) return null
  const found = portraitEntry(unitId, mods)
  if (found) {
    const { entry, version } = found
    return {
      src: url(entry.file, version),
      box: entry[crop],
      w: entry.w,
      h: entry.h,
      hair: hairArt(entry.hair, version),
    }
  }
  const legacy = assetUrl('unit', unitId)
  return legacy ? { src: legacy, box: null, w: 128, h: 128, hair: null } : null
}

export interface HeroArt {
  src: string
  w: number
  h: number
  faceRect: Box
  hair: PortraitHair | null
}

/** The character page hero: the talk portrait, placed and zoomed by its face rect. */
export function heroArt(unitId: string, mods: readonly string[] = []): HeroArt | null {
  if (!ASSETS_ENABLED) return null
  const found = portraitEntry(unitId, mods)
  const entry = found?.entry
  if (!entry?.faceRect) return null
  return {
    src: url(entry.file, found?.version),
    w: entry.w,
    h: entry.h,
    faceRect: entry.faceRect,
    hair: hairArt(entry.hair, found?.version),
  }
}

export type SpriteLayers =
  | { kind: 'stitched'; body: SpriteBody; head: SpriteImage | null; smallHead: SpriteImage | null; offset: SpriteBody['head'] }
  | { kind: 'single'; image: SpriteImage }

export function spriteLayers(unitId: string | null, classId: number, mods: readonly string[] = []): SpriteLayers | null {
  if (!ASSETS_ENABLED) return null
  if (SPRITES) {
    const furry = mods.includes('furry-fates') ? VANITY?.furryFates.sprites : undefined
    const unitBody = unitId ? furry?.unitBodies?.[unitId]?.[String(classId)] : undefined
    const unique = !unitBody && unitId ? SPRITES.unique?.[unitId]?.[String(classId)] : undefined
    if (unique) return { kind: 'single', image: withUrl(unique, SPRITES.generatedAt) }
    const variantBody = unitBody ?? furry?.bodies[String(classId)]
    const body = variantBody ?? SPRITES.bodies[String(classId)]
    if (body) {
      const variantHead = unitId ? furry?.heads[unitId] : undefined
      const heads = variantHead ?? (unitId ? SPRITES.heads[unitId] : undefined) ?? SPRITES.genericHeads?.[String(classId)]
      return {
        kind: 'stitched',
        body: withUrl(body, variantBody ? VANITY?.generatedAt : SPRITES.generatedAt),
        head: heads && body.head ? withUrl(heads, variantHead ? VANITY?.generatedAt : SPRITES.generatedAt) : null,
        smallHead: heads?.small && body.head ? withUrl(heads.small, variantHead ? VANITY?.generatedAt : SPRITES.generatedAt) : null,
        offset: body.head,
      }
    }
  }
  const legacy = assetUrl('class', classId)
  return legacy ? { kind: 'single', image: { file: legacy, w: 32, h: 32 } } : null
}

function withUrl<T extends SpriteImage>(image: T, version?: string): T {
  const resolved = { ...image, file: url(image.file, version) }
  if (image.hair) resolved.hair = url(image.hair, version)
  return resolved
}

/** A unit's FaceData hair colour — what their sprite strips are baked with, and what they pass on. */
export function defaultHairColour(unitId: string): string | null {
  return SPRITES?.hairColours?.[unitId] ?? null
}
