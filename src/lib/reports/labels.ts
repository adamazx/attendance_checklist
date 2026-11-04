/**
 * Text helpers shared by the report pages and their Excel/PDF exports, so both say
 * exactly the same thing. Pure (no React), so the node test runner can load them.
 */
import { formatThaiDay } from '../date/thaiDay.ts'

import type { ActivityFilter } from './aggregate.ts'
import type { DateRange } from './dateRange.ts'

/** `1 พฤศจิกายน 2569 – 3 พฤศจิกายน 2569`, or a single day. */
export const formatRange = (range: DateRange): string =>
  range.from === range.to ? formatThaiDay(range.from) : `${formatThaiDay(range.from)} – ${formatThaiDay(range.to)}`

/** A record's activity for a table cell: its name, or the homeroom. */
export const recordActivityName = (activityId: number | null, names: ReadonlyMap<number, string>): string =>
  activityId === null ? 'โฮมรูม' : (names.get(activityId) ?? '—')

/** The filter for the report heading. */
export const activityFilterLabel = (filter: ActivityFilter, names: ReadonlyMap<number, string>): string =>
  filter === 'homeroom' ? 'เช็คชื่อประจำวัน' : filter === 'all' ? 'ทุกกิจกรรม' : (names.get(filter) ?? '—')

/**
 * Header for a record total. Only "all" can hold several records per student per
 * day, so its totals are times (ครั้ง), not days.
 */
export const totalLabel = (filter: ActivityFilter): string => (filter === 'all' ? 'รวม (ครั้ง)' : 'รวมวัน')

/** How %มา is computed (see aggregate's presentRate), as a footnote for the filter. */
export const rateFootnote = (filter: ActivityFilter): string =>
  filter === 'all'
    ? '%มา = จำนวนครั้งที่ “มา” หรือ “สาย” ÷ จำนวนครั้งที่มีการบันทึก (รวมโฮมรูมและทุกวิชา/กิจกรรม)'
    : '%มา = จำนวนวันที่ “มา” หรือ “สาย” ÷ จำนวนวันที่มีการบันทึกในช่วงวันที่เลือก (วันที่ไม่มีการบันทึกไม่นับ)'

/** Appended to a student who is no longer studying in the report's classroom. */
export const DEPARTED_SUFFIX = '(ย้าย/ออก)'

export const EMPTY_RECORDS = 'ไม่มีข้อมูลเช็คชื่อในช่วงวันที่เลือก'
export const EMPTY_LATE = 'ไม่มีนักเรียนมาสายในช่วงวันที่เลือก'
export const EMPTY_STUDENTS = 'ไม่พบนักเรียนในห้องนี้'

export const SCHOOL_NAME = 'โรงเรียนโนนหันวิทยายน'
export const SCHOOL_AFFILIATION = 'สังกัด องค์การบริหารส่วนจังหวัดขอนแก่น'
