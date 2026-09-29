import { beforeAll, describe, expect, it } from 'vitest'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import { emptyRun } from '../state/model'
import { setBond, setVariableParent, swapPair, switchCorrinGender, variableParentOf } from './relationships'

let dataset: Dataset

beforeAll(async () => {
  dataset = await loadDataset('ugf-2.5.2')
})

const CORRIN_F = 'PID_プレイヤー女'
const CORRIN_M = 'PID_プレイヤー男'
const KANA_M = 'PID_カンナ男'
const KANA_F = 'PID_カンナ女'
const ANNA = 'PID_アンナ'
const JAKOB = 'PID_ジョーカー'
const RYOMA = 'PID_リョウマ'

describe('relationships', () => {
  it('writes S bonds on both sides and unlinks previous partners', () => {
    let run = setBond(emptyRun('t'), CORRIN_F, 'sPartner', ANNA)
    expect(run.units[ANNA].sPartner).toBe(CORRIN_F)
    run = setBond(run, JAKOB, 'sPartner', ANNA)
    expect(run.units[ANNA].sPartner).toBe(JAKOB)
    expect(run.units[CORRIN_F].sPartner).toBeUndefined()
  })

  it('treats a child\'s Parent B as the fixed parent\'s S partner', () => {
    let run = setVariableParent(dataset, emptyRun('t'), KANA_M, ANNA)
    expect(run.units[CORRIN_F].sPartner).toBe(ANNA)
    expect(variableParentOf(dataset, run, KANA_M)).toBe(ANNA)
    run = setBond(run, CORRIN_F, 'sPartner', JAKOB)
    expect(variableParentOf(dataset, run, KANA_M)).toBe(JAKOB)
  })

  it('pairs front/back and swaps both roles', () => {
    let run = setBond(emptyRun('t'), CORRIN_F, 'pairPartner', ANNA)
    expect([run.units[CORRIN_F].pairRole, run.units[ANNA].pairRole]).toEqual(['front', 'back'])
    run = swapPair(run, ANNA)
    expect([run.units[CORRIN_F].pairRole, run.units[ANNA].pairRole]).toEqual(['back', 'front'])
    run = setBond(run, CORRIN_F, 'pairPartner', null)
    expect(run.units[ANNA].pairPartner).toBeUndefined()
    expect(run.units[ANNA].pairRole).toBeUndefined()
  })

  it('moves Corrin and Kana plans across a gender switch', () => {
    let run = setBond(emptyRun('t'), CORRIN_F, 'sPartner', RYOMA)
    run = setBond(run, KANA_M, 'aPlusPartner', JAKOB)
    run = { ...run, favourites: [CORRIN_F] }
    run = switchCorrinGender(dataset, run, 'male')
    expect(run.units[CORRIN_M].sPartner).toBe(RYOMA)
    expect(run.units[RYOMA].sPartner).toBe(CORRIN_M)
    expect(run.units[KANA_F].aPlusPartner).toBe(JAKOB)
    expect(run.units[JAKOB].aPlusPartner).toBe(KANA_F)
    expect(run.favourites).toEqual([CORRIN_M])
  })
})
