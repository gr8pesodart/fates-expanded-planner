/// <reference types="node" />
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import portraitManifest from './portraits.json'

const publicDir = fileURLToPath(new URL('../../public/', import.meta.url))

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
})
