/**
 * AttendanceRecord hooks: date canonicalization, server-set snapshot/metadata,
 * advisor write-scoping, and AuditLog writes on create/edit/backdate/delete.
 */
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  PayloadRequest,
} from 'payload'

import { Forbidden } from 'payload'

import { advisorActiveClassroomIds, isAdmin } from '@/access'
import { writeAuditLog } from '@/lib/audit/writeAuditLog'
import { toThaiDay, todayThai } from '@/lib/date/thaiDay'

const relId = (v: unknown): number | string | null | undefined =>
  v && typeof v === 'object' ? (v as { id: number | string }).id : (v as number | string | null | undefined)

/** Find the term (within an academic year) whose [startDate, endDate] contains the day. */
const deriveTerm = async (
  req: PayloadRequest,
  academicYearId: number | string | null | undefined,
  day: string,
): Promise<number | string | null> => {
  if (!academicYearId || !day) return null
  const terms = await req.payload.find({
    collection: 'terms',
    where: { academicYear: { equals: academicYearId } },
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  for (const t of terms.docs as Array<{ id: number | string; startDate?: string | null; endDate?: string | null }>) {
    if (!t.startDate || !t.endDate) continue
    if (day >= toThaiDay(t.startDate) && day <= toThaiDay(t.endDate)) return t.id
  }
  return null
}

/** Canonicalize `date` to the Asia/Bangkok calendar day (YYYY-MM-DD). */
export const normalizeAttendanceDate: CollectionBeforeValidateHook = ({ data }) => {
  if (data && data.date) data.date = toThaiDay(data.date as string)
  return data
}

/**
 * On create: enforce advisor scoping on the target student, snapshot
 * classroom/academicYear/term, and stamp recordedBy/recordedAt. Snapshot and
 * metadata are not re-derived on update (history stays stable).
 */
export const setSnapshotAndEnforce: CollectionBeforeChangeHook = async ({ data, req, operation }) => {
  if (operation !== 'create') return data

  const studentId = relId(data.student)
  if (!studentId) {
    // Fail closed: only a truly absent student may fall through to field validation.
    // A malformed value (array, 0) must not skip the scoping check below.
    if (data.student != null) throw new Forbidden(req.t)
    return data
  }

  const student = await req.payload.findByID({
    collection: 'students',
    id: studentId,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const classroomId = relId((student as { classroom?: unknown }).classroom)

  // Advisor write-scoping: a non-admin may only record for a student in their
  // own classroom(s) of the active academic year. (Discipline can't reach create
  // per access; guard anyway.)
  const user = req.user
  if (user && !isAdmin(user)) {
    const ids = (await advisorActiveClassroomIds(req)).map(String)
    if (!classroomId || !ids.includes(String(classroomId))) {
      throw new Forbidden(req.t)
    }
  }

  const classroom = classroomId
    ? await req.payload.findByID({ collection: 'classrooms', id: classroomId, depth: 0, overrideAccess: true, req })
    : null
  const academicYearId = relId((classroom as { academicYear?: unknown } | null)?.academicYear)

  data.classroom = classroomId
  data.academicYear = academicYearId ?? null
  data.term = await deriveTerm(req, academicYearId, data.date as string)
  data.recordedBy = user?.id ?? data.recordedBy
  data.recordedAt = new Date().toISOString()
  return data
}

/** Audit create/backdate/edit. Backdate = created for a day before today (Bangkok). */
export const auditAttendanceChange: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  const action =
    operation === 'create' ? ((doc.date as string) < todayThai() ? 'backdate' : 'create') : 'edit'
  await writeAuditLog({
    req,
    collectionSlug: 'attendance-records',
    documentId: doc.id as number | string,
    action,
    before: operation === 'create' ? null : previousDoc,
    after: doc,
  })
  return doc
}

/** Audit delete. */
export const auditAttendanceDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await writeAuditLog({
    req,
    collectionSlug: 'attendance-records',
    documentId: doc.id as number | string,
    action: 'delete',
    before: doc,
    after: null,
  })
  return doc
}
