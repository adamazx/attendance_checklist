/**
 * Unit tests for the Thai-calendar-day helpers — run with `pnpm test`.
 * Guards the TZ off-by-one: a Bangkok-midnight instant must resolve to the
 * Bangkok day, never the previous UTC day.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  THAI_DAY_RE,
  formatThaiDateTime,
  formatThaiDay,
  formatThaiDayLong,
  formatThaiDayShort,
  isRealThaiDay,
  toThaiDay,
  todayThai,
} from './thaiDay.ts'

test('toThaiDay: Bangkok-midnight ISO keeps the Bangkok day (no UTC off-by-one)', () => {
  // 2026-11-01T00:00+07 === 2026-10-31T17:00Z — must stay 2026-11-01, not 2026-10-31.
  assert.equal(toThaiDay('2026-11-01T00:00:00+07:00'), '2026-11-01')
})

test('toThaiDay: a UTC instant late in the UTC day is already the next Bangkok day', () => {
  // 2026-10-31T18:00Z === 2026-11-01T01:00+07 in Bangkok.
  assert.equal(toThaiDay('2026-10-31T18:00:00Z'), '2026-11-01')
})

test('toThaiDay: a UTC instant early in the UTC day maps to the same Bangkok day', () => {
  // 2026-11-01T06:00Z === 2026-11-01T13:00+07.
  assert.equal(toThaiDay('2026-11-01T06:00:00Z'), '2026-11-01')
})

test('toThaiDay: a bare YYYY-MM-DD is returned as-is (idempotent, no shift)', () => {
  assert.equal(toThaiDay('2026-11-01'), '2026-11-01')
  assert.equal(toThaiDay(toThaiDay('2026-11-01')), '2026-11-01')
})

test('toThaiDay: invalid input throws', () => {
  assert.throws(() => toThaiDay('not-a-date'))
})

test('todayThai: returns a canonical YYYY-MM-DD', () => {
  assert.match(todayThai(), THAI_DAY_RE)
})

test('isRealThaiDay: rejects impossible calendar days', () => {
  assert.equal(isRealThaiDay('2026-11-02'), true)
  assert.equal(isRealThaiDay('2028-02-29'), true)
  assert.equal(isRealThaiDay('2026-02-31'), false)
  assert.equal(isRealThaiDay('2026-13-01'), false)
  assert.equal(isRealThaiDay('2026-11-2'), false)
})

test('formatThaiDay family: Buddhist-era year with Thai month names', () => {
  assert.equal(formatThaiDay('2026-11-02'), '2 พฤศจิกายน 2569')
  assert.equal(formatThaiDayShort('2026-11-02'), '2 พ.ย. 2569')
  assert.equal(formatThaiDayLong('2026-11-02'), 'วันจันทร์ที่ 2 พฤศจิกายน 2569')
})

test('formatThaiDateTime: renders the Bangkok day and time, not UTC', () => {
  // 2026-10-31T17:05Z === 2026-11-01 00:05 in Bangkok.
  assert.equal(formatThaiDateTime(new Date('2026-10-31T17:05:00Z')), '1 พ.ย. 2569, 00:05')
})
