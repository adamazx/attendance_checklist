/**
 * POST /api/students/import — admin-only student-roster importer (phase-1b).
 *
 * Multipart form fields:
 *  - `file`   : the CSV/XLSX roster.
 *  - `dryRun` : "true" to validate + preview only (no writes); anything else writes.
 *
 * Auth is resolved through Payload (`payload.auth`) and gated to admins. Writes
 * go through the Local API with `overrideAccess: false`, so the `students`
 * collection access rules also apply — this route never widens access.
 *
 * This explicit path takes precedence over Payload's `/api/[...slug]` REST
 * catch-all because Next.js matches concrete segments before a catch-all.
 */
import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { isAdmin } from '@/access'
import { importStudents } from '@/lib/import/importStudents'
import { parseRoster } from '@/lib/import/parseRoster'

/** Reject anything larger than this (rosters are small; guards against abuse). */
const MAX_BYTES = 5 * 1024 * 1024

export async function POST(req: Request): Promise<Response> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: 'ต้องเข้าสู่ระบบก่อน' }, { status: 401 })
  }
  if (!isAdmin(user)) {
    return NextResponse.json(
      { error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่นำเข้ารายชื่อได้' },
      { status: 403 },
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'คำขอไม่ถูกต้อง (ต้องเป็น multipart/form-data)' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'ไม่พบไฟล์ (file)' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'ไฟล์ว่างเปล่า' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'ไฟล์ใหญ่เกินไป (จำกัด 5MB)' }, { status: 400 })
  }

  const dryRun = form.get('dryRun') === 'true'

  let grid: string[][]
  try {
    grid = parseRoster(file.name, await file.arrayBuffer())
  } catch (err) {
    return NextResponse.json(
      { error: `อ่านไฟล์ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }

  const result = await importStudents(payload, user, grid, dryRun)
  return NextResponse.json(result)
}
