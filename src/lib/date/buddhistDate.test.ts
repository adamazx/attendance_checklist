import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseBEDate } from './buddhistDate.ts'

test('พ.ศ. DD/MM/YYYY → ค.ศ. YYYY-MM-DD', () => {
  assert.equal(parseBEDate('15/03/2557'), '2014-03-15')
  assert.equal(parseBEDate('1/2/2560'), '2017-02-01')
  assert.equal(parseBEDate('29-02-2563'), '2020-02-29')
  assert.equal(parseBEDate('๑๕/๐๓/๒๕๕๗'), '2014-03-15', 'Thai digits')
})

test('empty → null; invalid → undefined', () => {
  assert.equal(parseBEDate(''), null)
  assert.equal(parseBEDate(null), null)
  assert.equal(parseBEDate('31/02/2557'), undefined, 'not a real day')
  assert.equal(parseBEDate('15/03/2014'), undefined, 'a ค.ศ. year is rejected, not guessed')
  assert.equal(parseBEDate('abc'), undefined)
})

test('Excel date serials', () => {
  assert.equal(parseBEDate(41713), '2014-03-15', 'a real ค.ศ. date cell')
  // 15/03/2557 typed into a date cell = year 2557 → serial for 2557-03-15
  const beSerial = (Date.UTC(2557, 2, 15) - Date.UTC(1899, 11, 30)) / 86400000
  assert.equal(parseBEDate(beSerial), '2014-03-15')
})
