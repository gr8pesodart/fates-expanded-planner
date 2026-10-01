import { beforeAll, describe, expect, it } from 'vitest'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import { emptyRun } from '../state/model'
import { hairColourOf } from './hair'
import { setBond } from './relationships'

let dataset: Dataset

beforeAll(async () => {
  dataset = await loadDataset('ugf-2.5.2')
})

const CORRIN_F = 'PID_プレイヤー女'
const KANA_M = 'PID_カンナ男'
const RYOMA = 'PID_リョウマ'
const CAMILLA = 'PID_カミラ'
const JAKOB = 'PID_ジョーカー'
const defaults = (unitId: string) => ({ [RYOMA]: '#58332d', [CAMILLA]: '#bfb7df', [JAKOB]: '#d2d2c3' })[unitId] ?? null

describe('hair colours', () => {
  it('gives Corrin the chosen swatch, or the default when none is chosen', () => {
    const run = emptyRun('t')
    expect(hairColourOf(dataset, run, CORRIN_F, defaults)).toBe('#f6f4ef')
    expect(hairColourOf(dataset, { ...run, corrin: { ...run.corrin, hairColour: '#4d81b5' } }, CORRIN_F, defaults)).toBe('#4d81b5')
  })

  it('gives children their variable parent\'s colour (Kana takes the non-Corrin parent\'s)', () => {
    const shiro = dataset.units.find((unit) => unit.fixedParent === RYOMA)!
    let run = setBond(emptyRun('t'), RYOMA, 'sPartner', CAMILLA)
    expect(hairColourOf(dataset, run, shiro.id, defaults)).toBe('#bfb7df')
    run = setBond({ ...run, corrin: { ...run.corrin, hairColour: '#4d81b5' } }, CORRIN_F, 'sPartner', JAKOB)
    expect(hairColourOf(dataset, run, KANA_M, defaults)).toBe('#d2d2c3')
  })

  it('passes Corrin\'s chosen colour on when Corrin is the variable parent', () => {
    const shiro = dataset.units.find((unit) => unit.fixedParent === RYOMA)!
    const base = emptyRun('t')
    const run = setBond({ ...base, corrin: { ...base.corrin, hairColour: '#c35855' } }, RYOMA, 'sPartner', CORRIN_F)
    expect(hairColourOf(dataset, run, shiro.id, defaults)).toBe('#c35855')
  })
})
