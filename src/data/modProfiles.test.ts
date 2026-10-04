import { describe, expect, it } from 'vitest'
import { getBuildProfile, selectedModIds } from './modProfiles'

describe('selectedModIds', () => {
  it('keeps UGF selected while the vanilla data pack is pending', () => {
    expect(selectedModIds('vanilla', ['texture-compilation', 'furry-fates'])).toEqual(['ugf', 'furry-fates'])
    expect(getBuildProfile('vanilla').packId).toBe('ugf-2.5.2')
  })

  it('defaults a new run to the installed mod set', () => {
    expect(selectedModIds('ugf-2.5.2')).toContain('ugf')
    expect(selectedModIds('ugf-2.5.2')).toEqual(['ugf', 'unisex-dlc-classes', 'furry-fates', 'dragon-hare-corrin'])
  })

  it('lists only planner data and vanity choices', () => {
    const mods = getBuildProfile('ugf-2.5.2').mods
    expect(mods.filter((mod) => mod.category === 'data').map((mod) => mod.id)).toEqual(['ugf', 'unisex-dlc-classes'])
    expect(mods.filter((mod) => mod.category === 'vanity').map((mod) => mod.id)).toEqual(['furry-fates', 'dragon-hare-corrin'])
  })
})
