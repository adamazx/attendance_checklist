/**
 * Loads what a report shows, for both the report page and its export route: the
 * same role-scoped loaders (`@/lib/reports/queries`) feeding the same pure view
 * computations (`@/lib/reports/views`), so a downloaded file can never drift from
 * the page for the same URL.
 */
import { loadRangeRecords, loadReportStudents, type ReportClassroom } from '@/lib/reports/queries'
import {
  computeClassroomView,
  computeLateView,
  computeStudentView,
  pickStudent,
  sortStudents,
  type ClassroomView,
  type LateView,
  type StudentView,
} from '@/lib/reports/views'

import { one, type loadReportContext } from './loadReportContext'

export type ReportContext = Awaited<ReturnType<typeof loadReportContext>>
/** A context whose classroom resolved (the user has at least one). */
export type RoomContext = ReportContext & { classroom: ReportClassroom }

export async function loadClassroomView(ctx: RoomContext): Promise<ClassroomView> {
  const { classroom, range, req } = ctx
  const allRecords = await loadRangeRecords(req, { classroomId: classroom.id, from: range.from, to: range.to })
  const students = await loadReportStudents(
    req,
    classroom.id,
    allRecords.map((r) => r.studentId),
  )
  return computeClassroomView(allRecords, students, ctx.activity)
}

export async function loadStudentView(ctx: RoomContext): Promise<StudentView> {
  const { classroom, range, req } = ctx
  // The choosable students: the classroom's own, plus anyone recorded here in range
  // who has since left. A `student` param outside that list falls back to the first.
  const classroomRecords = await loadRangeRecords(req, { classroomId: classroom.id, from: range.from, to: range.to })
  const students = sortStudents(
    await loadReportStudents(
      req,
      classroom.id,
      classroomRecords.map((r) => r.studentId),
    ),
  )
  const student = pickStudent(students, one(ctx.params.student))
  // Access still applies: an advisor sees only this student's records under a
  // classroom they advise, so earlier/later rooms outside their scope stay hidden.
  const studentRecords = student
    ? await loadRangeRecords(req, { from: range.from, studentId: student.id, to: range.to })
    : []
  return computeStudentView(students, student, studentRecords, ctx.activity)
}

export async function loadLateView(ctx: RoomContext): Promise<LateView> {
  const { classroom, range, req } = ctx
  const records = await loadRangeRecords(req, {
    classroomId: classroom.id,
    from: range.from,
    status: 'late',
    to: range.to,
  })
  // Resolves departed students too, from their own late records in this classroom.
  const students = await loadReportStudents(
    req,
    classroom.id,
    records.map((r) => r.studentId),
  )
  return computeLateView(records, students, ctx.activity)
}
