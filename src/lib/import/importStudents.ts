/**
 * Core student-roster import: validate, dedupe by `studentId`, and (unless a dry
 * run) create students via the Payload Local API with access control enforced.
 *
 * Access: the caller must already have gated on an admin user. We still pass
 * `user` with `overrideAccess: false` to `payload.create`, so the `students`
 * collection's own `adminOnly` create rule runs too (defense in depth — this
 * never weakens an access rule).
 */
import type { Payload, PayloadRequest, RequiredDataFromCollectionSlug } from 'payload'

import {
  classroomKeyFromCell,
  mapHeaders,
  normalizePrefix,
  normalizeStatus,
  thaiDigitsToArabic,
} from './studentMapping'
import type { ImportResult, StudentField } from './types'

/** Required columns — an import cannot proceed without all of these. */
const REQUIRED_COLUMNS: Array<[StudentField, string]> = [
  ['studentId', 'เลขประจำตัว'],
  ['firstName', 'ชื่อ'],
  ['lastName', 'นามสกุล'],
  ['classroom', 'ห้องเรียน'],
]

interface ClassroomIndex {
  /** canonical key "level/room" or compact name → list of classroom ids */
  byKey: Map<string, Array<string | number>>
  /** classroom id → display name, for result messages */
  names: Map<string | number, string>
}

const buildClassroomIndex = async (
  payload: Payload,
  user: PayloadRequest['user'],
): Promise<ClassroomIndex> => {
  const res = await payload.find({
    collection: 'classrooms',
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: false,
    user,
  })

  const byKey = new Map<string, Array<string | number>>()
  const names = new Map<string | number, string>()
  const add = (key: string, id: string | number) => {
    const list = byKey.get(key) ?? []
    // The level/room key and the name-derived key can coincide (both "5/97"):
    // only record a classroom once per key so a single room is not seen as
    // ambiguous. Genuine ambiguity (two rooms, different years) still stands.
    if (!list.includes(id)) list.push(id)
    byKey.set(key, list)
  }

  for (const c of res.docs as Array<{
    id: string | number
    name?: string | null
    level?: string | null
    roomNumber?: number | null
  }>) {
    names.set(c.id, c.name ?? String(c.id))
    if (c.level && c.roomNumber != null) {
      const levelNum = Number(c.level.replace(/\D/g, ''))
      if (!Number.isNaN(levelNum)) add(`${levelNum}/${c.roomNumber}`, c.id)
    }
    if (c.name) {
      const key = classroomKeyFromCell(c.name)
      if (key) add(key, c.id)
      // Also index the compact raw name for odd/custom names.
      add(`name:${thaiDigitsToArabic(c.name).replace(/[\s.]/g, '')}`, c.id)
    }
  }
  return { byKey, names }
}

/** Resolve a classroom cell to a single id, or an error message. */
const resolveClassroom = (
  cell: string,
  index: ClassroomIndex,
): { id: string | number } | { error: string } => {
  const candidates: string[] = []
  const key = classroomKeyFromCell(cell)
  if (key) candidates.push(key)
  candidates.push(`name:${thaiDigitsToArabic(cell).replace(/[\s.]/g, '')}`)

  for (const c of candidates) {
    const ids = index.byKey.get(c)
    if (ids && ids.length === 1) return { id: ids[0] }
    if (ids && ids.length > 1) {
      return { error: `ห้องเรียน "${cell}" ตรงกับหลายห้อง (หลายปีการศึกษา) โปรดระบุให้ชัดเจน` }
    }
  }
  return { error: `ไม่พบห้องเรียน "${cell}" ในระบบ` }
}

