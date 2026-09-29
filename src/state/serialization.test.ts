import { describe, expect, it } from 'vitest'
import { emptyRun, PLAN_SCHEMA } from './model'
import type { PlanDocument } from './model'
import { decodeSharedRun, encodeSharedRun, parsePlanDocument, serializePlanDocument } from './serialization'

describe('plan serialization', () => {
  it('round-trips a schema 3 export', () => {
    const run = emptyRun('run-test')
    const document: PlanDocument = { schema: PLAN_SCHEMA, runs: [run], activeRunId: run.id }

    expect(parsePlanDocument(serializePlanDocument(document))).toEqual(document)
  })

  it('round-trips a run through a share token', () => {
    const run = emptyRun('run-share')
    run.units.PID_Ryoma = {
      inArmy: true,
      sPartner: 'PID_Camilla',
      classRoute: [{ classId: 1, fromLevel: 1, toLevel: 10, via: 'start' }],
      skills: [1, null, 2, null, null],
    }

    expect(decodeSharedRun(encodeSharedRun(run))).toEqual(run)
  })

  it('rejects unsupported and malformed exports', () => {
    expect(() => parsePlanDocument('{')).toThrow('valid JSON')
    expect(() => parsePlanDocument('{"schema":1,"runs":[],"activeRunId":""}')).toThrow('schema 3')
  })
})
