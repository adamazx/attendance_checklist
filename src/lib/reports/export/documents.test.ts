/**
 * Export documents carry the page's numbers: views (aggregate.ts) → ExportDoc → xlsx.
 * Expected values are worked out by hand from the fixture, not from aggregate.ts.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import ExcelJS from 'exceljs'

import type { AttendanceStatus } from '../../attendance/statuses.ts'
import type { ReportRecord, ReportStudent } from '../aggregate.ts'
import { computeClassroomView, computeLateView, computeStudentView } from '../views.ts'
import { classroomDoc, lateDoc, studentDoc, type ExportHeader } from './documents.ts'
import type { ExportTable } from './model.ts'
import { renderXlsx } from './xlsx.ts'

const student = (id: number, classNumber: number | null, departed = false): ReportStudent => ({
  classNumber,
  departed,
  id,
  name: `นักเรียน ${id}`,
  studentCode: String(1000 + id),
})

let nextId = 1
const rec = (
  studentId: number,
  date: string,
  status: AttendanceStatus,
  activityId: number | null = null,
  note = '',
): ReportRecord => ({ activityId, classroomId: 7, date, id: nextId++, note, status, studentId })

const students = [student(1, 1), student(2, 2), student(3, null, true)]
// Homeroom: s1 = มา, สาย, ขาด → 2/3 = 66.7%; s2 = มา, ลา → 1/2 = 50.0%; s3 = ลาออก → 0.0%.
// One activity (id 9) record for s1 that the homeroom filter must leave out.
const records = [
  rec(1, '2026-11-02', 'present'),
  rec(1, '2026-11-03', 'late', null, 'รถเสีย'),
  rec(1, '2026-11-04', 'absent'),
  rec(2, '2026-11-02', 'present'),
  rec(2, '2026-11-03', 'leave'),
  rec(3, '2026-11-02', 'resigned'),
  rec(1, '2026-11-03', 'late', 9),
]

const header = (activity: ExportHeader['activity']): ExportHeader => ({
  activity,
  activityName: new Map([[9, 'ชุมนุม']]),
  classroomName: 'ม.4/2 (2569)',
  range: { from: '2026-11-02', to: '2026-11-04' },
})

const firstTable = (blocks: { type: string }[]) => blocks.find((b) => b.type === 'table') as ExportTable

test('classroom doc: per-student rows and รวมทั้งห้อง match a hand count', () => {
  const doc = classroomDoc(header('homeroom'), computeClassroomView(records, students, 'homeroom'))
  const table = firstTable(doc.blocks)
  assert.deepEqual(
    table.columns.map((c) => c.header),
    ['เลขที่', 'รหัส', 'ชื่อ - นามสกุล', 'มา', 'สาย', 'ลา', 'ขาด', 'ลาออก', 'รวมวัน', '%มา'],
  )
  const [r1, r2, r3] = table.rows
  assert.deepEqual(r1!.slice(0, 9), [1, '1001', 'นักเรียน 1', 1, 1, 0, 1, 0, 3])
  assert.ok(Math.abs((r1![9] as number) - 200 / 3) < 1e-9)
  assert.deepEqual(r2, [2, '1002', 'นักเรียน 2', 1, 0, 1, 0, 0, 2, 50])
  assert.deepEqual(r3, [null, '1003', 'นักเรียน 3 (ย้าย/ออก)', 0, 0, 0, 0, 1, 1, 0])
  // Room: มา 2, สาย 1, ลา 1, ขาด 1, ลาออก 1 = 6 → (2+1)/6 = 50%.
  assert.deepEqual(table.footer, { cells: [2, 1, 1, 1, 1, 6, 50], label: 'รวมทั้งห้อง (3 คน)', span: 3 })
  assert.equal(doc.filenameBase, 'รายงานรายห้อง_ม.4-2-(2569)_2569-11-02_2569-11-04')
  assert.deepEqual(doc.meta.map((m) => m.value), ['ม.4/2 (2569)', 'เช็คชื่อประจำวัน', '2 พฤศจิกายน 2569 – 4 พฤศจิกายน 2569'])
})

test('classroom doc: activity filter "all" counts the activity record and says ครั้ง', () => {
  const doc = classroomDoc(header('all'), computeClassroomView(records, students, 'all'))
  const table = firstTable(doc.blocks)
  assert.equal(table.columns[8]!.header, 'รวม (ครั้ง)')
  assert.deepEqual(table.footer!.cells, [2, 2, 1, 1, 1, 7, (4 / 7) * 100])
})

test('classroom doc: no records → the page empty state, no table', () => {
  const doc = classroomDoc(header(9), computeClassroomView([], students, 9))
  assert.deepEqual(doc.blocks, [{ text: 'ไม่มีข้อมูลเช็คชื่อในช่วงวันที่เลือก', type: 'paragraph' }])
})

test('student doc: summary + records, activity column only for "all"', () => {
  const s1 = students[0]!
  const own = records.filter((r) => r.studentId === 1)
  const home = studentDoc(header('homeroom'), computeStudentView(students, s1, own, 'homeroom'), new Map())
  const [summary, list] = home.blocks as ExportTable[]
  assert.deepEqual(summary!.rows[0]!.slice(0, 6), [1, 1, 0, 1, 0, 3])
  assert.deepEqual(list!.columns.map((c) => c.header), ['ลำดับ', 'วันที่', 'สถานะ', 'หมายเหตุ'])
  assert.deepEqual(list!.rows[1], [2, 'วันอังคารที่ 3 พฤศจิกายน 2569', 'สาย', 'รถเสีย'])
  assert.equal(home.filenameBase, 'รายงานนักเรียน_ม.4-2-(2569)_1001_2569-11-02_2569-11-04')

  const all = studentDoc(header('all'), computeStudentView(students, s1, own, 'all'), new Map())
  const allList = all.blocks[1] as ExportTable
  assert.ok(allList.columns.some((c) => c.header === 'วิชา/กิจกรรม'))
  assert.equal(allList.rows.length, 4)
})

test('late doc: total line, per-student and per-record tables', () => {
  const lateRecords = records.filter((r) => r.status === 'late')
  const doc = lateDoc(header('homeroom'), computeLateView(lateRecords, students, 'homeroom'))
  assert.deepEqual(doc.blocks[0], { style: 'strong', text: 'มาสายรวม 1 ครั้ง · 1 คน', type: 'paragraph' })
  assert.deepEqual((doc.blocks[1] as ExportTable).rows, [[1, 'นักเรียน 1', 1]])
  assert.deepEqual((doc.blocks[2] as ExportTable).rows, [['วันอังคารที่ 3 พฤศจิกายน 2569', 1, 'นักเรียน 1', 'รถเสีย']])
})

test('xlsx: counts are numbers, %มา is a 0.0% percent cell, footer present', async () => {
  const doc = classroomDoc(header('homeroom'), computeClassroomView(records, students, 'homeroom'))
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load((await renderXlsx(doc)) as unknown as ArrayBuffer)
  const ws = wb.worksheets[0]!
  assert.equal(ws.name, 'รายงานรายห้อง')

  let headerRow = 0
  ws.eachRow((row, n) => {
    if (row.getCell(1).value === 'เลขที่') headerRow = n
  })
  assert.ok(headerRow > 0)
  const s2 = ws.getRow(headerRow + 2)
  assert.equal(s2.getCell(4).value, 1)
  assert.equal(s2.getCell(10).value, 0.5)
  assert.equal(s2.getCell(10).numFmt, '0.0%')
  const footer = ws.getRow(headerRow + 4)
  assert.equal(footer.getCell(1).value, 'รวมทั้งห้อง (3 คน)')
  assert.equal(footer.getCell(9).value, 6)
  assert.equal(footer.getCell(10).value, 0.5)
  assert.equal(ws.getRow(headerRow + 3).getCell(1).value, '—')
})
