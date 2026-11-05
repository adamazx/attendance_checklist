/**
 * Student profile + attendance history (read-only).
 *
 * The student is read as the signed-in user (`overrideAccess: false`): row scope
 * makes another room's student a 404 for an advisor, and field-level PDPA access
 * decides which sections come back (see src/access/pii.ts). The history reuses
 * the student report's loader and table (`loadStudentView` + StudentHistory), for
 * the active term by default.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { loadReportContext } from '@/components/reports/loadReportContext'
import { ReportHeading, activityFilterLabel, formatRange } from '@/components/reports/ReportParts'
import { loadStudentView } from '@/components/reports/reportViews'
import { HistoryTable, StatusSummary } from '@/components/reports/StudentHistory'
import {
  Section,
  bioRows,
  cardRows,
  extrasRows,
  formatAddress,
  formatNationalId,
  parentRows,
  welfareRows,
} from '@/components/students/ProfileSections'
import type { Classroom, Student, StudentPhoto } from '@/payload-types'

export const metadata = { title: 'ประวัตินักเรียน | ระบบครูที่ปรึกษา' }

const STATUS_LABEL: Record<Student['status'], string> = {
  studying: 'กำลังศึกษา',
  transferred: 'ย้าย',
  on_leave: 'ลาพัก',
  graduated: 'จบการศึกษา',
}

type Params = Promise<{ id: string }>
type Search = Promise<{ activity?: string | string[]; from?: string | string[]; to?: string | string[] }>

export default async function Page(props: { params: Params; searchParams: Search }) {
  const { id } = await props.params
  if (!/^\d+$/.test(id)) notFound()
  const search = await props.searchParams

  // Resolve the student's classroom first (as the user), then build the report context for it.
  const base = await loadReportContext(Promise.resolve({}))
  let student: Student
  try {
    student = await base.req.payload.findByID({
      collection: 'students',
      id: Number(id),
      depth: 1,
      overrideAccess: false,
      req: base.req,
    })
  } catch {
    notFound()
  }

  const classroom = typeof student.classroom === 'object' ? (student.classroom as Classroom) : null
  const classroomId = classroom?.id ?? (student.classroom as number)
  const ctx = await loadReportContext(
    Promise.resolve({ ...search, classroom: String(classroomId), student: String(student.id) }),
    { defaultRange: 'term' },
  )
  const view =
    ctx.classroom && ctx.classroom.id === classroomId ? await loadStudentView({ ...ctx, classroom: ctx.classroom }) : null
  const history = view && view.student?.id === student.id ? view : null
  const classroomName = new Map(ctx.classrooms.map((c) => [c.id, c.name]))

  const photo = (student.photos?.docs ?? []).find((p): p is StudentPhoto => typeof p === 'object')
  const photoUrl = photo?.sizes?.thumbnail?.url ?? photo?.url ?? null
  const fullName = `${student.prefix ?? ''}${student.firstName} ${student.lastName}`.trim()
  const nationalId = student.nationalId ? formatNationalId(student.nationalId) : student.nationalIdMasked
  const household = student.household
  const reportLink = `/reports/student?${new URLSearchParams({
    classroom: String(classroomId),
    student: String(student.id),
    from: ctx.range.from,
    to: ctx.range.to,
  })}`

  return (
    <div className="mt-6">
      <ReportHeading title="ประวัตินักเรียน" />

      <section className="mb-4 flex flex-wrap items-start gap-4 rounded-xl border-t-3 border-brand-gold bg-surface p-4 shadow-card print:shadow-none">
        <div className="flex h-40 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-gold-pale">
          {photoUrl ? (
            // Served through Payload's access-checked file route; a plain <img> keeps the auth cookie.
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={`รูปของ ${fullName}`} className="h-full w-full object-cover" src={photoUrl} />
          ) : (
            <span aria-label="ไม่มีรูป" className="text-4xl text-muted" role="img">
              👤
            </span>
          )}
        </div>
        <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted">ชื่อ - นามสกุล</dt>
          <dd className="text-lg font-semibold">{fullName}</dd>
          <dt className="text-muted">เลขประจำตัว</dt>
          <dd>{student.studentId}</dd>
          <dt className="text-muted">ห้อง</dt>
          <dd>
            {classroom?.name ?? '—'}
            {student.classNumber != null && ` เลขที่ ${student.classNumber}`}
          </dd>
          <dt className="text-muted">สถานะ</dt>
          <dd>{STATUS_LABEL[student.status]}</dd>
          {nationalId && (
            <>
              <dt className="text-muted">เลขประจำตัวประชาชน</dt>
              <dd className="tabular-nums">{nationalId}</dd>
            </>
          )}
        </dl>
      </section>

      <Section rows={bioRows(student)} title="ข้อมูลส่วนตัว" />
      {(['father', 'mother', 'guardian'] as const).map((key) => (
        <Section
          key={key}
          rows={parentRows(household?.[key])}
          title={{ father: 'บิดา', mother: 'มารดา', guardian: 'ผู้ปกครอง' }[key]}
        />
      ))}
      <Section
        rows={[
          ['ตามทะเบียนบ้าน', formatAddress(student.addressRegistered)],
          ['ที่อยู่ปัจจุบัน', formatAddress(student.addressCurrent)],
        ]}
        title="ที่อยู่"
      />
      <Section rows={welfareRows(student)} title="สวัสดิการ" />
      <Section rows={cardRows(student)} title="บัตรนักเรียน" />
      <Section rows={extrasRows(student)} title="ข้อมูลเพิ่มเติม" />

      <h2 className="mt-6 mb-1 text-xl font-bold text-brand-red">ประวัติการมาเรียน</h2>
      {history ? (
        <>
          <p className="mb-2">
            {activityFilterLabel(ctx.activity, ctx.activityName)} · {formatRange(ctx.range)} ·{' '}
            <Link className="text-brand-red-dark print:hidden" href={reportLink}>
              ดูรายงานเต็ม (เลือกช่วงวันที่/ส่งออก)
            </Link>
          </p>
          <StatusSummary activity={ctx.activity} view={history} />
          <div className="mt-3">
            <HistoryTable activity={ctx.activity} activityName={ctx.activityName} classroomName={classroomName} view={history} />
          </div>
        </>
      ) : (
        <p className="text-muted">ไม่มีสิทธิ์ดูประวัติการมาเรียนของห้องนี้</p>
      )}
    </div>
  )
}
