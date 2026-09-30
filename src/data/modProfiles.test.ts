import { describe, expect, it } from 'vitest'
import { getBuildProfile, selectedModIds } from './modProfiles'

describe('selectedModIds', () => {
  it('keeps UGF selected while the vanilla data pack is pending', () => {
    expect(selectedModIds('vanilla', ['texture-compilation'])).toEqual(['ugf', 'texture-compilation'])
    expect(getBuildProfile('vanilla').packId).toBe('ugf-2.5.2')
  })

  it('defaults a new run to the installed mod set', () => {
    expect(selectedModIds('ugf-2.5.2')).toContain('ugf')
    expect(selectedModIds('ugf-2.5.2')).toContain('free-renown')
  })
})
