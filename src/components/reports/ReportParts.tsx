import Link from 'next/link'
import React from 'react'

import { statusInfo, type AttendanceStatus } from '@/lib/attendance/statuses'
import { formatThaiDay } from '@/lib/date/thaiDay'
import type { ActivityFilter } from '@/lib/reports/aggregate'
import type { DateRange, RangeNotice } from '@/lib/reports/dateRange'
import { RANGE_NOTICE_MESSAGES } from '@/lib/reports/dateRange'

export const tableClass = 'w-full border-collapse overflow-hidden rounded-xl bg-surface text-sm shadow-card print:shadow-none'
export const thClass = 'border-b-2 border-brand-gold bg-gold-pale px-2.5 py-2 text-left font-semibold'
export const tdClass = 'border-b border-line px-2.5 py-2'
export const numClass = 'text-right tabular-nums'

/** `1 พฤศจิกายน 2569 – 3 พฤศจิกายน 2569`, or a single day. */
export const formatRange = (range: DateRange): string =>
  range.from === range.to ? formatThaiDay(range.from) : `${formatThaiDay(range.from)} – ${formatThaiDay(range.to)}`

export function ReportHeading(props: { children?: React.ReactNode; title: string }) {
  return (
    <>
      <Link className="text-brand-red-dark print:hidden" href="/">
        ← กลับหน้าหลัก
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-brand-red">{props.title}</h1>
      {props.children && <p className="mt-1 mb-4">{props.children}</p>}
    </>
  )
}

export const Notice = (props: { children: React.ReactNode }) => (
  <p className="mb-3 rounded-lg border border-brand-gold bg-gold-pale px-3 py-2 text-sm print:hidden">{props.children}</p>
)

export const RangeNotices = (props: { notices: RangeNotice[] }) => (
  <>
    {props.notices.map((n) => (
      <Notice key={n}>{RANGE_NOTICE_MESSAGES[n]}</Notice>
    ))}
  </>
)

export const NoClassrooms = () => <p className="mt-4">ยังไม่มีห้องเรียนที่ได้รับมอบหมาย กรุณาติดต่อผู้ดูแลระบบ</p>

export const EmptyState = (props: { children?: React.ReactNode }) => (
  <p className="rounded-xl bg-surface p-4 text-center text-muted shadow-card">
    {props.children ?? 'ไม่มีข้อมูลเช็คชื่อในช่วงวันที่เลือก'}
  </p>
)

export function StatusBadge(props: { status: AttendanceStatus }) {
  const s = statusInfo(props.status)
  return (
    <span
      className={`inline-block min-w-12 rounded-md px-2 py-0.5 text-center text-sm font-semibold print:border print:border-line ${s.badgeClass}`}
    >
      {s.label}
    </span>
  )
}

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

/** Shown beside a student who is no longer studying in the report's classroom. */
export const DepartedTag = () => <span className="ml-1.5 text-xs text-muted">(ย้าย/ออก)</span>
