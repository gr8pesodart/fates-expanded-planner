/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { heroArt, portraitArt, spriteLayers } from './art'
import basePortraits from './portraits.json'
import vanity from './vanityArt.json'

const publicFile = (file: string) => join(process.cwd(), 'public', ...file.split('/'))

describe('installed vanity art', () => {
  it('ships distinct alternate portraits for both Corrins and four beast units', () => {
    expect(Object.keys(vanity.dragonHare.portraits)).toHaveLength(2)
    expect(Object.keys(vanity.furryFates.portraits)).toHaveLength(4)
    for (const [mod, entries] of Object.entries({
      'dragon-hare-corrin': vanity.dragonHare.portraits,
      'furry-fates': vanity.furryFates.portraits,
    })) {
      for (const [id, entry] of Object.entries(entries)) {
        const base = basePortraits.units[id as keyof typeof basePortraits.units]
        expect(base).toBeDefined()
        expect(existsSync(publicFile(entry.file))).toBe(true)
        expect(readFileSync(publicFile(entry.file)).equals(readFileSync(publicFile(base.file)))).toBe(false)
        if ('hair' in entry && entry.hair) expect(existsSync(publicFile(entry.hair.file))).toBe(true)
        expect(portraitArt(id, 'face', [mod])?.src).toContain(entry.file)
        expect(heroArt(id, [mod])?.src).toContain(entry.file)
        expect(portraitArt(id, 'face', [])?.src).toContain(base.file)
      }
    }
  })

  it('ships Furry Fates heads, a Kitsune body and every staged Kaden/Keaton unit body', () => {
    const { bodies, heads, unitBodies } = vanity.furryFates.sprites
    expect(Object.keys(bodies)).toEqual(['99'])
    expect(Object.keys(heads)).toHaveLength(2)
    expect(Object.values(unitBodies).flatMap(Object.values)).toHaveLength(20)
    for (const body of [...Object.values(bodies), ...Object.values(unitBodies).flatMap(Object.values)]) {
      expect(existsSync(publicFile(body.file))).toBe(true)
      expect(body.animation.length).toBeGreaterThan(0)
    }
    for (const head of Object.values(heads)) {
      expect(existsSync(publicFile(head.file))).toBe(true)
      expect(head.small && existsSync(publicFile(head.small.file))).toBe(true)
    }
    const [kaden, kadenBodies] = Object.entries(unitBodies).find(([id, entries]) => id in heads && '101' in entries)!
    expect(spriteLayers(kaden, 99, ['furry-fates'])).toMatchObject({ kind: 'stitched', body: { file: expect.stringContaining(bodies['99'].file) } })
    const form = (kadenBodies as Record<string, { file: string }>)['101']
    expect(spriteLayers(kaden, 101, ['furry-fates'])).toMatchObject({ kind: 'stitched', body: { file: expect.stringContaining(form.file) } })
    expect(spriteLayers(kaden, 99, [])).not.toMatchObject({ body: { file: expect.stringContaining(bodies['99'].file) } })
  })
})
