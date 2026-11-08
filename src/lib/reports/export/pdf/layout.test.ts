import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { ExportDoc } from '../model.ts'
import { buildPdfDocument, formatCell, PDF_FONT, type PdfTemplate } from './layout.ts'
import { PLAIN_TEMPLATE } from './templates/plain.ts'

const doc: ExportDoc = {
  blocks: [
    {
      columns: [
        { header: 'ชื่อ', kind: 'text' },
        { header: 'มา', kind: 'int' },
        { header: '%มา', kind: 'percent' },
      ],
      footer: { cells: [3, 75], label: 'รวม', span: 1 },
      rows: [
        ['ก', 2, 200 / 3],
        ['ข', null, null],
      ],
      type: 'table',
    },
  ],
  filenameBase: 'x',
  meta: [{ label: 'ห้อง', value: 'ม.4/2' }],
  orientation: 'landscape',
  sheetName: 'x',
  title: 'รายงานรายห้อง',
}

test('cells print like the page', () => {
  assert.equal(formatCell(200 / 3, 'percent'), '66.7%')
  assert.equal(formatCell(null, 'percent'), '—')
  assert.equal(formatCell(null, 'int'), '—')
  assert.equal(formatCell(0, 'int'), '0')
})

test('plain template: Sarabun, orientation, letterhead first, no signature block', () => {
  const def = buildPdfDocument(doc, PLAIN_TEMPLATE, { printedOn: '5 พ.ย. 2569, 10:00' })
  assert.equal(def.defaultStyle?.font, PDF_FONT)
  assert.equal(def.pageOrientation, 'landscape')
  const content = def.content as unknown[]
  assert.equal(content.length, 2) // letterhead + one table block, nothing after
  assert.match(JSON.stringify(content[0]), /โรงเรียนมัธยมหนองเขียด/)
  assert.match(JSON.stringify(content[0]), /องค์การบริหารส่วนจังหวัดขอนแก่น/)
  const body = JSON.stringify(content[1])
  assert.match(body, /66\.7%/)
  assert.match(body, /"text":"รวม"/)
})

test('a template can slot a signature block after the body without touching the doc', () => {
  const official: PdfTemplate = { ...PLAIN_TEMPLATE, afterBody: () => [{ text: 'ลงชื่อ ครูที่ปรึกษา' }] }
  const content = buildPdfDocument(doc, official, { printedOn: '' }).content as unknown[]
  assert.equal(content.length, 3)
  assert.deepEqual(content[2], { text: 'ลงชื่อ ครูที่ปรึกษา' })
})