export const importStudents = async (
  payload: Payload,
  user: PayloadRequest['user'],
  grid: string[][],
  dryRun: boolean,
): Promise<ImportResult> => {
  const result: ImportResult = {
    dryRun,
    totalRows: 0,
    created: [],
    duplicates: [],
    errors: [],
    summary: { created: 0, duplicates: 0, errors: 0 },
  }

  if (grid.length === 0) {
    result.fatal = 'ไฟล์ว่างเปล่า หรืออ่านข้อมูลไม่ได้'
    return result
  }

  const header = grid[0]
  const cols = mapHeaders(header)

  const missing = REQUIRED_COLUMNS.filter(([field]) => cols[field] === undefined)
  if (missing.length > 0) {
    result.fatal = `ไม่พบคอลัมน์ที่จำเป็น: ${missing.map(([, th]) => th).join(', ')}`
    return result
  }

  const dataRows = grid.slice(1)
  result.totalRows = dataRows.length

  const classroomIndex = await buildClassroomIndex(payload, user)

  // Existing studentIds (dedupe against the DB).
  const existing = await payload.find({
    collection: 'students',
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: false,
    user,
  })
  const existingIds = new Set<string>(
    (existing.docs as Array<{ studentId?: string | null }>)
      .map((d) => (d.studentId ?? '').trim())
      .filter(Boolean),
  )
  const seenInFile = new Set<string>()

  const cell = (row: string[], field: StudentField): string => {
    const idx = cols[field]
    return idx === undefined ? '' : (row[idx] ?? '').trim()
  }

  interface Pending {
    rowNo: number
    studentId: string
    data: Record<string, unknown>
    name: string
    classroomName: string
  }
  const pending: Pending[] = []

  dataRows.forEach((row, i) => {
    const rowNo = i + 2 // spreadsheet row (header is row 1)
    const studentId = cell(row, 'studentId')
    const firstName = cell(row, 'firstName')
    const lastName = cell(row, 'lastName')
    const classroomCell = cell(row, 'classroom')

    const pushError = (message: string) => {
      result.errors.push({ row: rowNo, studentId: studentId || undefined, message })
    }

    if (!studentId) return pushError('ไม่มีเลขประจำตัว (เลขประจำตัวจำเป็น)')
    if (!firstName) return pushError('ไม่มีชื่อ (ชื่อจำเป็น)')
    if (!lastName) return pushError('ไม่มีนามสกุล (นามสกุลจำเป็น)')
    if (!classroomCell) return pushError('ไม่มีห้องเรียน (ห้องเรียนจำเป็น)')

    // Dedupe: within the file first, then against the DB.
    if (seenInFile.has(studentId)) {
      return result.duplicates.push({
        row: rowNo,
        studentId,
        message: 'เลขประจำตัวซ้ำกับแถวก่อนหน้าในไฟล์เดียวกัน',
      })
    }
    if (existingIds.has(studentId)) {
      seenInFile.add(studentId)
      return result.duplicates.push({
        row: rowNo,
        studentId,
        message: 'มีนักเรียนเลขประจำตัวนี้อยู่แล้วในระบบ',
      })
    }

    const prefix = normalizePrefix(cell(row, 'prefix'))
    if (prefix === undefined) {
      return pushError(`คำนำหน้าไม่ถูกต้อง: "${cell(row, 'prefix')}"`)
    }

    const status = normalizeStatus(cell(row, 'status'))
    if (status === undefined) {
      return pushError(`สถานะไม่ถูกต้อง: "${cell(row, 'status')}"`)
    }

    let classNumber: number | undefined
    const classNumberCell = thaiDigitsToArabic(cell(row, 'classNumber'))
    if (classNumberCell) {
      const n = Number(classNumberCell)
      if (!Number.isInteger(n) || n < 0) {
        return pushError(`เลขที่ไม่ถูกต้อง: "${cell(row, 'classNumber')}"`)
      }
      classNumber = n
    }

    const resolved = resolveClassroom(classroomCell, classroomIndex)
    if ('error' in resolved) return pushError(resolved.error)

    seenInFile.add(studentId)
    pending.push({
      rowNo,
      studentId,
      name: `${firstName} ${lastName}`.trim(),
      classroomName: classroomIndex.names.get(resolved.id) ?? classroomCell,
      data: {
        studentId,
        firstName,
        lastName,
        classroom: resolved.id,
        status,
        ...(prefix ? { prefix } : {}),
        ...(classNumber != null ? { classNumber } : {}),
      },
    })
  })

  // Write phase (skipped on a dry run).
  for (const p of pending) {
    if (!dryRun) {
      try {
        await payload.create({
          collection: 'students',
          // Values were normalized to the collection's accepted values above;
          // cast to the generated create shape (status/prefix are string unions).
          data: p.data as RequiredDataFromCollectionSlug<'students'>,
          overrideAccess: false,
          user,
        })
      } catch (err) {
        result.errors.push({
          row: p.rowNo,
          studentId: p.studentId,
          message: `บันทึกไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`,
        })
        continue
      }
    }
    result.created.push({
      row: p.rowNo,
      studentId: p.studentId,
      name: p.name,
      classroom: p.classroomName,
    })
  }

  // Keep reported rows in spreadsheet order.
  const byRow = (a: { row: number }, b: { row: number }) => a.row - b.row
  result.created.sort(byRow)
  result.duplicates.sort(byRow)
  result.errors.sort(byRow)

  result.summary = {
    created: result.created.length,
    duplicates: result.duplicates.length,
    errors: result.errors.length,
  }
  return result
}
