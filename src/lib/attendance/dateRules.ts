/**
 * The days attendance may be recorded for. Shared by the AttendanceRecord collection
 * (the hard backstop for every write path) and the save route (which maps the
 * failure to its own Thai UX message).
 */
import { isRealThaiDay } from '../date/thaiDay.ts'

export type AttendanceDayError = 'invalid' | 'future' | 'too_old'

/**
 * Null when `day` may be recorded on `today` (both `YYYY-MM-DD`, Bangkok): a real
 * calendar day, not in the future, and no earlier than the previous calendar year
 * (the same floor as the date picker).
 */
export const checkAttendanceDay = (day: string, today: string): AttendanceDayError | null => {
  if (!isRealThaiDay(day)) return 'invalid'
  if (day > today) return 'future'
  if (day.slice(0, 4) < String(Number(today.slice(0, 4)) - 1)) return 'too_old'
  return null
}

/** Thai message for each rule. */
export const ATTENDANCE_DAY_MESSAGES: Record<AttendanceDayError, string> = {
  invalid: 'วันที่ไม่ถูกต้อง',
  future: 'ไม่สามารถเช็คชื่อล่วงหน้าได้',
  too_old: 'วันที่เก่าเกินไป',
}
