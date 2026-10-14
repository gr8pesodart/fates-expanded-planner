import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_DLC_IDS } from '../data/dlcs'
import { loadDataset } from '../data/loader'
import type { Dataset } from '../data/types'
import { corrinBuild, emptyRun, PLAN_SCHEMA, withCorrinBuild } from '../state/model'
import type { RunPlan } from '../state/model'
import { migratePlanDocument, parsePlanDocument } from '../state/serialization'
import { unitContext } from './army'
import { expandLegacyCorrin, switchCorrinGender } from './corrin'
import { setBond, variableParentOf } from './relationships'

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

const classId = (name: string) => dataset.classes.find((item) => item.name === name)!.id

describe('per-gender Corrin', () => {
  it('keeps each gender\'s marriage: switching away releases the partner, switching back re-marries', () => {
    let run = setBond(emptyRun('t'), CORRIN_F, 'sPartner', ANNA)
    run = switchCorrinGender(dataset, run, 'male')
    expect(run.units[ANNA].sPartner).toBeUndefined()
    expect(run.units[CORRIN_F].sPartner).toBe(ANNA)
    expect(unitContext(dataset, run, CORRIN_M)!.sPartner).toBeUndefined()

    run = switchCorrinGender(dataset, run, 'female')
    expect(run.units[ANNA].sPartner).toBe(CORRIN_F)
    expect(unitContext(dataset, run, CORRIN_F)!.sPartner?.id).toBe(ANNA)
    expect(variableParentOf(dataset, run, KANA_M)).toBe(ANNA)
  })

  it('reports a partner taken while the other Corrin was active as stale, granting nothing', () => {
    let run = setBond(emptyRun('t'), CORRIN_F, 'sPartner', ANNA)
    run = switchCorrinGender(dataset, run, 'male')
    run = setBond(run, JAKOB, 'sPartner', ANNA)
    run = switchCorrinGender(dataset, run, 'female')
    expect(run.units[ANNA].sPartner).toBe(JAKOB)
    const ctx = unitContext(dataset, run, CORRIN_F)!
    expect(ctx.sPartner).toBeUndefined()
    expect(ctx.stale.sPartner?.id).toBe(ANNA)
    expect(ctx.pool.some((entry) => entry.branch === 'seal')).toBe(false)
    expect(variableParentOf(dataset, run, KANA_M)).toBeUndefined()

    // Picking Anna again takes her back from Jakob.
    run = setBond(run, CORRIN_F, 'sPartner', ANNA)
    expect(run.units[JAKOB].sPartner).toBeUndefined()
    expect(unitContext(dataset, run, CORRIN_F)!.stale.sPartner).toBeUndefined()
  })

  it('keeps boon, bane and talent per gender and carries the favourite star', () => {
    let run = withCorrinBuild(emptyRun('t'), { boon: 'str', bane: 'res', talentClassId: classId('Samurai (F)') })
    run = { ...run, favourites: [CORRIN_F, KANA_M] }
    run = switchCorrinGender(dataset, run, 'male')
    expect(corrinBuild(run)).toEqual({ boon: 'spd', bane: 'lck', talentClassId: null })
    expect(run.favourites).toEqual([CORRIN_M, KANA_F])
    run = switchCorrinGender(dataset, run, 'female')
    expect(corrinBuild(run)).toMatchObject({ boon: 'str', bane: 'res' })
  })

  it('restores pair-up with the partner on the other side of the pair', () => {
    let run = setBond(emptyRun('t'), CORRIN_F, 'pairPartner', RYOMA)
    run = switchCorrinGender(dataset, run, 'male')
    expect(run.units[RYOMA].pairPartner).toBeUndefined()
    run = switchCorrinGender(dataset, run, 'female')
    expect([run.units[CORRIN_F].pairRole, run.units[RYOMA].pairRole]).toEqual(['front', 'back'])
  })
})

describe('schema 4 migration', () => {
  // A real schema 4 run: one Corrin build and the old single DLC switch, no `dlcs` list yet.
  const legacyRun = () => {
    const base = { ...emptyRun('old'), dlc: true, festivalDlc: true } as Record<string, unknown>
    delete base.dlcs
    return {
      ...base,
      corrin: { gender: 'female', boon: 'mag', bane: 'def', talentClassId: classId('Samurai (F)') },
      units: {
        [CORRIN_F]: { skills: [null, null, null, null, null], reclasses: [{ segment: 0, level: 10, classId: classId('Samurai (F)') }], sPartner: RYOMA },
        [RYOMA]: { skills: [null, null, null, null, null], reclasses: [], sPartner: CORRIN_F },
      },
    }
  }

  it('reads an old export as both genders\' data', () => {
    const json = JSON.stringify({ schema: 4, runs: [legacyRun()], activeRunId: 'old' })
    const document = parsePlanDocument(json)
    expect(document.schema).toBe(PLAN_SCHEMA)
    const run = expandLegacyCorrin(dataset, document.runs[0])
    expect(run.corrin.legacy).toBeUndefined()
    expect(run.corrin.builds.female).toEqual({ boon: 'mag', bane: 'def', talentClassId: classId('Samurai (F)') })
    expect(run.corrin.builds.male).toEqual({ boon: 'mag', bane: 'def', talentClassId: classId('Samurai (M)') })
    expect(run.units[CORRIN_M].reclasses[0].classId).toBe(classId('Samurai (M)'))
    // Ryoma stays married to the active Corrin; the copy only keeps bonds Corrin (M) can hold.
    expect(run.units[RYOMA].sPartner).toBe(CORRIN_F)
  })

  it('migrates share payloads too', () => {
    const migrated = migratePlanDocument({ schema: 4, run: legacyRun() }) as { schema: number; run: RunPlan }
    expect(migrated.schema).toBe(PLAN_SCHEMA)
    expect(migrated.run.corrin.builds.male.boon).toBe('mag')
    expect(migrated.run.dlcs).toEqual([...DEFAULT_DLC_IDS, 'hoshidan-festival', 'nohrian-festival'])
    expect(migrated.run).not.toHaveProperty('festivalDlc')
  })
})
