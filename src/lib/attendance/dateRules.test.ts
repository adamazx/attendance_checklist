/**
 * Unit tests for the attendance day rules — run with `pnpm test`.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { checkAttendanceDay } from './dateRules.ts'

const TODAY = '2026-11-02'

test('checkAttendanceDay: today and past days in range are allowed', () => {
  assert.equal(checkAttendanceDay(TODAY, TODAY), null)
  assert.equal(checkAttendanceDay('2026-05-15', TODAY), null)
  assert.equal(checkAttendanceDay('2025-01-01', TODAY), null)
})

test('checkAttendanceDay: a malformed or impossible day is invalid', () => {
  assert.equal(checkAttendanceDay('2026-02-31', TODAY), 'invalid')
  assert.equal(checkAttendanceDay('2026-11', TODAY), 'invalid')
  assert.equal(checkAttendanceDay('', TODAY), 'invalid')
})

test('checkAttendanceDay: a day after today is future', () => {
  assert.equal(checkAttendanceDay('2026-11-03', TODAY), 'future')
  assert.equal(checkAttendanceDay('2027-01-01', TODAY), 'future')
})

test('checkAttendanceDay: a day before the previous calendar year is too old', () => {
  assert.equal(checkAttendanceDay('2024-12-31', TODAY), 'too_old')
})
