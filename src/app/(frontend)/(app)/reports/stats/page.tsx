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
  rateFootnote,
} from '@/components/reports/ReportParts'
import { ATTENDANCE_STATUSES } from '@/lib/attendance/statuses'
import { formatRate } from '@/lib/reports/aggregate'

export const metadata = { title: 'สถิตินักเรียน | ระบบครูที่ปรึกษา' }

const TITLE = 'สถิตินักเรียน'

const cardClass = 'rounded-xl border-t-3 border-brand-gold bg-surface p-4 text-center shadow-card print:shadow-none'
const linkClass = 'rounded-full border border-brand-gold px-3 py-1 text-sm font-medium text-brand-red-dark no-underline hover:bg-gold-pale'

function Stat(props: { className?: string; label: string; value: React.ReactNode }) {
  return (
    <div className={`${cardClass} ${props.className ?? ''}`}>
      <div className="text-sm">{props.label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{props.value}</div>
    </div>
  )
}

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
        path="/reports/stats"
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
          <section aria-label="ภาพรวม" className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
            <Stat className="text-brand-red" label="%มา" value={formatRate(stats.rate)} />
            <Stat label="จำนวนนักเรียน (คน)" value={stats.studentCount} />
            <Stat label="รวมวันที่บันทึก" value={stats.total} />
          </section>
          <section aria-label="จำนวนแต่ละสถานะ" className="mt-3 grid grid-cols-2 gap-3 min-[820px]:grid-cols-5">
            {ATTENDANCE_STATUSES.map((s) => (
              <div className={`rounded-xl p-4 text-center shadow-card print:border print:border-line ${s.badgeClass}`} key={s.value}>
                <div className="text-sm font-semibold">{s.label}</div>
                <div className="mt-1 text-3xl font-bold tabular-nums">{stats.counts[s.value]}</div>
              </div>
            ))}
          </section>
          <p className="mt-2 text-xs text-muted">{rateFootnote('homeroom')}</p>
        </>
      )}

      <nav aria-label="ดูเพิ่มเติม" className="mt-4 flex flex-wrap gap-2 print:hidden">
        <Link className={linkClass} href={`/reports/classroom?${query}`}>
          ดูรายงานรายห้อง
        </Link>
        <Link className={linkClass} href={`/reports/charts?${query}`}>
          ดูกราฟ
        </Link>
      </nav>
    </div>
  )
}
