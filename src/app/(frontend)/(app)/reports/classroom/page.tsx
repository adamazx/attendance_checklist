import Link from 'next/link'
import React from 'react'

import { ExportButtons } from '@/components/reports/ExportButtons'
import { activityLinkParams, loadReportContext, type ReportSearchParams } from '@/components/reports/loadReportContext'
import { ReportFilters } from '@/components/reports/ReportFilters'
import { loadClassroomView } from '@/components/reports/reportViews'
import {
  DepartedTag,
  EmptyState,
  NoClassrooms,
  RangeNotices,
  ReportHeading,
  activityFilterLabel,
  formatRange,
  numClass,
  rateFootnote,
  tableClass,
  tdClass,
  thClass,
  totalLabel,
} from '@/components/reports/ReportParts'
import { ATTENDANCE_STATUSES } from '@/lib/attendance/statuses'
import { formatRate } from '@/lib/reports/aggregate'

export const metadata = { title: 'รายงานรายห้อง | ระบบครูที่ปรึกษา' }

const TITLE = 'รายงานรายห้อง'

export default async function Page(props: { searchParams: ReportSearchParams }) {
  const ctx = await loadReportContext(props.searchParams)
  const { activities, activity, activityName, classroom, classrooms, quick, range, today } = ctx
  if (!classroom) {
    return (
      <div className="mt-6">
        <ReportHeading title={TITLE} />
        <NoClassrooms />
      </div>
    )
  }

  const { recordCount, rows, totalRate, totals } = await loadClassroomView({ ...ctx, classroom })
  const studentLink = (studentId: number) =>
    `/reports/student?${new URLSearchParams({ classroom: String(classroom.id), ...activityLinkParams(activity), from: range.from, student: String(studentId), to: range.to })}`

  return (
    <div className="mt-6">
      <ReportHeading title={TITLE}>
        <span className="font-semibold">ห้อง {classroom.name}</span> · {activityFilterLabel(activity, activityName)} ·{' '}
        {formatRange(range)}
      </ReportHeading>
      <ReportFilters
        activities={activities}
        activity={activity}
        classroomId={classroom.id}
        classrooms={classrooms}
        path="/reports/classroom"
        quick={quick}
        range={range}
        today={today}
      />
      <RangeNotices notices={range.notices} />

      {recordCount === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto">
          <div className="mb-3">
            <ExportButtons activity={activity} classroomId={classroom.id} range={range} report="classroom" />
          </div>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>เลขที่</th>
                <th className={thClass}>รหัส</th>
                <th className={thClass}>ชื่อ - นามสกุล</th>
                {ATTENDANCE_STATUSES.map((s) => (
                  <th className={`${thClass} ${numClass}`} key={s.value}>
                    {s.label}
                  </th>
                ))}
                <th className={`${thClass} ${numClass}`}>{totalLabel(activity)}</th>
                <th className={`${thClass} ${numClass}`}>%มา</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.student.id}>
                  <td className={tdClass}>{row.student.classNumber ?? '—'}</td>
                  <td className={tdClass}>{row.student.studentCode}</td>
                  <td className={tdClass}>
                    <Link className="text-brand-red-dark" href={studentLink(row.student.id)}>
                      {row.student.name}
                    </Link>
                    {row.student.departed && <DepartedTag />}
                    <Link
                      aria-label={`ประวัตินักเรียน ${row.student.name}`}
                      className="ml-2 text-xs text-muted print:hidden"
                      href={`/students/${row.student.id}`}
                    >
                      ประวัติ
                    </Link>
                  </td>
                  {ATTENDANCE_STATUSES.map((s) => (
                    <td className={`${tdClass} ${numClass}`} key={s.value}>
                      {row.counts[s.value]}
                    </td>
                  ))}
                  <td className={`${tdClass} ${numClass} font-semibold`}>{row.total}</td>
                  <td className={`${tdClass} ${numClass} font-semibold`}>{formatRate(row.rate)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gold-pale font-semibold">
                <td className={tdClass} colSpan={3}>
                  รวมทั้งห้อง ({rows.length} คน)
                </td>
                {ATTENDANCE_STATUSES.map((s) => (
                  <td className={`${tdClass} ${numClass}`} key={s.value}>
                    {totals[s.value]}
                  </td>
                ))}
                <td className={`${tdClass} ${numClass}`}>{recordCount}</td>
                <td className={`${tdClass} ${numClass}`}>{formatRate(totalRate)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-2 text-xs text-muted">{rateFootnote(activity)}</p>
        </div>
      )}
    </div>
  )
}
