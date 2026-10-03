/// <reference types="node" />
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { PortraitEntry } from './art'
import portraitManifest from './portraits.json'

const publicDir = fileURLToPath(new URL('../../public/', import.meta.url))
const units = portraitManifest.units as unknown as Record<string, PortraitEntry>

describe('portrait manifest', () => {
  it('resolves at least 90% of units', () => {
    const { resolved, total } = portraitManifest.coverage
    expect(resolved / total).toBeGreaterThanOrEqual(0.9)
  })

  it('ships every entry as a file under public/', () => {
    for (const entry of Object.values(portraitManifest.units)) {
      expect(entry.file.startsWith('assets/portraits/')).toBe(true)
      expect(existsSync(`${publicDir}${entry.file}`)).toBe(true)
    }
  })

  it('keeps face and bust crops square and inside the image', () => {
    for (const entry of Object.values(portraitManifest.units)) {
      expect(entry.w).toBeGreaterThan(0)
      expect(entry.h).toBeGreaterThan(0)
      for (const box of [entry.face, entry.bust]) {
        const [x, y, width, height] = box
        expect(width).toBe(height)
        expect(x).toBeGreaterThanOrEqual(0)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(x + width).toBeLessThanOrEqual(entry.w)
        expect(y + height).toBeLessThanOrEqual(entry.h)
      }
    }
  })

  it("ships every recolourable hair layer on its base's canvas", () => {
    const layers = Object.values(units).flatMap((entry) => [
      ...(entry.hair ? [{ hair: entry.hair, w: entry.w, h: entry.h }] : []),
      ...(entry.ct?.hair ? [{ hair: entry.ct.hair, w: entry.ct.w, h: entry.ct.h }] : []),
      ...(entry.ct?.hairBack ? [{ hair: entry.ct.hairBack, w: entry.ct.w, h: entry.ct.h }] : []),
    ])
    expect(layers.length).toBe(23 * 2 + 1)
    for (const { hair, w, h } of layers) {
      expect(existsSync(`${publicDir}${hair.file}`)).toBe(true)
      expect([hair.w, hair.h]).toEqual([w, h])
    }
  })

  it("draws only Nina's cut-in braid behind the base (extract_portraits.py › BACK_HAIR_SEEDS)", () => {
    const withBack = Object.entries(units).filter(([, entry]) => entry.ct?.hairBack)
    expect(withBack.map(([unitId]) => unitId)).toEqual(['PID_エポニーヌ'])
  })
})
