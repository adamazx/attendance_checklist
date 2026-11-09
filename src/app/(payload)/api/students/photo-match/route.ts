/**
 * POST /api/students/photo-match — admin-only dry run for the bulk photo import.
 *
 * Body (JSON): `{ stems: string[] }` — file names WITHOUT extension, i.e. student IDs
 * (decision D5). Never image bytes; never a 13-digit national-ID-looking stem (the
 * browser refuses those and this route refuses them again, without echoing them).
 *
 * Response: `{ results: [{ stem, status: 'matched'|'notFound'|'ambiguous',
 * student?: { id, studentId, name, classroom }, photoId }] }`. Exact `studentId`
 * match only. No writes. Stems are never logged.
 *
 * Reads run as the admin user (`overrideAccess: false`) with a minimal `select`.
 * The actual uploads go through Payload's REST endpoints (/api/student-photos),
 * one file per request — see components/ImportStudents/PhotoImportPanel.tsx.
 */
import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { isAdmin } from '@/access'
import { MATCH_LIMITS, validateStems, type MatchResult } from '@/lib/import/photos/photoStems'

const CHUNK = 500

const levelLabel = (level: unknown, roomNumber: unknown): string =>
  typeof level === 'string' && roomNumber != null ? `${level.replace(/^m/, 'ม.')}/${roomNumber}` : ''

/** Read the body up to `max` bytes; null when it is larger (Content-Length is not trusted). */
const readCapped = async (req: Request, max: number): Promise<string | null> => {
  const declared = Number(req.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > max) return null
  if (!req.body) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export async function POST(req: Request): Promise<Response> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: 'ต้องเข้าสู่ระบบก่อน' }, { status: 401 })
  }
  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่นำเข้ารูปนักเรียนได้' }, { status: 403 })
  }

  const raw = await readCapped(req, MATCH_LIMITS.maxBodyBytes)
  if (raw === null) {
    return NextResponse.json({ error: 'คำขอใหญ่เกินไป' }, { status: 413 })
  }
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'คำขอไม่ถูกต้อง (ต้องเป็น JSON)' }, { status: 400 })
  }
  const checked = validateStems((body as { stems?: unknown } | null)?.stems)
  if ('error' in checked) {
    return NextResponse.json({ error: checked.error }, { status: 400 })
  }
  const { stems } = checked

  // stem → matching students (normally exactly one)
  const found = new Map<string, MatchResult['student'][]>()
  for (let i = 0; i < stems.length; i += CHUNK) {
    const res = await payload.find({
      collection: 'students',
      where: { studentId: { in: stems.slice(i, i + CHUNK) } },
      select: { studentId: true, prefix: true, firstName: true, lastName: true, classroom: true },
      populate: { classrooms: { name: true, level: true, roomNumber: true } },
      depth: 1,
      pagination: false,
      overrideAccess: false,
      user,
    })
    for (const s of res.docs) {
      const room = typeof s.classroom === 'object' && s.classroom ? s.classroom : null
      const entry = {
        id: s.id,
        studentId: s.studentId,
        name: `${s.prefix ?? ''}${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
        classroom: room ? room.name || levelLabel(room.level, room.roomNumber) : '',
      }
      found.set(s.studentId, [...(found.get(s.studentId) ?? []), entry])
    }
  }

  const ids = [...found.values()].flat().map((s) => s!.id)
  const photoByStudent = new Map<number, number>()
  for (let i = 0; i < ids.length; i += CHUNK) {
    const res = await payload.find({
      collection: 'student-photos',
      where: { student: { in: ids.slice(i, i + CHUNK) } },
      select: { student: true },
      depth: 0,
      pagination: false,
      overrideAccess: false,
      user,
    })
    for (const p of res.docs) {
      const sid = typeof p.student === 'object' && p.student ? p.student.id : p.student
      if (typeof sid === 'number') photoByStudent.set(sid, p.id)
    }
  }

  const results: MatchResult[] = stems.map((stem) => {
    const list = found.get(stem) ?? []
    if (list.length === 0) return { stem, status: 'notFound', photoId: null }
    if (list.length > 1) return { stem, status: 'ambiguous', photoId: null }
    const student = list[0]!
    return { stem, status: 'matched', student, photoId: photoByStudent.get(student.id) ?? null }
  })

  return NextResponse.json({ results })
}
