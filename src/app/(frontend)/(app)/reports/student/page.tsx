import Link from 'next/link'
import React from 'react'

import { ExportButtons } from '@/components/reports/ExportButtons'
import { loadReportContext, type ReportSearchParams } from '@/components/reports/loadReportContext'
import { PrintButton } from '@/components/reports/PrintButton'
import { ReportFilters } from '@/components/reports/ReportFilters'
import { loadStudentView } from '@/components/reports/reportViews'
import { HistoryTable, StatusSummary } from '@/components/reports/StudentHistory'
import {
  DepartedTag,
  EmptyState,
  NoClassrooms,
  RangeNotices,
  ReportHeading,
  activityFilterLabel,
  formatRange,
} from '@/components/reports/ReportParts'
import { SCHOOL_FULL_NAME } from '@/lib/school'

export const metadata = { title: 'รายงานนักเรียน | ระบบครูที่ปรึกษา' }

const TITLE = 'รายงานนักเรียน'

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

  const view = await loadStudentView({ ...ctx, classroom })
  const { records, student, students } = view
  const classroomName = new Map(classrooms.map((c) => [c.id, c.name]))

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
      <p className="hidden text-center text-sm print:block">{SCHOOL_FULL_NAME}</p>
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
              <div className="flex flex-wrap gap-2">
                {records.length > 0 && (
                  <ExportButtons
                    activity={activity}
                    classroomId={classroom.id}
                    range={range}
                    report="student"
                    studentId={student.id}
                  />
                )}
                <Link className="inline-flex min-h-10 items-center rounded-lg border border-brand-gold px-3 font-semibold text-brand-red-dark no-underline print:hidden" href={`/students/${student.id}`}>
                  ประวัตินักเรียน
                </Link>
                <PrintButton />
              </div>
            </div>
            <StatusSummary activity={activity} view={view} />
          </section>

          <HistoryTable activity={activity} activityName={activityName} classroomName={classroomName} view={view} />
        </>
      )}
    </div>
  )
}
