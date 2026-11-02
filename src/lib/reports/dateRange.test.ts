/**
 * Unit tests for the report date ranges — run with `pnpm test`.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { MAX_RANGE_DAYS, daysBetween, mondayOf, parseRange, quickRanges } from './dateRange.ts'

const TODAY = '2026-11-04' // a Wednesday

test('mondayOf: weekdays and Sunday map to that week’s Monday', () => {
  assert.equal(mondayOf('2026-11-02'), '2026-11-02') // Monday
  assert.equal(mondayOf(TODAY), '2026-11-02')
  assert.equal(mondayOf('2026-11-08'), '2026-11-02') // Sunday
  assert.equal(mondayOf('2026-01-01'), '2025-12-29') // across a year
})

test('quickRanges: today, this week, this month, and the active term up to today', () => {
  const ranges = quickRanges(TODAY, { from: '2026-11-01', to: '2027-03-31' })
  assert.deepEqual(
    ranges.map((r) => [r.key, r.from, r.to]),
    [
      ['today', TODAY, TODAY],
      ['week', '2026-11-02', TODAY],
      ['month', '2026-11-01', TODAY],
      ['term', '2026-11-01', TODAY],
    ],
  )
})

test('quickRanges: a finished term ends on its end date; no or future term is left out', () => {
  const past = quickRanges(TODAY, { from: '2026-05-15', to: '2026-10-10' })
  assert.deepEqual(past.at(-1), { from: '2026-05-15', key: 'term', label: 'เทอมนี้', to: '2026-10-10' })
  assert.equal(quickRanges(TODAY, null).length, 3)
  assert.equal(quickRanges(TODAY, { from: '2026-12-01', to: '2027-03-31' }).length, 3)
})

test('parseRange: nothing requested gives this month', () => {
  assert.deepEqual(parseRange({}, TODAY), { from: '2026-11-01', notices: [], to: TODAY })
})

test('parseRange: a valid range passes through', () => {
  assert.deepEqual(parseRange({ from: '2026-10-01', to: '2026-10-31' }, TODAY), {
    from: '2026-10-01',
    notices: [],
    to: '2026-10-31',
  })
})

test('parseRange: an unreal or missing day falls back to this month', () => {
  for (const req of [{ from: '2026-02-31', to: TODAY }, { from: '2026-10-01' }, { from: 'x', to: 'y' }]) {
    const r = parseRange(req, TODAY)
    assert.deepEqual([r.from, r.to, r.notices], ['2026-11-01', TODAY, ['invalid']])
  }
})

test('parseRange: reversed is swapped, a future end becomes today', () => {
  assert.deepEqual(parseRange({ from: '2026-10-31', to: '2026-10-01' }, TODAY).notices, ['swapped'])
  const future = parseRange({ from: '2026-11-01', to: '2026-12-31' }, TODAY)
  assert.deepEqual([future.from, future.to, future.notices], ['2026-11-01', TODAY, ['future']])
  const allFuture = parseRange({ from: '2026-12-01', to: '2026-12-31' }, TODAY)
  assert.deepEqual([allFuture.from, allFuture.to], [TODAY, TODAY])
})

test('parseRange: a range longer than the cap keeps its end', () => {
  const r = parseRange({ from: '2024-01-01', to: '2026-10-31' }, TODAY)
  assert.equal(r.to, '2026-10-31')
  assert.equal(daysBetween(r.from, r.to) + 1, MAX_RANGE_DAYS)
  assert.deepEqual(r.notices, ['too_long'])
})
