/**
 * POST /api/attendance/save — bulk roll-call upsert for one classroom and day.
 *
 * Body: `{ classroomId, date, entries: [{ studentId, status, note }] }`.
 * Returns `{ created, updated, unchanged }`.
 *
 * All writes share one transaction, so a save lands whole or not at all. They go
 * through the Local API with `overrideAccess: false` and the same `req`, so the
 * collection's access rules, snapshot hook and AuditLog hook all apply and join
 * the transaction. Payload rolls the transaction back and clears it from `req` when
 * a nested operation fails, so the loop must stop at the first error.
 *
 * Takes precedence over the `/api/[...slug]` catch-all (concrete segments win).
 */
import config from '@payload-config'
import { NextResponse } from 'next/server'
import {
  commitTransaction,
  createLocalReq,
  Forbidden,
  getPayload,
  initTransaction,
  killTransaction,
  ValidationError,
} from 'payload'

import { isDiscipline } from '@/access'
import { ATTENDANCE_DAY_MESSAGES, checkAttendanceDay } from '@/lib/attendance/dateRules'
import { planSave, type SaveEntry } from '@/lib/attendance/planSave'
import { fullName, listRollCallClassrooms, loadExisting, loadRoster } from '@/lib/attendance/rollCall'
import { isAttendanceStatus } from '@/lib/attendance/statuses'
import { todayThai } from '@/lib/date/thaiDay'

const MAX_ENTRIES = 100
const MAX_NOTE_LENGTH = 500
/** Postgres int4 upper bound; larger ids would fail in the query, outside the transaction. */
const MAX_ID = 2147483647

const isId = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) > 0 && (value as number) <= MAX_ID

const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 })
const forbidden = () => NextResponse.json({ error: 'ไม่มีสิทธิ์บันทึกข้อมูลของห้องนี้' }, { status: 403 })

/** Validate one raw row; null when malformed. */
const parseEntry = (raw: unknown): SaveEntry | null => {
  const { note, status, studentId } = (raw ?? {}) as Record<string, unknown>
  if (!isId(studentId) || !isAttendanceStatus(status)) return null
  if (note != null && typeof note !== 'string') return null
  const trimmed = (note ?? '').trim()
  if (trimmed.length > MAX_NOTE_LENGTH) return null
  return { note: trimmed, status, studentId }
}

export async function POST(request: Request): Promise<Response> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })

  if (!user) {
    return NextResponse.json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' }, { status: 401 })
  }
  if (isDiscipline(user)) return forbidden()

  const body = (await request.json().catch(() => null)) as {
    classroomId?: unknown
    date?: unknown
    entries?: unknown
  } | null
  const { classroomId, date, entries: rawEntries } = body ?? {}

  if (!isId(classroomId)) return badRequest('ไม่พบห้องเรียน')
  if (typeof date !== 'string') return badRequest(ATTENDANCE_DAY_MESSAGES.invalid)
  // Same rule the collection enforces on create; checked here for a clean 400.
  const dateError = checkAttendanceDay(date, todayThai())
  if (dateError) return badRequest(ATTENDANCE_DAY_MESSAGES[dateError])
  if (!Array.isArray(rawEntries) || rawEntries.length === 0 || rawEntries.length > MAX_ENTRIES) {
    return badRequest('รายการนักเรียนไม่ถูกต้อง')
  }

  const entries = rawEntries.map(parseEntry)
  if (entries.some((e) => e === null)) return badRequest('ข้อมูลการเช็คชื่อไม่ถูกต้อง')
  const valid = entries as SaveEntry[]
  if (new Set(valid.map((e) => e.studentId)).size !== valid.length) {
    return badRequest('มีนักเรียนซ้ำในรายการ')
  }

  const req = await createLocalReq({ user }, payload)
  const classrooms = await listRollCallClassrooms(req)
  if (!classrooms.some((c) => c.id === classroomId)) return forbidden()

  const roster = await loadRoster(req, classroomId)
  // overrideAccess: a student who moved in may have today's record under their old
  // classroom, which this advisor can't read. It only feeds the plan's conflict
  // check; every write below still runs with the caller's access.
  const existing = await loadExisting(req, {
    date,
    overrideAccess: true,
    studentIds: valid.map((e) => e.studentId),
  })
  const plan = planSave({
    classroomId: classroomId,
    entries: valid,
    existing,
    rosterIds: new Set(roster.map((s) => s.id)),
  })
  if (plan.outsiders.length > 0) return forbidden()
  if (plan.conflicts.length > 0) {
    // Conflicts are always on this roster, so the names are ones the caller can read.
    const names = roster.filter((s) => plan.conflicts.includes(s.id)).map(fullName)
    return NextResponse.json(
      {
        conflicts: plan.conflicts,
        error: `${names.join(', ')} มีบันทึกการเช็คชื่อของวันที่เลือกแล้วในห้องเดิม — ติดต่อผู้ดูแลระบบหากต้องแก้ไข`,
      },
      { status: 409 },
    )
  }

  await initTransaction(req)
  try {
    for (const entry of plan.creates) {
      await payload.create({
        collection: 'attendance-records',
        data: { date, note: entry.note || null, status: entry.status, student: entry.studentId },
        overrideAccess: false,
        req,
      })
    }
    for (const { id, note, status } of plan.updates) {
      await payload.update({
        collection: 'attendance-records',
        id,
        data: { note: note || null, status },
        overrideAccess: false,
        req,
      })
    }
    await commitTransaction(req)
  } catch (err) {
    await killTransaction(req)
    if (err instanceof Forbidden) return forbidden()
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: 'ข้อมูลเพิ่งถูกบันทึกโดยผู้อื่น กรุณาโหลดใหม่' }, { status: 409 })
    }
    payload.logger.error({ err, msg: 'attendance save failed' })
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }, { status: 500 })
  }

  return NextResponse.json({
    created: plan.creates.length,
    unchanged: plan.unchanged,
    updated: plan.updates.length,
  })
}
