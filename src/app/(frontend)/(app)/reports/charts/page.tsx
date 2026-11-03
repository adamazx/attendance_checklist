import Link from 'next/link'
import React from 'react'

import { loadHomeroomStats } from '@/components/reports/loadHomeroomStats'
import type { ReportSearchParams } from '@/components/reports/loadReportContext'
import { ReportFilters } from '@/components/reports/ReportFilters'
import {
  EmptyState,
  NoClassrooms,
  RangeNotices,
  ReportHeading,
  formatRange,
  numClass,
  rateFootnote,
  tableClass,
  tdClass,
  thClass,
} from '@/components/reports/ReportParts'
import { StatsCharts, type DailyRateDatum, type StatusBarDatum } from '@/components/reports/StatsCharts'
import { ATTENDANCE_STATUSES } from '@/lib/attendance/statuses'
import { formatThaiDay, formatThaiDayMonth } from '@/lib/date/thaiDay'
import { formatRate } from '@/lib/reports/aggregate'

export const metadata = { title: 'กราฟ | ระบบครูที่ปรึกษา' }

const TITLE = 'กราฟการมาเรียน'

const linkClass = 'rounded-full border border-brand-gold px-3 py-1 text-sm font-medium text-brand-red-dark no-underline hover:bg-gold-pale'

export default async function Page(props: { searchParams: ReportSearchParams }) {
  const { activities, classroom, classrooms, quick, range, stats, today } = await loadHomeroomStats(props.searchParams)
  if (!classroom || !stats) {
    return (
      <div className="mt-6">
        <ReportHeading title={TITLE} />
        <NoClassrooms />
      </div>
    )
  }

  // Only labels and numbers cross to the client island; dates are formatted (พ.ศ.) here.
  const statuses: StatusBarDatum[] = ATTENDANCE_STATUSES.map((s) => ({
    color: s.color,
    count: stats.counts[s.value],
    label: s.label,
  }))
  const daily: DailyRateDatum[] = stats.days.map((d) => ({
    fullLabel: formatThaiDay(d.date),
    label: formatThaiDayMonth(d.date),
    rate: d.rate,
    total: d.total,
  }))
  const query = new URLSearchParams({ classroom: String(classroom.id), from: range.from, to: range.to })

  return (
    <div className="mt-6">
      <ReportHeading title={TITLE}>
        <span className="font-semibold">ห้อง {classroom.name}</span> · เช็คชื่อประจำวัน · {formatRange(range)}
      </ReportHeading>
      <ReportFilters
        activities={activities}
        activity="homeroom"
        classroomId={classroom.id}
        classrooms={classrooms}
        path="/reports/charts"
        quick={quick}
        range={range}
        showActivity={false}
        today={today}
      />
      <RangeNotices notices={range.notices} />

      {stats.total === 0 ? (
        <EmptyState />
      ) : (
        <>
          <StatsCharts daily={daily} statuses={statuses} />
          <p className="mt-2 text-xs text-muted">{rateFootnote('homeroom')}</p>
          <details className="mt-3 rounded-xl bg-surface p-3 shadow-card print:hidden">
            <summary className="cursor-pointer font-semibold text-brand-red-dark">ดูข้อมูลรายวันเป็นตาราง</summary>
            <div className="mt-3 overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>วันที่</th>
                    {ATTENDANCE_STATUSES.map((s) => (
                      <th className={`${thClass} ${numClass}`} key={s.value}>
                        {s.label}
                      </th>
                    ))}
                    <th className={`${thClass} ${numClass}`}>รวม</th>
                    <th className={`${thClass} ${numClass}`}>%มา</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.days.map((d) => (
                    <tr key={d.date}>
                      <td className={tdClass}>{formatThaiDay(d.date)}</td>
                      {ATTENDANCE_STATUSES.map((s) => (
                        <td className={`${tdClass} ${numClass}`} key={s.value}>
                          {d.counts[s.value]}
                        </td>
                      ))}
                      <td className={`${tdClass} ${numClass} font-semibold`}>{d.total}</td>
                      <td className={`${tdClass} ${numClass} font-semibold`}>{formatRate(d.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}

      <nav aria-label="ดูเพิ่มเติม" className="mt-4 flex flex-wrap gap-2 print:hidden">
        <Link className={linkClass} href={`/reports/stats?${query}`}>
          ดูสถิติ
        </Link>
        <Link className={linkClass} href={`/reports/classroom?${query}`}>
          ดูรายงานรายห้อง
        </Link>
      </nav>
    </div>
  )
}
