/**
 * One student's attendance history: the status summary and the record table.
 * Shared by the student report (/reports/student) and the student profile page,
 * both fed by `loadStudentView`, so the two can never disagree.
 */
import React from 'react'

import { ATTENDANCE_STATUSES } from '@/lib/attendance/statuses'
import { formatThaiDayLong } from '@/lib/date/thaiDay'
import { formatRate, type ActivityFilter } from '@/lib/reports/aggregate'
import type { StudentView } from '@/lib/reports/views'

import { EmptyState, StatusBadge, recordActivityName, tableClass, tdClass, thClass } from './ReportParts'

export function StatusSummary(props: { activity: ActivityFilter; view: StudentView }) {
  const { counts, rate, records } = props.view
  return (
    <ul aria-label="สรุปสถานะ" className="mt-4 flex flex-wrap gap-2">
      {ATTENDANCE_STATUSES.map((s) => (
        <li className={`rounded-lg px-3 py-1.5 font-semibold print:border print:border-line ${s.badgeClass}`} key={s.value}>
          {s.label} {counts[s.value]}
        </li>
      ))}
      <li className="rounded-lg border border-brand-gold bg-gold-pale px-3 py-1.5 font-semibold">
        รวม {records.length} {props.activity === 'all' ? 'ครั้ง' : 'วัน'} · มา {formatRate(rate)}
      </li>
    </ul>
  )
}

export function HistoryTable(props: {
  activity: ActivityFilter
  activityName: Map<number, string>
  classroomName: Map<number, string>
  view: StudentView
}) {
  const { activity, activityName, classroomName } = props
  const { multiRoom, records } = props.view
  if (records.length === 0) return <EmptyState />
  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={thClass}>ลำดับ</th>
            <th className={thClass}>วันที่</th>
            {multiRoom && <th className={thClass}>ห้อง</th>}
            {activity === 'all' && <th className={thClass}>วิชา/กิจกรรม</th>}
            <th className={thClass}>สถานะ</th>
            <th className={thClass}>หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={r.id}>
              <td className={tdClass}>{i + 1}</td>
              <td className={tdClass}>{formatThaiDayLong(r.date)}</td>
              {multiRoom && <td className={tdClass}>{(r.classroomId && classroomName.get(r.classroomId)) ?? '—'}</td>}
              {activity === 'all' && <td className={tdClass}>{recordActivityName(r.activityId, activityName)}</td>}
              <td className={tdClass}>
                <StatusBadge status={r.status} />
              </td>
              <td className={tdClass}>{r.note || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
