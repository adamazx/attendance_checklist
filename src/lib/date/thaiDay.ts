/**
 * Thai-calendar-day helpers (Asia/Bangkok, UTC+7).
 *
 * The school operates in Asia/Bangkok. Attendance is keyed by the *calendar day*
 * a student is marked, so we represent that day as a plain `YYYY-MM-DD` string —
 * no timestamp, no timezone. This avoids the off-by-one that a `timestamptz`
 * normalized to UTC midnight would cause (e.g. 2026-11-01T00:00+07 = 2026-10-31T17:00Z
 * would truncate to the PREVIOUS day). All Phase 2 "today"/day math goes through here.
 */
const BANGKOK = 'Asia/Bangkok'

// en-CA formats as YYYY-MM-DD; pinned to the Bangkok zone.
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BANGKOK,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Matches a canonical calendar day `YYYY-MM-DD`. */
export const THAI_DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Canonicalize any input to the Asia/Bangkok calendar day `YYYY-MM-DD`.
 * - A bare `YYYY-MM-DD` string is returned as-is (it already *is* the calendar day
 *   the user picked — no timezone conversion applied).
 * - An ISO timestamp or Date is converted to the day it falls on in Bangkok.
 */
export const toThaiDay = (input: string | Date): string => {
  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (THAI_DAY_RE.test(trimmed)) return trimmed
    const d = new Date(trimmed)
    if (Number.isNaN(d.getTime())) throw new Error(`Invalid date value: "${input}"`)
    return dayFormatter.format(d)
  }
  if (Number.isNaN(input.getTime())) throw new Error('Invalid Date value')
  return dayFormatter.format(input)
}

/** Today's calendar day in Asia/Bangkok, as `YYYY-MM-DD`. */
export const todayThai = (): string => dayFormatter.format(new Date())

/** Thai month names, January first. */
export const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
] as const

const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
] as const

const THAI_WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'] as const

/** Buddhist-era year offset (พ.ศ. = ค.ศ. + 543). */
export const BE_OFFSET = 543

const parts = (day: string): [number, number, number] => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  return [y, m, d]
}

/** True for a `YYYY-MM-DD` that exists on the calendar (the regex alone accepts 2026-02-31). */
export const isRealThaiDay = (day: string): boolean => {
  if (!THAI_DAY_RE.test(day)) return false
  const [y, m, d] = parts(day)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** `2026-11-02` → `2 พฤศจิกายน 2569`. */
export const formatThaiDay = (day: string): string => {
  const [y, m, d] = parts(day)
  return `${d} ${THAI_MONTHS[m - 1]} ${y + BE_OFFSET}`
}

/** `2026-11-02` → `2 พ.ย. 2569`. */
export const formatThaiDayShort = (day: string): string => {
  const [y, m, d] = parts(day)
  return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${y + BE_OFFSET}`
}

/** `2026-11-02` → `วันจันทร์ที่ 2 พฤศจิกายน 2569`. */
export const formatThaiDayLong = (day: string): string => {
  const [y, m, d] = parts(day)
  const weekday = THAI_WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `วัน${weekday}ที่ ${formatThaiDay(day)}`
}

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BANGKOK,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** An instant → `2 พ.ย. 2569, 14:05` in Asia/Bangkok. */
export const formatThaiDateTime = (input: Date): string =>
  `${formatThaiDayShort(toThaiDay(input))}, ${timeFormatter.format(input)}`

/** Shift a calendar day by whole days (no timezone involved). */
export const shiftThaiDay = (day: string, days: number): string => {
  const [y, m, d] = parts(day)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}