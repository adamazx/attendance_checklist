/**
 * Role-scoped loaders for the report pages. Everything reads with
 * `overrideAccess: false` as the request's user — so an advisor only ever gets their
 * own classrooms (every year, for history) and the records snapshotted to them, while
 * admin & discipline see all — except where a comment says otherwise.
 */
import type { PayloadRequest, Where } from 'payload'

import { fullName } from '@/lib/attendance/rollCall'
import type { AttendanceStatus } from '@/lib/attendance/statuses'
import { toThaiDay } from '@/lib/date/thaiDay'

import type { ReportRecord, ReportStudent } from './aggregate'
import type { DateRange } from './dateRange'

export interface ReportClassroom {
  id: number
  /** `ม.1/1 (2569)` — the year disambiguates rooms with the same name. */
  name: string
}

/**
 * Only what a report shows. The departed lookup overrides access, so it must never
 * pull more than this even if the Student collection grows.
 */
const STUDENT_FIELDS = {
  classNumber: true,
  classroom: true,
  firstName: true,
  lastName: true,
  prefix: true,
  status: true,
  studentId: true,
} as const

const relId = (v: unknown): number | null =>
  v && typeof v === 'object' ? (v as { id: number }).id : ((v as number | null | undefined) ?? null)

/**
 * Every classroom the caller may read (classroomRead: an advisor's assigned rooms in
 * any year; all for admin & discipline), newest year first.
 */
export const listReportClassrooms = async (req: PayloadRequest): Promise<ReportClassroom[]> => {
  const [classrooms, years] = await Promise.all([
    req.payload.find({
      collection: 'classrooms',
      sort: 'name',
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: false,
      req,
    }),
    req.payload.find({
      collection: 'academic-years',
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: false,
      req,
    }),
  ])
  const yearOf = new Map(years.docs.map((y) => [y.id, y.year]))

  return classrooms.docs
    .map((c) => ({ c, year: yearOf.get(relId(c.academicYear) as number) ?? 0 }))
    .sort((a, b) => b.year - a.year || (a.c.name ?? '').localeCompare(b.c.name ?? '', 'th', { numeric: true }))
    .map(({ c, year }) => ({ id: c.id, name: year ? `${c.name ?? ''} (${year})` : (c.name ?? '') }))
}

/** The active term as a calendar-day range, or null when none is active and dated. */
export const loadActiveTerm = async (req: PayloadRequest): Promise<DateRange | null> => {
  const terms = await req.payload.find({
    collection: 'terms',
    where: { isActive: { equals: true } },
    sort: '-startDate',
    depth: 0,
    limit: 1,
    overrideAccess: false,
    req,
  })
  const term = terms.docs[0]
  if (!term?.startDate || !term.endDate) return null
  return { from: toThaiDay(term.startDate), to: toThaiDay(term.endDate) }
}

/**
 * The records in a date range for a classroom (by snapshot) or a student, optionally
 * one status. Bounded by the range (at most MAX_RANGE_DAYS) and fetched slim.
 */
export const loadRangeRecords = async (
  req: PayloadRequest,
  args: DateRange & { classroomId?: number; status?: AttendanceStatus; studentId?: number },
): Promise<ReportRecord[]> => {
  const { classroomId, from, status, studentId, to } = args
  const and: Where[] = [{ date: { greater_than_equal: from } }, { date: { less_than_equal: to } }]
  if (classroomId !== undefined) and.push({ classroom: { equals: classroomId } })
  if (studentId !== undefined) and.push({ student: { equals: studentId } })
  if (status) and.push({ status: { equals: status } })
  // A report is always scoped to a classroom or a student, never the whole table.
  if (classroomId === undefined && studentId === undefined) return []

  const result = await req.payload.find({
    collection: 'attendance-records',
    where: { and },
    select: { classroom: true, date: true, note: true, status: true, student: true },
    sort: 'date',
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: false,
    req,
  })
  return result.docs.map((r) => ({
    classroomId: relId(r.classroom),
    date: r.date,
    id: r.id,
    note: r.note ?? '',
    status: r.status,
    studentId: relId(r.student) as number,
  }))
}

/**
 * The students a classroom report is about: everyone currently in the classroom,
 * plus anyone with a record in `recordStudentIds` who has since left it. A student
 * who is no longer studying here is `departed`, and only a student still in this
 * classroom keeps their class number (a departed one's may belong to a new room).
 */
export const loadReportStudents = async (
  req: PayloadRequest,
  classroomId: number,
  recordStudentIds: readonly number[],
): Promise<ReportStudent[]> => {
  const roster = await req.payload.find({
    collection: 'students',
    where: { classroom: { equals: classroomId } },
    select: STUDENT_FIELDS,
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: false,
    req,
  })

  const known = new Set(roster.docs.map((s) => s.id))
  const departedIds = [...new Set(recordStudentIds)].filter((id) => !known.has(id))
  // Student read access follows the *current* classroom, so a student who has left
  // is unreadable. Their ids come from records the caller may already read, so
  // overriding here reveals only the identity on that caller's own records.
  const departed = departedIds.length
    ? await req.payload.find({
        collection: 'students',
        where: { id: { in: departedIds } },
        select: STUDENT_FIELDS,
        depth: 0,
        limit: 0,
        pagination: false,
        overrideAccess: true,
        req,
      })
    : null

  return [...roster.docs, ...(departed?.docs ?? [])].map((s) => {
    const here = relId(s.classroom) === classroomId
    return {
      classNumber: here ? (s.classNumber ?? null) : null,
      departed: !here || s.status !== 'studying',
      id: s.id,
      name: fullName(s),
      studentCode: s.studentId,
    }
  })
}
