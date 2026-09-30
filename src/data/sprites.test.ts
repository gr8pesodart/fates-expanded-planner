/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import spritesJson from './sprites.json'

interface SpriteHead {
  file: string
  w: number
  h: number
  layers: number
  frameCount: number
  source: string
  small?: SpriteHead
}

interface BodyEntry {
  file: string
  w: number
  h: number
  head: { x: number; y: number; variant?: 'small' | 'large' } | null
  layers?: number
  frameCount: number
  animation: number[][]
  source: string
}

interface FlatEntry {
  file: string
  w: number
  h: number
  frameCount: number
  animation: [number, number][]
  source: string
}

interface SpriteManifest {
  generatedAt: string
  source: string
  coverage: Record<string, { resolved: number; total: number }>
  bodies: Record<string, BodyEntry>
  heads: Record<string, SpriteHead>
  genericHeads: Record<string, SpriteHead>
  unique: Record<string, Record<string, FlatEntry>>
}

const manifest = spritesJson as unknown as SpriteManifest

function publicPath(file: string): string {
  return join(process.cwd(), 'public', ...file.split('/'))
}

function webpSize(buffer: Buffer): { width: number; height: number } {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('not a WebP file')
  }
  const chunk = buffer.toString('ascii', 12, 16)
  if (chunk === 'VP8 ') {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff }
  }
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') {
    return {
      width: 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)),
      height: 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)),
    }
  }
  throw new Error(`unknown WebP chunk ${chunk}`)
}

describe('stitched sprite manifest', () => {
  it('covers at least 90% of bodies and heads', () => {
    expect(manifest.coverage.bodies.resolved / manifest.coverage.bodies.total).toBeGreaterThanOrEqual(0.9)
    expect(manifest.coverage.heads.resolved / manifest.coverage.heads.total).toBeGreaterThanOrEqual(0.9)
    expect(manifest.coverage.heads.total).toBe(71)
  })

  it('every body entry contains the four unique idle poses with timing and provenance', () => {
    expect(Object.keys(manifest.bodies).length).toBeGreaterThan(0)
    for (const entry of Object.values(manifest.bodies)) {
      expect(entry.source).toContain('anime.bin')
      expect(entry.w).toBe(32)
      expect(entry.h).toBe(32)
      expect(entry.frameCount).toBe(4)
      expect(entry.animation.length).toBeGreaterThanOrEqual(4)
      expect(entry.animation.length).toBeLessThanOrEqual(6)
      expect(entry.animation.every(([cell, delay]) => cell >= 0 && cell < 4 && delay >= 0)).toBe(true)
      expect(entry.animation.every((frame) => frame.length === 2 || (frame.length === 4 && entry.head !== null))).toBe(true)
      const size = webpSize(readFileSync(publicPath(entry.file)))
      expect(size.height).toBe(entry.h)
      expect(size.width).toBe(entry.w * entry.frameCount * (entry.layers ?? 1))
      if (entry.head) {
        expect(entry.layers).toBe(1)
        expect(Number.isFinite(entry.head.x)).toBe(true)
        expect(Number.isFinite(entry.head.y)).toBe(true)
      } else {
        expect(entry.layers).toBeUndefined()
      }
    }
  })

  it('every unit has large and small [back | front] head strips on disk', () => {
    const entries = Object.values(manifest.heads)
    expect(entries.length).toBe(71)
    for (const entry of entries) {
      expect(entry.w).toBe(32)
      expect(entry.h).toBe(32)
      expect(entry.layers).toBe(2)
      expect(entry.frameCount).toBe(4)
      expect(entry.source.startsWith('unit/Head/')).toBe(true)
      expect(webpSize(readFileSync(publicPath(entry.file))).width).toBe(entry.w * entry.layers * entry.frameCount)
      expect(entry.small?.w).toBe(16)
      expect(entry.small?.h).toBe(16)
      expect(entry.small?.layers).toBe(2)
      expect(entry.small?.frameCount).toBe(4)
      expect(webpSize(readFileSync(publicPath(entry.small!.file))).width).toBe(entry.small!.w * entry.small!.layers * entry.small!.frameCount)
    }
  })

  it('every generic head and flat unique override has a file on disk', () => {
    for (const entry of Object.values(manifest.genericHeads)) {
      for (const head of [entry, ...(entry.small ? [entry.small] : [])]) {
        const size = webpSize(readFileSync(publicPath(head.file)))
        expect(size.width).toBe(head.w * (head.layers ?? 1) * (head.frameCount ?? 1))
        expect(size.height).toBe(head.h)
      }
    }
    const uniqueEntries = Object.values(manifest.unique).flatMap((perClass) => Object.values(perClass))
    expect(uniqueEntries.length).toBeGreaterThan(0)
    for (const entry of uniqueEntries) {
      expect(entry.source.startsWith('unit/Unique/')).toBe(true)
      const size = webpSize(readFileSync(publicPath(entry.file)))
      expect(size.width).toBe(entry.w * (entry.frameCount ?? 1))
      expect(size.height).toBe(entry.h)
    }
  })

  it('marks mounted bodies as using the small head variant', () => {
    expect(manifest.bodies['7'].head?.variant).toBe('small')
    expect(manifest.bodies['7'].layers).toBe(1)
    expect(manifest.bodies['31'].head?.variant).toBeUndefined()
    expect(manifest.bodies['103'].head).toBeNull()
    expect(manifest.bodies['103'].layers).toBeUndefined()
  })
})
