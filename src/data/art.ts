import { assetUrl } from './assets'

/**
 * v3 art manifests (docs/ASSETS.md). Each is optional at build time: until its extractor has run,
 * lookups fall back to the v2 set (bust faces, body-only class sprites) or a monogram.
 */
type Box = [number, number, number, number]

export interface PortraitEntry {
  file: string
  w: number
  h: number
  face: Box
  bust: Box
}

export interface SpriteImage {
  file: string
  /** Cell size. Strips are frame-major, then draw-priority bands back to front. */
  w: number
  h: number
  layers?: number
  frameCount?: number
  animation?: SpriteAnimationFrame[]
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

export interface SplashEntry {
  file: string
  w: number
  h: number
  focal: { x: number; y: number }
}

interface PortraitManifest { generatedAt?: string; units: Record<string, PortraitEntry> }
interface SpriteManifest {
  generatedAt?: string
  bodies: Record<string, SpriteBody>
  heads: Record<string, SpriteHead>
  genericHeads?: Record<string, SpriteHead>
  unique?: Record<string, Record<string, SpriteImage>>
}
interface SplashManifest { generatedAt?: string; units: Record<string, SplashEntry> }

const manifests = import.meta.glob<{ default: unknown }>(['./portraits.json', './sprites.json', './splash.json'], { eager: true })

function manifest<T>(name: string): T | null {
  return (manifests[`./${name}.json`]?.default as T | undefined) ?? null
}

const PORTRAITS = manifest<PortraitManifest>('portraits')
const SPRITES = manifest<SpriteManifest>('sprites')
const SPLASH = manifest<SplashManifest>('splash')

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
}

export function portraitArt(unitId: string, crop: 'face' | 'bust'): PortraitArt | null {
  if (!ASSETS_ENABLED) return null
  const entry = PORTRAITS?.units[unitId]
  if (entry) return { src: url(entry.file, PORTRAITS?.generatedAt), box: entry[crop], w: entry.w, h: entry.h }
  const legacy = assetUrl('unit', unitId)
  return legacy ? { src: legacy, box: null, w: 128, h: 128 } : null
}

export type SpriteLayers =
  | { kind: 'stitched'; body: SpriteBody; head: SpriteImage | null; smallHead: SpriteImage | null; offset: SpriteBody['head'] }
  | { kind: 'single'; image: SpriteImage }

export function spriteLayers(unitId: string | null, classId: number): SpriteLayers | null {
  if (!ASSETS_ENABLED) return null
  if (SPRITES) {
    const unique = unitId ? SPRITES.unique?.[unitId]?.[String(classId)] : undefined
    if (unique) return { kind: 'single', image: withUrl(unique) }
    const body = SPRITES.bodies[String(classId)]
    if (body) {
      const heads = (unitId ? SPRITES.heads[unitId] : undefined) ?? SPRITES.genericHeads?.[String(classId)]
      return {
        kind: 'stitched',
        body: withUrl(body),
        head: heads && body.head ? withUrl(heads) : null,
        smallHead: heads?.small && body.head ? withUrl(heads.small) : null,
        offset: body.head,
      }
    }
  }
  const legacy = assetUrl('class', classId)
  return legacy ? { kind: 'single', image: { file: legacy, w: 32, h: 32 } } : null
}

function withUrl<T extends SpriteImage>(image: T): T {
  return { ...image, file: url(image.file, SPRITES?.generatedAt) }
}

export function splashArt(unitId: string): (SplashEntry & { src: string }) | null {
  if (!ASSETS_ENABLED) return null
  const entry = SPLASH?.units[unitId]
  return entry ? { ...entry, src: url(entry.file, SPLASH?.generatedAt) } : null
}

let warmedSplash: { src: string; image: HTMLImageElement } | null = null

export function preloadSplashArt(unitId: string): void {
  const art = splashArt(unitId)
  if (!art || warmedSplash?.src === art.src) return
  const image = new Image()
  image.fetchPriority = 'high'
  image.decoding = 'async'
  image.src = art.src
  warmedSplash = { src: art.src, image }
  void image.decode().catch(() => {})
}
