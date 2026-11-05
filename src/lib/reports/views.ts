/**
 * What each report shows, computed from records and students that `./queries` has
 * already loaded and access-checked. The report pages and their Excel/PDF exports
 * both use these, so a file always carries the same numbers as the page.
 * Pure, so the node test runner can check them.
 */
import {
  compareStudents,
  countStatuses,
  filterByActivity,
  presentRate,
  summarizeByStudent,
  summarizeLate,
  type ActivityFilter,
  type LateSummary,
  type ReportRecord,
  type ReportStudent,
  type StatusCounts,
  type StudentSummary,
} from './aggregate.ts'

export interface ClassroomView {
  /** Records the filter keeps (the รวมวัน / รวม (ครั้ง) of the room). */
  recordCount: number
  rows: StudentSummary[]
  totalRate: number | null
  totals: StatusCounts
}

/** `allRecords` = every record of the room in range (all activities). */
export const computeClassroomView = (
  allRecords: readonly ReportRecord[],
  students: readonly ReportStudent[],
  activity: ActivityFilter,
): ClassroomView => {
  const records = filterByActivity(allRecords, activity)
  const totals = countStatuses(records)
  return {
    recordCount: records.length,
    rows: summarizeByStudent(allRecords, students, activity),
    totalRate: presentRate(totals),
    totals,
  }
}

/** The choosable students of a student report, in display order. */
export const sortStudents = (students: readonly ReportStudent[]): ReportStudent[] => [...students].sort(compareStudents)

/** The `student` param's student, or the first one (as the page falls back). */
export const pickStudent = (students: readonly ReportStudent[], param: string | undefined): ReportStudent | null =>
  students.find((s) => String(s.id) === param) ?? students[0] ?? null

export interface StudentView {
  counts: StatusCounts
  /** The records come from more than one classroom (show a ห้อง column). */
  multiRoom: boolean
  rate: number | null
  /** The chosen student's records the filter keeps, oldest first (as loaded). */
  records: ReportRecord[]
  student: ReportStudent | null
  students: ReportStudent[]
}

export const computeStudentView = (
  students: ReportStudent[],
  student: ReportStudent | null,
  studentRecords: readonly ReportRecord[],
  activity: ActivityFilter,
): StudentView => {
  const records = filterByActivity(studentRecords, activity)
  const counts = countStatuses(records)
  return {
    counts,
    multiRoom: new Set(records.map((r) => r.classroomId)).size > 1,
    rate: presentRate(counts),
    records,
    student,
    students,
  }
}

export interface LateView {
  late: LateSummary
}

/** `lateRecords` = the room's สาย records in range (all activities). */
export const computeLateView = (
  lateRecords: readonly ReportRecord[],
  students: readonly ReportStudent[],
  activity: ActivityFilter,
): LateView => ({ late: summarizeLate(lateRecords, students, activity) })
