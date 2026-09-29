/// <reference types="node" />
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import splashManifest from './splash.json'

const publicDir = fileURLToPath(new URL('../../public/', import.meta.url))

describe('splash manifest', () => {
  it('resolves at least 90% of units', () => {
    const { resolved, total } = splashManifest.coverage
    expect(resolved / total).toBeGreaterThanOrEqual(0.9)
  })

  it('ships every header crop with a focal point inside it and a source page', () => {
    for (const entry of Object.values(splashManifest.units)) {
      expect(existsSync(`${publicDir}${entry.file}`)).toBe(true)
      expect(entry.focal.x).toBeGreaterThanOrEqual(0)
      expect(entry.focal.x).toBeLessThanOrEqual(1)
      expect(entry.focal.y).toBeGreaterThanOrEqual(0)
      expect(entry.focal.y).toBeLessThanOrEqual(1)
      expect(entry.source).toMatch(/^https:\/\/fireemblemwiki\.org\//)
    }
  })
})
