import { describe, expect, it } from 'vitest'
import { emptyRun, PLAN_SCHEMA } from './model'
import type { PlanDocument } from './model'
import { parseHash } from '../lib/router'
import {
  decodeSharedRun,
  encodeSharedRun,
  parsePlanDocument,
  serializePlanDocument,
  shareUrlForRun,
} from './serialization'

describe('plan serialization', () => {
  it('round-trips a schema 4 export', () => {
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
    // Find a run whose token contains '+', the character URLSearchParams would turn into a space.
    for (let i = 0; !encodeSharedRun(run).includes('+') && i < 200; i += 1) run.name = `Run ${i}`
    const token = encodeSharedRun(run)
    expect(token).toContain('+')

    const route = parseHash(new URL(shareUrlForRun(run, 'https://planner.test/#/roster')).hash)
    expect(route).toEqual({ name: 'chart', shareToken: token })
    expect(decodeSharedRun(route.name === 'chart' ? route.shareToken! : '')).toEqual(run)
  })

  it('rejects unsupported and malformed exports', () => {
    expect(() => parsePlanDocument('{')).toThrow('valid JSON')
    expect(() => parsePlanDocument('{"schema":1,"runs":[],"activeRunId":""}')).toThrow('schema 4')
  })
})
