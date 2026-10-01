import { beforeAll, describe, expect, it } from 'vitest'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import { emptyRun } from '../state/model'
import { setBond, setVariableParent, swapPair, variableParentOf } from './relationships'

let dataset: Dataset

beforeAll(async () => {
  dataset = await loadDataset('ugf-2.5.2')
})

const CORRIN_F = 'PID_プレイヤー女'
const KANA_M = 'PID_カンナ男'
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

  it('stores the A+ choice on the selecting unit only', () => {
    const run = setBond(emptyRun('t'), RYOMA, 'aPlusPartner', ANNA)
    expect(run.units[RYOMA].aPlusPartner).toBe(ANNA)
    expect(run.units[ANNA]?.aPlusPartner).toBeUndefined()
  })

  it('keeps each unit\'s one-way A+ choice independent', () => {
    let run = setBond(emptyRun('t'), ANNA, 'aPlusPartner', JAKOB)
    run = setBond(run, RYOMA, 'aPlusPartner', ANNA)
    expect(run.units[ANNA].aPlusPartner).toBe(JAKOB)
    expect(run.units[RYOMA].aPlusPartner).toBe(ANNA)
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
})
