/**
 * Date ranges for the report pages: parse the `from`/`to` query params into a safe,
 * bounded range, and define the quick ranges (วันนี้ / สัปดาห์นี้ / เดือนนี้ / เทอมนี้).
 * Pure — every day is a Bangkok calendar day `YYYY-MM-DD`; `today` is passed in.
 */
import { isRealThaiDay, shiftThaiDay } from '../date/thaiDay.ts'

export interface DateRange {
  from: string
  to: string
}

/** The longest range a report reads, which bounds every report query. */
export const MAX_RANGE_DAYS = 366

/** Why the requested range was adjusted; the page shows a notice for each. */
export type RangeNotice = 'invalid' | 'swapped' | 'future' | 'too_long'

export type QuickRangeKey = 'today' | 'week' | 'month' | 'term'

export interface QuickRange extends DateRange {
  key: QuickRangeKey
  label: string
}

const utc = (day: string): number => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, d)
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export const daysBetween = (a: string, b: string): number => Math.round((utc(b) - utc(a)) / 86_400_000)

/** Monday of the week `day` falls in (the Thai school week starts on Monday). */
export const mondayOf = (day: string): string => {
  const weekday = new Date(utc(day)).getUTCDay() // 0 = Sunday
  return shiftThaiDay(day, weekday === 0 ? -6 : 1 - weekday)
}

/** The 1st of the month `day` falls in. */
export const firstOfMonth = (day: string): string => `${day.slice(0, 8)}01`

/**
 * The quick ranges, all ending no later than today. เทอมนี้ is the active term's
 * start to min(end, today); it is left out when there is no active dated term or the
 * term has not started yet.
 */
export const quickRanges = (today: string, activeTerm?: DateRange | null): QuickRange[] => {
  const ranges: QuickRange[] = [
    { from: today, key: 'today', label: 'วันนี้', to: today },
    { from: mondayOf(today), key: 'week', label: 'สัปดาห์นี้', to: today },
    { from: firstOfMonth(today), key: 'month', label: 'เดือนนี้', to: today },
  ]
  if (activeTerm && activeTerm.from <= today) {
    const to = activeTerm.to < today ? activeTerm.to : today
    ranges.push({ from: activeTerm.from, key: 'term', label: 'เทอมนี้', to })
  }
  return ranges
}

/** The range shown when none is requested: เดือนนี้. */
export const defaultRange = (today: string): DateRange => ({ from: firstOfMonth(today), to: today })

/**
 * Resolve the requested range. A missing or unreal day falls back to the default
 * range; a reversed range is swapped; an end in the future becomes today; and a
 * range longer than MAX_RANGE_DAYS keeps its end and moves its start forward.
 */
export const parseRange = (
  requested: { from?: string; to?: string },
  today: string,
): DateRange & { notices: RangeNotice[] } => {
  const notices: RangeNotice[] = []
  const { from: rawFrom, to: rawTo } = requested
  if (rawFrom === undefined && rawTo === undefined) return { ...defaultRange(today), notices }
  if (!rawFrom || !rawTo || !isRealThaiDay(rawFrom) || !isRealThaiDay(rawTo)) {
    return { ...defaultRange(today), notices: ['invalid'] }
  }

  let from = rawFrom
  let to = rawTo
  if (from > to) {
    ;[from, to] = [to, from]
    notices.push('swapped')
  }
  if (to > today) {
    to = today
    notices.push('future')
    if (from > to) from = to
  }
  if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) {
    from = shiftThaiDay(to, -(MAX_RANGE_DAYS - 1))
    notices.push('too_long')
  }
  return { from, notices, to }
}

export const RANGE_NOTICE_MESSAGES: Record<RangeNotice, string> = {
  future: 'เลือกวันในอนาคตไม่ได้ ระบบจึงแสดงข้อมูลถึงวันนี้',
  invalid: 'วันที่ไม่ถูกต้อง ระบบจึงแสดงข้อมูลเดือนนี้แทน',
  swapped: 'วันเริ่มต้นอยู่หลังวันสิ้นสุด ระบบจึงสลับให้',
  too_long: `ช่วงวันที่ยาวเกิน ${MAX_RANGE_DAYS} วัน ระบบจึงแสดงเฉพาะ ${MAX_RANGE_DAYS} วันล่าสุดของช่วง`,
}
