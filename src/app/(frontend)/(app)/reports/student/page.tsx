import React from 'react'

import { loadReportContext, one, type ReportSearchParams } from '@/components/reports/loadReportContext'
import { PrintButton } from '@/components/reports/PrintButton'
import { ReportFilters } from '@/components/reports/ReportFilters'
import {
  DepartedTag,
  EmptyState,
  NoClassrooms,
  RangeNotices,
  ReportHeading,
  StatusBadge,
  activityFilterLabel,
  formatRange,
  recordActivityName,
  tableClass,
  tdClass,
  thClass,
} from '@/components/reports/ReportParts'
import { ATTENDANCE_STATUSES } from '@/lib/attendance/statuses'
import { formatThaiDayLong } from '@/lib/date/thaiDay'
import { compareStudents, countStatuses, filterByActivity, formatRate, presentRate } from '@/lib/reports/aggregate'
import { loadRangeRecords, loadReportStudents } from '@/lib/reports/queries'

export const metadata = { title: 'รายงานนักเรียน | ระบบครูที่ปรึกษา' }

const TITLE = 'รายงานนักเรียน'

export default async function Page(props: { searchParams: ReportSearchParams }) {
  const { activities, activity, activityName, classroom, classrooms, params, quick, range, req, today } =
    await loadReportContext(props.searchParams)
  if (!classroom) {
    return (
      <div className="mt-6">
        <ReportHeading title={TITLE} />
        <NoClassrooms />
      </div>
    )
  }

  // The choosable students: the classroom's own, plus anyone recorded here in range
  // who has since left. A `student` param outside that list falls back to the first.
  const classroomRecords = await loadRangeRecords(req, { classroomId: classroom.id, from: range.from, to: range.to })
  const students = (
    await loadReportStudents(
      req,
      classroom.id,
      classroomRecords.map((r) => r.studentId),
    )
  ).sort(compareStudents)
  const student = students.find((s) => String(s.id) === one(params.student)) ?? students[0] ?? null

  // Access still applies: an advisor sees only this student's records under a
  // classroom they advise, so earlier/later rooms outside their scope stay hidden.
  const records = filterByActivity(
    student ? await loadRangeRecords(req, { from: range.from, studentId: student.id, to: range.to }) : [],
    activity,
  )
  const counts = countStatuses(records)
  const classroomName = new Map(classrooms.map((c) => [c.id, c.name]))
  const multiRoom = new Set(records.map((r) => r.classroomId)).size > 1

  const studentSelect = (
    <label className="block font-medium">
      นักเรียน
      <select
        className="mt-1 block min-h-11 w-full max-w-xs rounded-lg border border-line bg-surface px-3"
        defaultValue={student?.id}
        key={`${classroom.id}-${student?.id}`}
        name="student"
      >
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.classNumber != null ? `${s.classNumber}. ` : ''}
            {s.name}
            {s.departed ? ' (ย้าย/ออก)' : ''}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="mt-6">
      <p className="hidden text-center text-sm print:block">โรงเรียนโนนหันวิทยายน องค์การบริหารส่วนจังหวัดขอนแก่น</p>
      <ReportHeading title={TITLE} />
      <ReportFilters
        activities={activities}
        activity={activity}
        classroomId={classroom.id}
        classrooms={classrooms}
        extra={students.length > 0 ? studentSelect : null}
        linkParams={student ? { student: String(student.id) } : {}}
        path="/reports/student"
        quick={quick}
        range={range}
        today={today}
      />
      <RangeNotices notices={range.notices} />

      {!student ? (
        <EmptyState>ไม่พบนักเรียนในห้องนี้</EmptyState>
      ) : (
        <>
          <section className="mb-4 rounded-xl border-t-3 border-brand-gold bg-surface p-4 shadow-card print:shadow-none">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-muted">ชื่อ - นามสกุล</dt>
                <dd className="font-semibold">
                  {student.name}
                  {student.departed && <DepartedTag />}
                </dd>
                <dt className="text-muted">เลขประจำตัว</dt>
                <dd>{student.studentCode}</dd>
                <dt className="text-muted">ห้อง</dt>
                <dd>
                  {classroom.name}
                  {student.classNumber != null && ` เลขที่ ${student.classNumber}`}
                </dd>
                <dt className="text-muted">วิชา/กิจกรรม</dt>
                <dd>{activityFilterLabel(activity, activityName)}</dd>
                <dt className="text-muted">ช่วงวันที่</dt>
                <dd>{formatRange(range)}</dd>
              </dl>
              <PrintButton />
            </div>
            <ul aria-label="สรุปสถานะ" className="mt-4 flex flex-wrap gap-2">
              {ATTENDANCE_STATUSES.map((s) => (
                <li className={`rounded-lg px-3 py-1.5 font-semibold print:border print:border-line ${s.badgeClass}`} key={s.value}>
                  {s.label} {counts[s.value]}
                </li>
              ))}
              <li className="rounded-lg border border-brand-gold bg-gold-pale px-3 py-1.5 font-semibold">
                รวม {records.length} {activity === 'all' ? 'ครั้ง' : 'วัน'} · มา {formatRate(presentRate(counts))}
              </li>
            </ul>
          </section>

          {records.length === 0 ? (
            <EmptyState />
          ) : (
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
                      {multiRoom && (
                        <td className={tdClass}>{(r.classroomId && classroomName.get(r.classroomId)) ?? '—'}</td>
                      )}
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
          )}
        </>
      )}
    </div>
  )
}
