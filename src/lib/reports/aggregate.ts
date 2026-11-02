/**
 * Pure aggregation for the attendance reports (per-classroom, per-student, late).
 * Works on slim records already loaded and access-checked by `./queries`, so the
 * same functions can feed the Excel/PDF export later.
 */
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '../attendance/statuses.ts'

export interface ReportRecord {
  classroomId: number | null
  date: string
  id: number
  note: string
  status: AttendanceStatus
  studentId: number
}

export interface ReportStudent {
  classNumber: number | null
  /** No longer studying in the report's classroom (moved, left, graduated). */
  departed: boolean
  id: number
  name: string
  studentCode: string
}

export type StatusCounts = Record<AttendanceStatus, number>

export interface StudentSummary {
  counts: StatusCounts
  /** %มา: present ÷ records in range, 0–100; null when there are no records. */
  rate: number | null
  student: ReportStudent
  total: number
}

export interface LateSummary {
  perStudent: { count: number; student: ReportStudent }[]
  rows: { record: ReportRecord; student: ReportStudent }[]
  total: number
}

export const emptyCounts = (): StatusCounts =>
  Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s.value, 0])) as StatusCounts

export const countStatuses = (records: readonly Pick<ReportRecord, 'status'>[]): StatusCounts => {
  const counts = emptyCounts()
  for (const r of records) counts[r.status] += 1
  return counts
}

export const totalOf = (counts: StatusCounts): number =>
  Object.values(counts).reduce((sum, n) => sum + n, 0)

/**
 * %มา = มา ÷ every record in range. A day without a record is not counted at all,
 * and สาย / ลา / ขาด / ออกก่อน are not มา.
 */
export const presentRate = (counts: StatusCounts): number | null => {
  const total = totalOf(counts)
  return total === 0 ? null : (counts.present / total) * 100
}

/** `60` → `60.0%`; no records → `—`. */
export const formatRate = (rate: number | null): string => (rate === null ? '—' : `${rate.toFixed(1)}%`)

/** Current students by class number, then departed students by student code. */
export const compareStudents = (a: ReportStudent, b: ReportStudent): number => {
  if (a.departed !== b.departed) return a.departed ? 1 : -1
  const an = a.classNumber ?? Number.POSITIVE_INFINITY
  const bn = b.classNumber ?? Number.POSITIVE_INFINITY
  if (an !== bn) return an - bn
  return a.studentCode.localeCompare(b.studentCode)
}

const unknownStudent = (id: number): ReportStudent => ({
  classNumber: null,
  departed: true,
  id,
  name: 'ไม่พบข้อมูลนักเรียน',
  studentCode: '',
})

const studentLookup = (students: readonly ReportStudent[]) => {
  const byId = new Map(students.map((s) => [s.id, s]))
  return (id: number) => byId.get(id) ?? unknownStudent(id)
}

/**
 * One row per student: every given student (a roster student with no record in
 * range gets zeros), plus anyone who only appears in the records.
 */
export const summarizeByStudent = (
  records: readonly ReportRecord[],
  students: readonly ReportStudent[],
): StudentSummary[] => {
  const find = studentLookup(students)
  const grouped = new Map<number, ReportRecord[]>(students.map((s) => [s.id, []]))
  for (const r of records) {
    const list = grouped.get(r.studentId)
    if (list) list.push(r)
    else grouped.set(r.studentId, [r])
  }

  return [...grouped.entries()]
    .map(([id, list]) => {
      const counts = countStatuses(list)
      return { counts, rate: presentRate(counts), student: find(id), total: list.length }
    })
    .sort((a, b) => compareStudents(a.student, b.student))
}

/** The สาย records (oldest first), each student's late count (most first), and the total. */
export const summarizeLate = (
  records: readonly ReportRecord[],
  students: readonly ReportStudent[],
): LateSummary => {
  const find = studentLookup(students)
  const late = records.filter((r) => r.status === 'late')

  const counts = new Map<number, number>()
  for (const r of late) counts.set(r.studentId, (counts.get(r.studentId) ?? 0) + 1)

  const perStudent = [...counts.entries()]
    .map(([id, count]) => ({ count, student: find(id) }))
    .sort((a, b) => b.count - a.count || compareStudents(a.student, b.student))

  const rows = late
    .map((record) => ({ record, student: find(record.studentId) }))
    .sort((a, b) => a.record.date.localeCompare(b.record.date) || compareStudents(a.student, b.student))

  return { perStudent, rows, total: late.length }
}

/** A student's own records, oldest first. */
export const sortByDate = <T extends Pick<ReportRecord, 'date'>>(records: readonly T[]): T[] =>
  [...records].sort((a, b) => a.date.localeCompare(b.date))
