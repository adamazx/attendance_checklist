import React from 'react'

import type { ActivityFilter } from '@/lib/reports/aggregate'
import type { DateRange } from '@/lib/reports/dateRange'
import type { ExportFormat, ReportKey } from '@/lib/reports/export/registry'

import { activityLinkParams } from './loadReportContext'

const linkClass =
  'inline-flex min-h-11 items-center rounded-lg border border-brand-gold bg-surface px-4 font-semibold text-brand-red-dark no-underline hover:bg-gold-pale'

const FORMATS: { format: ExportFormat; label: string }[] = [
  { format: 'xlsx', label: 'ดาวน์โหลด Excel' },
  { format: 'pdf', label: 'ดาวน์โหลด PDF' },
]

/**
 * Download links for the report as shown: the query is built from the page's
 * *resolved* classroom, range, activity (and student), not the raw URL, so the file
 * always matches what is on screen.
 */
export function ExportButtons(props: {
  activity: ActivityFilter
  classroomId: number
  range: DateRange
  report: ReportKey
  studentId?: number
}) {
  const query = new URLSearchParams({
    classroom: String(props.classroomId),
    ...activityLinkParams(props.activity),
    from: props.range.from,
    ...(props.studentId !== undefined ? { student: String(props.studentId) } : {}),
    to: props.range.to,
  })
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {FORMATS.map(({ format, label }) => (
        <a className={linkClass} download href={`/api/reports/${props.report}/${format}?${query}`} key={format}>
          {label}
        </a>
      ))}
    </div>
  )
}
