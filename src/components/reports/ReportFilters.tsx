import Link from 'next/link'
import React from 'react'

import { ActivitySelect } from '@/components/attendance/ActivitySelect'
import { ClassroomSelect } from '@/components/attendance/ClassroomSelect'
import { ThaiDatePicker } from '@/components/attendance/ThaiDatePicker'
import type { RollCallActivity } from '@/lib/attendance/rollCall'
import type { ActivityFilter } from '@/lib/reports/aggregate'
import type { DateRange, QuickRange } from '@/lib/reports/dateRange'

import { activityLinkParams, activityParam } from './loadReportContext'
import type { ReportClassroom } from '@/lib/reports/queries'

/** How many years back the พ.ศ. dropdown reaches, for history reports. */
const YEARS_BACK = 5

const quickClass = 'rounded-full border border-brand-gold px-3 py-1 text-sm font-medium no-underline'

/**
 * The GET filter form shared by the report pages: classroom, optional extra fields
 * (the student choice), the activity filter, a from/to date range, and quick-range
 * links that keep the current classroom, activity (and `linkParams`) and swap only
 * the range.
 */
export function ReportFilters(props: {
  activities: RollCallActivity[]
  activity: ActivityFilter
  classroomId: number
  classrooms: ReportClassroom[]
  extra?: React.ReactNode
  linkParams?: Record<string, string>
  path: string
  quick: QuickRange[]
  range: DateRange
  /** false for the homeroom-only pages (stats, charts). */
  showActivity?: boolean
  today: string
}) {
  const { activities, activity, classroomId, classrooms, linkParams = {}, path, quick, range, showActivity = true, today } =
    props
  const minYear = Number(today.slice(0, 4)) - YEARS_BACK

  return (
    <div className="mb-4 rounded-xl bg-surface p-3 shadow-card print:hidden">
      <form className="flex flex-wrap items-end gap-3" method="get">
        <ClassroomSelect classrooms={classrooms} selectedId={classroomId} />
        {props.extra}
        {showActivity && <ActivitySelect activities={activities} includeAll selected={activityParam(activity)} />}
        <fieldset>
          <legend className="font-semibold">ตั้งแต่</legend>
          <ThaiDatePicker key={range.from} minYear={minYear} name="from" today={today} value={range.from} />
        </fieldset>
        <fieldset>
          <legend className="font-semibold">ถึง</legend>
          <ThaiDatePicker key={range.to} minYear={minYear} name="to" today={today} value={range.to} />
        </fieldset>
        <button
          className="min-h-11 cursor-pointer rounded-lg border border-brand-gold bg-surface px-4 font-semibold text-brand-red-dark hover:bg-gold-pale"
          type="submit"
        >
          แสดงรายงาน
        </button>
      </form>
      <nav aria-label="ช่วงวันที่ด่วน" className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">ช่วงด่วน:</span>
        {quick.map((q) => {
          const active = q.from === range.from && q.to === range.to
          const query = new URLSearchParams({
            classroom: String(classroomId),
            ...activityLinkParams(activity),
            ...linkParams,
            from: q.from,
            to: q.to,
          })
          return (
            <Link
              aria-current={active ? 'true' : undefined}
              className={`${quickClass} ${active ? 'bg-brand-red text-on-dark' : 'bg-surface text-brand-red-dark hover:bg-gold-pale'}`}
              href={`${path}?${query}`}
              key={q.key}
            >
              {q.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
