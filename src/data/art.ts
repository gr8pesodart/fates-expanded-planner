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
  w: number
  h: number
}

export interface SpriteBody extends SpriteImage {
  head: { x: number; y: number; behind?: boolean } | null
}

export interface SplashEntry {
  file: string
  w: number
  h: number
  focal: { x: number; y: number }
}

interface PortraitManifest { units: Record<string, PortraitEntry> }
interface SpriteManifest {
  bodies: Record<string, SpriteBody>
  heads: Record<string, SpriteImage>
  genericHeads?: Record<string, SpriteImage>
  unique?: Record<string, Record<string, SpriteImage>>
}
interface SplashManifest { units: Record<string, SplashEntry> }

const manifests = import.meta.glob<{ default: unknown }>(['./portraits.json', './sprites.json', './splash.json'], { eager: true })

function manifest<T>(name: string): T | null {
  return (manifests[`./${name}.json`]?.default as T | undefined) ?? null
}

const PORTRAITS = manifest<PortraitManifest>('portraits')
const SPRITES = manifest<SpriteManifest>('sprites')
const SPLASH = manifest<SplashManifest>('splash')

export const ASSETS_ENABLED = import.meta.env.VITE_ASSETS !== 'off'

const BASE_URL = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
const url = (file: string) => `${BASE_URL}${file}`

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
  if (entry) return { src: url(entry.file), box: entry[crop], w: entry.w, h: entry.h }
  const legacy = assetUrl('unit', unitId)
  return legacy ? { src: legacy, box: null, w: 128, h: 128 } : null
}

export type SpriteLayers =
  | { kind: 'stitched'; body: SpriteImage; head: SpriteImage | null; offset: SpriteBody['head'] }
  | { kind: 'single'; image: SpriteImage }

export function spriteLayers(unitId: string | null, classId: number): SpriteLayers | null {
  if (!ASSETS_ENABLED) return null
  if (SPRITES) {
    const unique = unitId ? SPRITES.unique?.[unitId]?.[String(classId)] : undefined
    if (unique) return { kind: 'single', image: withUrl(unique) }
    const body = SPRITES.bodies[String(classId)]
    if (body) {
      const head = (unitId ? SPRITES.heads[unitId] : undefined) ?? SPRITES.genericHeads?.[String(classId)]
      return { kind: 'stitched', body: withUrl(body), head: head && body.head ? withUrl(head) : null, offset: body.head }
    }
  }
  const legacy = assetUrl('class', classId)
  return legacy ? { kind: 'single', image: { file: legacy, w: 32, h: 32 } } : null
}

function withUrl<T extends SpriteImage>(image: T): T {
  return { ...image, file: url(image.file) }
}

export function splashArt(unitId: string): (SplashEntry & { src: string }) | null {
  if (!ASSETS_ENABLED) return null
  const entry = SPLASH?.units[unitId]
  return entry ? { ...entry, src: url(entry.file) } : null
}
