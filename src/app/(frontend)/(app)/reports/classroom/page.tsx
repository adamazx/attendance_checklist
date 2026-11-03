import Link from 'next/link'
import React from 'react'

import { activityLinkParams, loadReportContext, type ReportSearchParams } from '@/components/reports/loadReportContext'
import { ReportFilters } from '@/components/reports/ReportFilters'
import {
  DepartedTag,
  EmptyState,
  NoClassrooms,
  RangeNotices,
  ReportHeading,
  activityFilterLabel,
  formatRange,
  numClass,
  tableClass,
  tdClass,
  thClass,
  totalLabel,
} from '@/components/reports/ReportParts'
import { ATTENDANCE_STATUSES } from '@/lib/attendance/statuses'
import { countStatuses, filterByActivity, formatRate, presentRate, summarizeByStudent } from '@/lib/reports/aggregate'
import { loadRangeRecords, loadReportStudents } from '@/lib/reports/queries'

export const metadata = { title: 'รายงานรายห้อง | ระบบครูที่ปรึกษา' }

const TITLE = 'รายงานรายห้อง'

export default async function Page(props: { searchParams: ReportSearchParams }) {
  const { activities, activity, activityName, classroom, classrooms, quick, range, req, today } =
    await loadReportContext(props.searchParams)
  if (!classroom) {
    return (
      <div className="mt-6">
        <ReportHeading title={TITLE} />
        <NoClassrooms />
      </div>
    )
  }

  const allRecords = await loadRangeRecords(req, { classroomId: classroom.id, from: range.from, to: range.to })
  const students = await loadReportStudents(
    req,
    classroom.id,
    allRecords.map((r) => r.studentId),
  )
  const records = filterByActivity(allRecords, activity)
  const rows = summarizeByStudent(allRecords, students, activity)
  const totals = countStatuses(records)
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

      {records.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto">
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
                <td className={`${tdClass} ${numClass}`}>{records.length}</td>
                <td className={`${tdClass} ${numClass}`}>{formatRate(presentRate(totals))}</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-2 text-xs text-muted">
            {activity === 'all'
              ? '%มา = จำนวนครั้งที่ “มา” ÷ จำนวนครั้งที่มีการบันทึก (รวมโฮมรูมและทุกวิชา/กิจกรรม)'
              : '%มา = จำนวนวันที่ “มา” ÷ จำนวนวันที่มีการบันทึกในช่วงวันที่เลือก (วันที่ไม่มีการบันทึกไม่นับ)'}
          </p>
        </div>
      )}
    </div>
  )
}
