/**
 * Unit tests for the report aggregation — run with `pnpm test`.
 * Access scoping lives in `./queries` and is verified against the dev server.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { AttendanceStatus } from '../attendance/statuses.ts'
import {
  countStatuses,
  formatRate,
  presentRate,
  type ReportRecord,
  type ReportStudent,
  summarizeByStudent,
  summarizeLate,
} from './aggregate.ts'

const student = (id: number, classNumber: number | null, departed = false): ReportStudent => ({
  classNumber,
  departed,
  id,
  name: `นักเรียน ${id}`,
  studentCode: String(1000 + id),
})

let nextId = 1
const rec = (studentId: number, date: string, status: AttendanceStatus): ReportRecord => ({
  classroomId: 1,
  date,
  id: nextId++,
  note: '',
  status,
  studentId,
})

const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`)

// Student 1: 6 มา / 2 สาย / 1 ลา / 1 ขาด over 10 days.
const S1: AttendanceStatus[] = ['present', 'present', 'late', 'present', 'leave', 'present', 'absent', 'late', 'present', 'present']
const fixture = [
  ...days(10).map((d, i) => rec(1, d, S1[i] as AttendanceStatus)),
  rec(2, '2026-10-01', 'late'),
  rec(2, '2026-10-02', 'left_early'),
  rec(9, '2026-10-03', 'late'), // departed student, recorded while in this classroom
]
const students = [student(2, 2), student(1, 1), student(3, 3), student(9, null, true)]

test('countStatuses + presentRate: 6 มา of 10 records is 60%', () => {
  const counts = countStatuses(fixture.filter((r) => r.studentId === 1))
  assert.deepEqual(counts, { absent: 1, late: 2, leave: 1, left_early: 0, present: 6 })
  assert.equal(presentRate(counts), 60)
  assert.equal(formatRate(presentRate(counts)), '60.0%')
})

test('presentRate: no records is null, shown as a dash', () => {
  assert.equal(presentRate(countStatuses([])), null)
  assert.equal(formatRate(null), '—')
})

test('summarizeByStudent: every roster student gets a row, ordered by class number, departed last', () => {
  const rows = summarizeByStudent(fixture, students)
  assert.deepEqual(
    rows.map((r) => [r.student.id, r.total]),
    [
      [1, 10],
      [2, 2],
      [3, 0],
      [9, 1],
    ],
  )
  assert.equal(rows[1]?.rate, 0) // สาย and ออกก่อน are not มา
  assert.equal(rows[2]?.rate, null) // no record in range: not counted
})

test('summarizeByStudent: a record for an unknown student still gets a row', () => {
  const rows = summarizeByStudent([rec(42, '2026-10-01', 'present')], [])
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.student.id, 42)
  assert.equal(rows[0]?.student.departed, true)
})

test('summarizeLate: only สาย, counts per student (most first), rows by date', () => {
  const late = summarizeLate(fixture, students)
  assert.equal(late.total, 4)
  assert.deepEqual(
    late.perStudent.map((p) => [p.student.id, p.count]),
    [
      [1, 2],
      [2, 1],
      [9, 1],
    ],
  )
  assert.ok(late.rows.every((r) => r.record.status === 'late'))
  assert.deepEqual(
    late.rows.map((r) => [r.record.date, r.student.id]),
    [
      ['2026-10-01', 2],
      ['2026-10-03', 1],
      ['2026-10-03', 9],
      ['2026-10-08', 1],
    ],
  )
})
