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
