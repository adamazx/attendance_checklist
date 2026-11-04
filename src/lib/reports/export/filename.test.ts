import assert from 'node:assert/strict'
import { test } from 'node:test'

import { beDay, contentDisposition, filenameBase, rangePart } from './filename.ts'

test('พ.ศ. range part', () => {
  assert.equal(beDay('2026-11-05'), '2569-11-05')
  assert.equal(rangePart({ from: '2026-11-01', to: '2026-11-05' }), '2569-11-01_2569-11-05')
  assert.equal(rangePart({ from: '2026-11-05', to: '2026-11-05' }), '2569-11-05')
})

test('file name parts are made safe', () => {
  assert.equal(filenameBase(['รายงานรายห้อง', 'ม.4/2 (2569)', '']), 'รายงานรายห้อง_ม.4-2-(2569)')
  assert.equal(filenameBase(['a:b*c?"d<e>f|g\\h']), 'a-b-c-d-e-f-g-h')
})

test('Content-Disposition carries the Thai name as RFC 5987 and an ASCII fallback', () => {
  const header = contentDisposition('ม.4-(2569).pdf', 'report-ü".pdf')
  assert.equal(
    header,
    `attachment; filename="report-__.pdf"; filename*=UTF-8''${encodeURIComponent('ม.4-')}%282569%29.pdf`,
  )
  assert.equal(decodeURIComponent(header.split("UTF-8''")[1]!), 'ม.4-(2569).pdf')
})
