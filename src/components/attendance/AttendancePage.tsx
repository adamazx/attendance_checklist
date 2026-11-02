import config from '@payload-config'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createLocalReq, getPayload } from 'payload'
import React from 'react'

import { isDiscipline } from '@/access'
import { requireUser } from '@/lib/auth/currentUser'
import { isDayInTerm, listRollCallClassrooms, loadRollCallRows } from '@/lib/attendance/rollCall'
import { formatThaiDayLong, isRealThaiDay, shiftThaiDay, todayThai } from '@/lib/date/thaiDay'

import { ClassroomSelect } from './ClassroomSelect'
import { RollCallTable } from './RollCallTable'
import { ThaiDatePicker } from './ThaiDatePicker'

export type AttendanceMode = 'today' | 'backdate' | 'edit'

export type AttendanceSearchParams = Promise<{ classroom?: string | string[]; date?: string | string[] }>

const titles: Record<AttendanceMode, string> = {
  backdate: 'เช็คชื่อย้อนหลัง',
  edit: 'แก้ไขเช็คชื่อ',
  today: 'เช็คชื่อ',
}

const Notice = (props: { children: React.ReactNode }) => (
  <p className="mb-3 rounded-lg border border-brand-gold bg-gold-pale px-3 py-2 text-sm">{props.children}</p>
)

/** Resolve the day for a mode, returning null when the requested day is not allowed. */
const resolveDate = (mode: AttendanceMode, requested: string | undefined, today: string) => {
  const fallback = mode === 'backdate' ? shiftThaiDay(today, -1) : today
  if (mode === 'today' || requested === undefined) return { date: fallback, rejected: false }
  const allowed = isRealThaiDay(requested) && (mode === 'backdate' ? requested < today : requested <= today)
  return allowed ? { date: requested, rejected: false } : { date: fallback, rejected: true }
}

export async function AttendancePage(props: { mode: AttendanceMode; searchParams: AttendanceSearchParams }) {
  const { mode } = props
  const user = await requireUser()
  if (isDiscipline(user)) redirect('/')

  const params = await props.searchParams
  const payload = await getPayload({ config })
  const req = await createLocalReq({ user }, payload)
  const classrooms = await listRollCallClassrooms(req)

  const heading = (
    <>
      <Link className="text-brand-red-dark" href="/">
        ← กลับหน้าหลัก
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-brand-red">{titles[mode]}</h1>
    </>
  )

  if (classrooms.length === 0) {
    return (
      <div className="mt-6">
        {heading}
        <p className="mt-4">ยังไม่มีห้องเรียนที่ได้รับมอบหมายในปีการศึกษาปัจจุบัน กรุณาติดต่อผู้ดูแลระบบ</p>
      </div>
    )
  }

  const classroom =
    classrooms.find((c) => String(c.id) === params.classroom) ?? (classrooms[0] as (typeof classrooms)[number])
  const today = todayThai()
  const requested = typeof params.date === 'string' ? params.date : undefined
  const { date, rejected } = resolveDate(mode, requested, today)

  const rows = await loadRollCallRows(req, {
    classroomId: classroom.id,
    date,
    savedOnly: mode === 'edit',
  })
  const hasSaved = rows.some((r) => r.status !== null)
  const inTerm = await isDayInTerm(req, classroom.academicYearId, date)
  const showFilters = mode !== 'today' || classrooms.length > 1

  return (
    <div className="mt-6">
      {heading}
      <p className="mt-1 mb-4">
        <span className="font-semibold">ห้อง {classroom.name}</span> · {formatThaiDayLong(date)}
      </p>

      {showFilters && (
        <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl bg-surface p-3 shadow-card" method="get">
          <ClassroomSelect classrooms={classrooms} selectedId={classroom.id} />
          {mode !== 'today' && <ThaiDatePicker key={date} name="date" today={today} value={date} />}
          <button
            className="min-h-11 cursor-pointer rounded-lg border border-brand-gold bg-surface px-4 font-semibold text-brand-red-dark hover:bg-gold-pale"
            type="submit"
          >
            แสดงรายชื่อ
          </button>
        </form>
      )}

      {rejected && (
        <Notice>
          {mode === 'backdate'
            ? 'เลือกได้เฉพาะวันก่อนวันนี้ ระบบจึงแสดงเมื่อวานแทน'
            : 'เลือกวันในอนาคตไม่ได้ ระบบจึงแสดงวันนี้แทน'}
        </Notice>
      )}
      {!inTerm && <Notice>ไม่พบภาคเรียนที่ครอบคลุมวันที่เลือก บันทึกได้ แต่จะไม่ถูกผูกกับภาคเรียน</Notice>}
      {hasSaved && mode !== 'edit' && <Notice>มีข้อมูลบันทึกไว้แล้ว การบันทึกจะแก้ไขข้อมูลเดิม</Notice>}

      {rows.length > 0 ? (
        <RollCallTable classroomId={classroom.id} date={date} key={`${classroom.id}-${date}`} rows={rows} />
      ) : mode === 'edit' ? (
        <p>
          ยังไม่มีข้อมูลเช็คชื่อของวันที่เลือก{' '}
          <Link className="text-brand-red-dark" href="/attendance/backdate">
            ไปเช็คชื่อย้อนหลัง
          </Link>
        </p>
      ) : (
        <p>ไม่พบนักเรียนในห้องนี้</p>
      )}
    </div>
  )
}
