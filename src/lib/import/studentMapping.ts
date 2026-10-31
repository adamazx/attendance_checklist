/**
 * Column-header matching and value normalization for the student importer.
 *
 * Rosters come from Excel with Thai headers (and occasionally English), so we
 * match headers against a synonym table rather than requiring an exact schema.
 * Prefix/status cells are normalized to the fixed `students` select values.
 */
import type { StudentField } from './types'

/** Normalize a header/cell for matching: collapse whitespace, lowercase ASCII. */
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase()

/** A compact key for prefix/classroom matching: drop spaces and dots. */
const compact = (s: string): string => s.replace(/[\s.]/g, '')

/** Convert Thai digits (๐-๙) to Arabic so "ม.๔/๒" parses like "ม.4/2". */
export const thaiDigitsToArabic = (s: string): string =>
  s.replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50))

/** Header synonyms → canonical field. Keys are `norm()`-ed. */
const HEADER_SYNONYMS: Record<string, StudentField> = {}
const register = (field: StudentField, names: string[]) => {
  for (const n of names) HEADER_SYNONYMS[norm(n)] = field
}
register('studentId', [
  'เลขประจำตัว',
  'เลขประจำตัวนักเรียน',
  'รหัสนักเรียน',
  'รหัสประจำตัว',
  'รหัส',
  'studentid',
  'student id',
  'student_id',
])
register('prefix', ['คำนำหน้า', 'คำนำหน้าชื่อ', 'prefix', 'title'])
register('firstName', ['ชื่อ', 'ชื่อจริง', 'firstname', 'first name', 'first_name', 'name'])
register('lastName', ['นามสกุล', 'สกุล', 'lastname', 'last name', 'last_name', 'surname'])
register('classNumber', [
  'เลขที่',
  'เลขที่ในห้อง',
  'ลำดับ',
  'classnumber',
  'class number',
  'class_number',
  'no',
  'no.',
  'number',
  'order',
])
register('classroom', [
  'ห้องเรียน',
  'ห้อง',
  'ชั้น',
  'ชั้นเรียน',
  'ระดับชั้น',
  'classroom',
  'class',
  'room',
])
register('status', ['สถานะ', 'status'])

/**
 * Map a header row to column indices per canonical field. The first column that
 * matches a field wins; later duplicate matches are ignored.
 */
export const mapHeaders = (header: string[]): Partial<Record<StudentField, number>> => {
  const map: Partial<Record<StudentField, number>> = {}
  header.forEach((cell, idx) => {
    const field = HEADER_SYNONYMS[norm(cell)]
    if (field && map[field] === undefined) map[field] = idx
  })
  return map
}

/** Canonical prefix values accepted by the `students.prefix` select. */
const PREFIX_BY_COMPACT: Record<string, string> = {
  'ด.ช.': 'ด.ช.',
  ดช: 'ด.ช.',
  เด็กชาย: 'ด.ช.',
  'ด.ญ.': 'ด.ญ.',
  ดญ: 'ด.ญ.',
  เด็กหญิง: 'ด.ญ.',
  นาย: 'นาย',
  'น.ส.': 'น.ส.',
  นส: 'น.ส.',
  นางสาว: 'น.ส.',
}

/** Returns the canonical prefix, `null` if empty, or `undefined` if unknown. */
export const normalizePrefix = (raw: string): string | null | undefined => {
  const v = raw.trim()
  if (!v) return null
  return PREFIX_BY_COMPACT[compact(v)]
}

/** Canonical status values accepted by the `students.status` select. */
const STATUS_BY_COMPACT: Record<string, string> = {
  กำลังศึกษา: 'studying',
  ศึกษาอยู่: 'studying',
  ปกติ: 'studying',
  studying: 'studying',
  ย้าย: 'transferred',
  ย้ายออก: 'transferred',
  transferred: 'transferred',
  ลาพัก: 'on_leave',
  พักการเรียน: 'on_leave',
  onleave: 'on_leave',
  จบการศึกษา: 'graduated',
  จบ: 'graduated',
  graduated: 'graduated',
}

/**
 * Returns the canonical status; defaults to `studying` when empty;
 * `undefined` when a non-empty value is not recognized.
 */
export const normalizeStatus = (raw: string): string | undefined => {
  const v = raw.trim()
  if (!v) return 'studying'
  return STATUS_BY_COMPACT[compact(v).toLowerCase()] ?? STATUS_BY_COMPACT[compact(v)]
}

/**
 * Derive a canonical classroom key `"<levelNumber>/<roomNumber>"` from a cell
 * like "ม.4/2", "ม๔/๒", "4/2", or "ม.4 / 2". Returns `null` if no `n/m` pattern
 * is present (caller may then fall back to a raw name match).
 */
export const classroomKeyFromCell = (raw: string): string | null => {
  const m = thaiDigitsToArabic(raw).match(/(\d+)\s*\/\s*(\d+)/)
  if (!m) return null
  return `${Number(m[1])}/${Number(m[2])}`
}
