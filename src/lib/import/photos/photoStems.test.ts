/** Unit tests for the bulk photo-import stem logic — run with `pnpm test`. */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  MATCH_LIMITS,
  MAX_PHOTO_BYTES,
  buildPlan,
  isJunkFile,
  looksLikeNationalId,
  precheck,
  splitName,
  validateStems,
  type MatchResult,
} from './photoStems.ts'

test('splitName: last dot, trimmed stem, lowercased ext', () => {
  assert.deepEqual(splitName('A.B.jpg'), { stem: 'A.B', ext: 'jpg' })
  assert.deepEqual(splitName(' 10001 .JPG'), { stem: '10001', ext: 'jpg' })
  assert.deepEqual(splitName('.jpg'), { stem: '', ext: 'jpg' })
  assert.deepEqual(splitName('noext'), { stem: 'noext', ext: '' })
  assert.deepEqual(splitName('folder/sub/Z3B-001.png'), { stem: 'Z3B-001', ext: 'png' })
})

test('looksLikeNationalId: 13 digits plain or with dashes/spaces only', () => {
  assert.equal(looksLikeNationalId('1234567890123'), true)
  assert.equal(looksLikeNationalId(' 1234567890123 '), true)
  assert.equal(looksLikeNationalId('1-2345-67890-12-3'), true)
  assert.equal(looksLikeNationalId('1 2345 67890 12 3'), true)
  assert.equal(looksLikeNationalId('123456789012'), false)
  assert.equal(looksLikeNationalId('12345678901234'), false)
  assert.equal(looksLikeNationalId('10001'), false)
  assert.equal(looksLikeNationalId('A234567890123'), false)
})

test('isJunkFile: dotfiles and OS junk', () => {
  for (const n of ['.DS_Store', 'Thumbs.db', 'desktop.ini', 'DESKTOP.INI', '._10001.jpg', 'x/.hidden']) {
    assert.equal(isJunkFile(n), true, n)
  }
  assert.equal(isJunkFile('10001.jpg'), false)
})

test('precheck: types, size boundary, 13-digit, duplicates', () => {
  const { eligible, rejected } = precheck([
    { name: '10001.jpg', size: 10 },
    { name: 'Z3B-002.png', size: 10 },
    { name: 'Z3B-003.JPG', size: MAX_PHOTO_BYTES },
    { name: 'Z3B-006.jpeg', size: 10 },
    { name: '20001.jpg', size: MAX_PHOTO_BYTES + 1 },
    { name: '1234567890123.jpg', size: 10 },
    { name: '1234567890123.gif', size: MAX_PHOTO_BYTES + 1 },
    { name: 'Z3B-004.jpg', size: 10 },
    { name: 'Z3B-004.png', size: 10 },
    { name: 'Z3B-005.gif', size: 10 },
    { name: '.jpg', size: 10 },
  ])
  assert.deepEqual(
    eligible.map((e) => e.stem),
    ['10001', 'Z3B-002', 'Z3B-003', 'Z3B-006'],
  )
  assert.deepEqual(
    rejected.map((r) => [r.name, r.reason]),
    [
      ['20001.jpg', 'tooLarge'],
      ['1234567890123.jpg', 'nationalId'],
      ['1234567890123.gif', 'nationalId'],
      ['Z3B-004.jpg', 'duplicate'],
      ['Z3B-004.png', 'duplicate'],
      ['Z3B-005.gif', 'wrongType'],
      ['.jpg', 'emptyStem'],
    ],
  )
})

test('precheck: a duplicate of a rejected file does not knock out the good one', () => {
  const { eligible } = precheck([
    { name: '10001.jpg', size: 10 },
    { name: '10001.gif', size: 10 },
    { name: '10001.png', size: MAX_PHOTO_BYTES + 1 },
  ])
  assert.deepEqual(eligible.map((e) => e.name), ['10001.jpg'])
})

test('precheck: stems compare case-sensitively (exact studentId match)', () => {
  const { eligible } = precheck([
    { name: 'z3b-001.jpg', size: 10 },
    { name: 'Z3B-001.jpg', size: 10 },
  ])
  assert.equal(eligible.length, 2)
})

test('buildPlan: new / existing (skip vs replace) / not found / ambiguous', () => {
  const { eligible } = precheck([
    { name: 'A.jpg', size: 1 },
    { name: 'B.jpg', size: 1 },
    { name: 'C.jpg', size: 1 },
    { name: 'D.jpg', size: 1 },
  ])
  const st = (id: number, studentId: string) => ({ id, studentId, name: 'x', classroom: 'ม.1/1' })
  const results: MatchResult[] = [
    { stem: 'A', status: 'matched', student: st(1, 'A'), photoId: null },
    { stem: 'B', status: 'matched', student: st(2, 'B'), photoId: 77 },
    { stem: 'C', status: 'notFound', photoId: null },
    { stem: 'D', status: 'ambiguous', photoId: null },
  ]
  const off = buildPlan(eligible, results, false)
  assert.deepEqual(off.upload.map((i) => i.stem), ['A'])
  assert.deepEqual(off.skipExisting.map((i) => [i.stem, i.photoId]), [['B', 77]])
  assert.equal(off.replaceExisting.length, 0)
  assert.deepEqual(off.notFound.map((i) => i.stem), ['C'])
  assert.deepEqual(off.ambiguous.map((i) => i.stem), ['D'])

  const on = buildPlan(eligible, results, true)
  assert.deepEqual(on.replaceExisting.map((i) => i.stem), ['B'])
  assert.equal(on.skipExisting.length, 0)
})

test('validateStems: rejects bad input without echoing it', () => {
  assert.deepEqual(validateStems(['10001', 'Z3B-001']), { stems: ['10001', 'Z3B-001'] })
  for (const bad of [
    null,
    'x',
    [],
    [1],
    [''],
    [' 10001'],
    ['x'.repeat(MATCH_LIMITS.maxStemLength + 1)],
    ['10001', '10001'],
    Array.from({ length: MATCH_LIMITS.maxStems + 1 }, (_, i) => `s${i}`),
  ]) {
    assert.ok('error' in validateStems(bad), JSON.stringify(bad)?.slice(0, 40))
  }
  const nid = validateStems(['1234567890123'])
  assert.ok('error' in nid && !nid.error.includes('1234567890123'))
})
