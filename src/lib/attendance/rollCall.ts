/**
 * Role-scoped roll-call queries, shared by the attendance pages and the save route.
 * Everything reads with `overrideAccess: false` as the request's user, except where
 * a comment says otherwise. Eligibility comes from actual advisor assignment, so an
 * admin's broad read never widens this UI.
 */
import type { PayloadRequest } from 'payload'

import { advisorActiveClassroomIds } from '@/access'
import { toThaiDay } from '@/lib/date/thaiDay'
import type { Student } from '@/payload-types'

import type { ExistingRecord } from './planSave'
import type { AttendanceStatus } from './statuses'

export interface RollCallClassroom {
  academicYearId: number
  id: number
  name: string
}

export interface RollCallRow {
  classNumber: number | null
  name: string
  note: string
  status: AttendanceStatus | null
  studentCode: string
  studentId: number
}

const relId = (v: unknown): number | null =>
  v && typeof v === 'object' ? (v as { id: number }).id : ((v as number | null | undefined) ?? null)

/**
 * The caller's assigned classrooms in the active academic year — the same set the
 * collection lets an advisor write to.
 */
export const listRollCallClassrooms = async (req: PayloadRequest): Promise<RollCallClassroom[]> => {
  const writable = await advisorActiveClassroomIds(req)
  if (writable.length === 0) return []

  const classrooms = await req.payload.find({
    collection: 'classrooms',
    where: { id: { in: writable } },
    sort: 'name',
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: false,
    req,
  })

  return classrooms.docs.map((c) => ({
    academicYearId: relId(c.academicYear) as number,
    id: c.id,
    name: c.name ?? '',
  }))
}

/** Students currently studying in a classroom, in class-number order. */
export const loadRoster = async (req: PayloadRequest, classroomId: number): Promise<Student[]> => {
  const result = await req.payload.find({
    collection: 'students',
    where: { and: [{ classroom: { equals: classroomId } }, { status: { equals: 'studying' } }] },
    sort: ['classNumber', 'studentId'],
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: false,
    req,
  })
  return result.docs
}

/**
 * Records for a day, for the given students or this classroom — those the caller may
 * read, or all of them with `overrideAccess` (the save route needs records under a
 * student's old classroom to detect a conflict; it never returns them).
 */
export const loadExisting = async (
  req: PayloadRequest,
  args: { classroomId?: number; date: string; overrideAccess?: boolean; studentIds?: number[] },
): Promise<ExistingRecord[]> => {
  const { classroomId, date, overrideAccess = false, studentIds = [] } = args
  const result = await req.payload.find({
    collection: 'attendance-records',
    where: {
      and: [
        { date: { equals: date } },
        {
          or: [
            { student: { in: studentIds } },
            ...(classroomId ? [{ classroom: { equals: classroomId } }] : []),
          ],
        },
      ],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess,
    req,
  })
  return result.docs.map((r) => ({
    classroomId: relId(r.classroom),
    id: r.id,
    note: r.note ?? null,
    status: r.status,
    studentId: relId(r.student) as number,
  }))
}

export const fullName = (s: Pick<Student, 'firstName' | 'lastName' | 'prefix'>): string => `${s.prefix ?? ''}${s.firstName} ${s.lastName}`.trim()

/**
 * The rows for one classroom and day, pre-filled from saved records. `savedOnly`
 * (the edit page) keeps just the students who have a record that day.
 */
export const loadRollCallRows = async (
  req: PayloadRequest,
  args: { classroomId: number; date: string; savedOnly: boolean },
): Promise<RollCallRow[]> => {
  const { classroomId, date, savedOnly } = args
  const roster = await loadRoster(req, classroomId)
  const existing = await loadExisting(req, {
    classroomId,
    date,
    studentIds: roster.map((s) => s.id),
  })
  const records = new Map(existing.map((r) => [r.studentId, r]))

  const onRoster = new Set(roster.map((s) => s.id))
  const departedIds = existing.map((r) => r.studentId).filter((id) => !onRoster.has(id))
  // Student read access follows the *current* classroom, so a student who has left
  // is unreadable. Their ids come from records the caller may already read, so
  // overriding here reveals only the identity on that caller's own record.
  const departed = departedIds.length
    ? await req.payload.find({
        collection: 'students',
        where: { id: { in: departedIds } },
        depth: 0,
        limit: 0,
        pagination: false,
        overrideAccess: true,
        req,
      })
    : null

  const students = [...roster, ...(departed?.docs ?? [])]
  return students
    .filter((s) => !savedOnly || records.has(s.id))
    .map((s) => ({
      // A departed student's current number may belong to their new room.
      classNumber: onRoster.has(s.id) ? (s.classNumber ?? null) : null,
      name: fullName(s),
      note: records.get(s.id)?.note ?? '',
      status: records.get(s.id)?.status ?? null,
      studentCode: s.studentId,
      studentId: s.id,
    }))
}

/** True when the day falls in a dated term of the year (else the record gets `term: null`). */
export const isDayInTerm = async (
  req: PayloadRequest,
  academicYearId: number,
  day: string,
): Promise<boolean> => {
  const terms = await req.payload.find({
    collection: 'terms',
    where: { academicYear: { equals: academicYearId } },
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: false,
    req,
  })
  return terms.docs.some(
    (t) => t.startDate && t.endDate && day >= toThaiDay(t.startDate) && day <= toThaiDay(t.endDate),
  )
}
