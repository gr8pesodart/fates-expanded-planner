import { describe, expect, it } from 'vitest'
import { decodeSharedRun, encodeSharedRun, parsePlanDocument, serializePlanDocument } from './serialization'
import { emptyRun, emptyUnitPlan, PLAN_SCHEMA } from './model'
import type { PlanDocument } from './model'
import { parseHash } from '../lib/router'
import { shareUrlForRun } from './serialization'

describe('plan serialization', () => {
  it('round-trips an export', () => {
    const run = emptyRun('run-test')
    const document: PlanDocument = { schema: PLAN_SCHEMA, runs: [run], activeRunId: run.id }

    expect(parsePlanDocument(serializePlanDocument(document))).toEqual(document)
  })

  it('round-trips a run through a share token', () => {
    const run = emptyRun('run-share')
    run.units.PID_Ryoma = {
      sPartner: 'PID_Camilla',
      pairPartner: 'PID_Camilla',
      pairRole: 'front',
      reclasses: [{ segment: 0, level: 10, classId: 31 }],
      skills: [1, null, 2, null, null],
    }

    expect(decodeSharedRun(encodeSharedRun(run))).toEqual(run)
  })

  it('preserves plus signs in the copied chart URL', () => {
    const run = emptyRun('run-share')
    run.createdAt = '2026-09-29T00:00:00.000Z'
    run.updatedAt = '2026-09-29T00:00:00.000Z'
    for (let i = 0; !encodeSharedRun(run).includes('+') && i < 200; i += 1) run.name = `Run ${i}`
    const token = encodeSharedRun(run)
    expect(token).toContain('+')

    const route = parseHash(new URL(shareUrlForRun(run, 'https://planner.test/#/roster')).hash)
    expect(route).toEqual({ name: 'chart', shareToken: token })
    expect(decodeSharedRun(route.name === 'chart' ? route.shareToken! : '')).toEqual(run)
  })

  it('rejects unsupported and malformed exports', () => {
    expect(() => parsePlanDocument('{')).toThrow('valid JSON')
    expect(() => parsePlanDocument('{"schema":1,"runs":[],"activeRunId":""}')).toThrow(`schema ${PLAN_SCHEMA}`)
  })
})

describe('unit notes', () => {
  it('keeps multiline notes in exports and share links', () => {
    const run = emptyRun('notes')
    run.units.ryoma = { ...emptyUnitPlan(), note: 'First line\nSecond line' }
    const document = { schema: PLAN_SCHEMA, runs: [run], activeRunId: run.id }
    expect(parsePlanDocument(serializePlanDocument(document)).runs[0].units.ryoma.note).toBe('First line\nSecond line')
    expect(decodeSharedRun(encodeSharedRun(run)).units.ryoma.note).toBe('First line\nSecond line')
  })

  it('rejects a note that is not text', () => {
    const run = emptyRun('notes')
    const document = { schema: PLAN_SCHEMA, runs: [{ ...run, units: { ryoma: { ...emptyUnitPlan(), note: 12 } } }], activeRunId: run.id }
    expect(() => parsePlanDocument(JSON.stringify(document))).toThrow()
  })
})
