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

import { buildClassroomIndex, loadActiveYear, resolveClassroom } from './shared'
import { mapHeaders, normalizePrefix, normalizeStatus, thaiDigitsToArabic } from './studentMapping'
import type { ImportResult, StudentField } from './types'

/** Required columns — an import cannot proceed without all of these. */
const REQUIRED_COLUMNS: Array<[StudentField, string]> = [
  ['studentId', 'เลขประจำตัว'],
  ['firstName', 'ชื่อ'],
  ['lastName', 'นามสกุล'],
  ['classroom', 'ห้องเรียน'],
]

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

  const activeYear = await loadActiveYear(payload, user)
  if ('fatal' in activeYear) {
    result.fatal = activeYear.fatal
    return result
  }
  const activeYearId = activeYear.id

  const classroomIndex = await buildClassroomIndex(payload, user, activeYearId)

  // Existing studentIds (dedupe against the DB).
  const existing = await payload.find({
    collection: 'students',
    select: { studentId: true },
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
