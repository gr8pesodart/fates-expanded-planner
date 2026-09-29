import { describe, expect, it } from 'vitest'
import spritesJson from './sprites.json'

interface SpriteHead {
  file: string
  w: number
  h: number
  source: string
  small?: SpriteHead
}

interface BodyEntry {
  file: string
  w: number
  h: number
  head: { x: number; y: number; behind?: boolean; variant?: 'small' | 'large' } | null
  source: string
}

interface SpriteManifest {
  generatedAt: string
  source: string
  coverage: Record<string, { resolved: number; total: number }>
  bodies: Record<string, BodyEntry>
  heads: Record<string, SpriteHead>
  genericHeads: Record<string, SpriteHead>
  unique: Record<string, Record<string, { file: string; w: number; h: number; source: string }>>
}

const manifest = spritesJson as unknown as SpriteManifest

const spriteFiles = new Set(
  Object.keys(import.meta.glob('../../public/assets/sprites/**/*.webp')).map((path) =>
    path.replace('../../public/', ''),
  ),
)

function exists(file: string): boolean {
  return spriteFiles.has(file)
}

function headFiles(entry: SpriteHead): string[] {
  return [entry.file, ...(entry.small ? [entry.small.file] : [])]
}

describe('stitched sprite manifest', () => {
  it('covers at least 90% of bodies and heads', () => {
    expect(manifest.coverage.bodies.resolved / manifest.coverage.bodies.total).toBeGreaterThanOrEqual(0.9)
    expect(manifest.coverage.heads.resolved / manifest.coverage.heads.total).toBeGreaterThanOrEqual(0.9)
    expect(manifest.coverage.heads.total).toBe(71)
  })

  it('every body entry has a file on disk and source provenance', () => {
    expect(Object.keys(manifest.bodies).length).toBeGreaterThan(0)
    for (const entry of Object.values(manifest.bodies)) {
      expect(exists(entry.file)).toBe(true)
      expect(entry.w).toBe(32)
      expect(entry.h).toBe(32)
      expect(entry.source).toContain('anime.bin')
      if (entry.head) {
        expect(Number.isFinite(entry.head.x)).toBe(true)
        expect(Number.isFinite(entry.head.y)).toBe(true)
      }
    }
  })

  it('every unit has a large head and a small head on disk', () => {
    const entries = Object.values(manifest.heads)
    expect(entries.length).toBe(71)
    for (const entry of entries) {
      expect(entry.w).toBe(32)
      expect(entry.h).toBe(32)
      expect(entry.source.startsWith('unit/Head/')).toBe(true)
      expect(exists(entry.file)).toBe(true)
      expect(entry.small?.w).toBe(16)
      expect(entry.small?.h).toBe(16)
      expect(exists(entry.small!.file)).toBe(true)
    }
  })

  it('every generic head and unique override has a file on disk', () => {
    for (const entry of Object.values(manifest.genericHeads)) {
      for (const file of headFiles(entry)) expect(exists(file)).toBe(true)
    }
    const uniqueEntries = Object.values(manifest.unique).flatMap((perClass) => Object.values(perClass))
    expect(uniqueEntries.length).toBeGreaterThan(0)
    for (const entry of uniqueEntries) {
      expect(exists(entry.file)).toBe(true)
      expect(entry.source.startsWith('unit/Unique/')).toBe(true)
    }
  })

  it('marks mounted bodies as using the small head variant', () => {
    expect(manifest.bodies['7'].head?.variant).toBe('small')
    expect(manifest.bodies['31'].head?.variant).toBeUndefined()
    expect(manifest.bodies['103'].head).toBeNull()
  })
})
