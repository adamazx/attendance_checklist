import React from 'react'

import { ExportButtons } from '@/components/reports/ExportButtons'
import { loadReportContext, type ReportSearchParams } from '@/components/reports/loadReportContext'
import { ReportFilters } from '@/components/reports/ReportFilters'
import { loadLateView } from '@/components/reports/reportViews'
import {
  DepartedTag,
  EmptyState,
  NoClassrooms,
  RangeNotices,
  ReportHeading,
  activityFilterLabel,
  formatRange,
  numClass,
  recordActivityName,
  tableClass,
  tdClass,
  thClass,
} from '@/components/reports/ReportParts'
import { formatThaiDayLong } from '@/lib/date/thaiDay'

export const metadata = { title: 'นักเรียนมาสาย | ระบบครูที่ปรึกษา' }

const TITLE = 'นักเรียนมาสาย'

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

  const { late } = await loadLateView({ ...ctx, classroom })

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
        path="/reports/late"
        quick={quick}
        range={range}
        today={today}
      />
      <RangeNotices notices={range.notices} />

      {late.total === 0 ? (
        <EmptyState>ไม่มีนักเรียนมาสายในช่วงวันที่เลือก</EmptyState>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="inline-block rounded-lg bg-action-amber px-3 py-1.5 font-semibold text-on-amber">
              มาสายรวม {late.total} ครั้ง · {late.perStudent.length} คน
            </p>
            <ExportButtons activity={activity} classroomId={classroom.id} range={range} report="late" />
          </div>

          <h2 className="mt-2 mb-2 text-lg font-bold text-brand-red-dark">สรุปรายคน</h2>
          <div className="mb-6 overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>เลขที่</th>
                  <th className={thClass}>ชื่อ - นามสกุล</th>
                  <th className={`${thClass} ${numClass}`}>จำนวนครั้งที่สาย</th>
                </tr>
              </thead>
              <tbody>
                {late.perStudent.map(({ count, student }) => (
                  <tr key={student.id}>
                    <td className={tdClass}>{student.classNumber ?? '—'}</td>
                    <td className={tdClass}>
                      {student.name}
                      {student.departed && <DepartedTag />}
                    </td>
                    <td className={`${tdClass} ${numClass} font-semibold`}>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mb-2 text-lg font-bold text-brand-red-dark">รายการมาสาย</h2>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>วันที่</th>
                  <th className={thClass}>เลขที่</th>
                  <th className={thClass}>ชื่อ - นามสกุล</th>
                  {activity === 'all' && <th className={thClass}>วิชา/กิจกรรม</th>}
                  <th className={thClass}>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {late.rows.map(({ record, student }) => (
                  <tr key={record.id}>
                    <td className={tdClass}>{formatThaiDayLong(record.date)}</td>
                    <td className={tdClass}>{student.classNumber ?? '—'}</td>
                    <td className={tdClass}>
                      {student.name}
                      {student.departed && <DepartedTag />}
                    </td>
                    {activity === 'all' && (
                      <td className={tdClass}>{recordActivityName(record.activityId, activityName)}</td>
                    )}
                    <td className={tdClass}>{record.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
