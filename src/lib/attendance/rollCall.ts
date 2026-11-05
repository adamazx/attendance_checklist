/**
 * Role-scoped roll-call queries, shared by the attendance pages and the save route.
 * Everything reads with `overrideAccess: false` as the request's user, except where
 * a comment says otherwise. Eligibility comes from actual advisor assignment, so an
 * admin's broad read never widens this UI.
 */
import type { PayloadRequest, Where } from 'payload'

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

export interface RollCallActivity {
  id: number
  name: string
  type: 'activity' | 'subject'
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

/** Every subject/activity (readable by any signed-in user): วิชา first, then กิจกรรม, by name. */
export const listActivities = async (req: PayloadRequest): Promise<RollCallActivity[]> => {
  const result = await req.payload.find({
    collection: 'activities',
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: false,
    req,
  })
  return result.docs
    .map((a) => ({ id: a.id, name: a.name, type: a.type }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'th', { numeric: true }) : a.type === 'subject' ? -1 : 1))
}

/** Records under one activity, or the daily homeroom (no activity) when `activityId` is null. */
export const activityWhere = (activityId: number | null): Where =>
  activityId === null ? { activity: { exists: false } } : { activity: { equals: activityId } }

/**
 * Only what roll call shows. The departed lookup overrides access (which also skips
 * field-level PDPA access), so neither read may pull more than this as the Student
 * record grows.
 */
const ROSTER_SELECT = {
  classNumber: true,
  classroom: true,
  firstName: true,
  lastName: true,
  prefix: true,
  status: true,
  studentId: true,
} as const

export type RosterStudent = Pick<
  Student,
  'id' | 'classNumber' | 'classroom' | 'firstName' | 'lastName' | 'prefix' | 'status' | 'studentId'
>

/** Students currently studying in a classroom, in class-number order. */
export const loadRoster = async (req: PayloadRequest, classroomId: number): Promise<RosterStudent[]> => {
  const result = await req.payload.find({
    collection: 'students',
    where: { and: [{ classroom: { equals: classroomId } }, { status: { equals: 'studying' } }] },
    select: ROSTER_SELECT,
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
 * Records for a day under one activity (null = homeroom), for the given students or
 * this classroom — those the caller may read, or all of them with `overrideAccess`
 * (the save route needs records under a student's old classroom to detect a
 * conflict; it never returns them).
 */
export const loadExisting = async (
  req: PayloadRequest,
  args: {
    activityId: number | null
    classroomId?: number
    date: string
    overrideAccess?: boolean
    studentIds?: number[]
  },
): Promise<ExistingRecord[]> => {
  const { activityId, classroomId, date, overrideAccess = false, studentIds = [] } = args
  const result = await req.payload.find({
    collection: 'attendance-records',
    where: {
      and: [
        { date: { equals: date } },
        activityWhere(activityId),
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
 * The rows for one classroom, day and activity (null = homeroom), pre-filled from
 * saved records. `savedOnly` (the edit page) keeps just the students who have a
 * record that day under that activity.
 */
export const loadRollCallRows = async (
  req: PayloadRequest,
  args: { activityId: number | null; classroomId: number; date: string; savedOnly: boolean },
): Promise<RollCallRow[]> => {
  const { activityId, classroomId, date, savedOnly } = args
  const roster = await loadRoster(req, classroomId)
  const existing = await loadExisting(req, {
    activityId,
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
        select: ROSTER_SELECT,
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
