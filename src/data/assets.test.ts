import { describe, expect, it } from 'vitest'
import { ASSET_MANIFEST, assetUrl } from './assets'

describe('asset manifest', () => {
  it('resolves at least 90% of every set', () => {
    for (const set of Object.values(ASSET_MANIFEST.coverage)) {
      expect(set.resolved / set.total).toBeGreaterThanOrEqual(0.9)
    }
  })

  it('maps units, classes and skills to asset files', () => {
    expect(assetUrl('unit', 'PID_リョウマ')).toContain('assets/units/')
    expect(assetUrl('class', 31)).toContain('assets/classes/31.webp')
    expect(assetUrl('skill', 131)).toContain('assets/skills/131.webp')
    expect(assetUrl('skill', -1)).toBeUndefined()
  })

  it('records a source file for every entry', () => {
    for (const set of [ASSET_MANIFEST.skills, ASSET_MANIFEST.classes, ASSET_MANIFEST.units]) {
      for (const entry of Object.values(set)) {
        expect(entry.source.length).toBeGreaterThan(0)
        expect(entry.file.startsWith('assets/')).toBe(true)
      }
    }
  })
})
