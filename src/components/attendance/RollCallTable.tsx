'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'

import type { RollCallRow } from '@/lib/attendance/rollCall'
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '@/lib/attendance/statuses'

type Row = Pick<RollCallRow, 'note' | 'status'>
type Message = { expired?: boolean; ok: boolean; text: string }

const toolClass =
  'min-h-11 cursor-pointer rounded-lg border border-brand-gold bg-surface px-4 font-semibold text-brand-red-dark hover:bg-gold-pale'

const snapshot = (rows: RollCallRow[]): Record<number, Row> =>
  Object.fromEntries(rows.map((r) => [r.studentId, { note: r.note, status: r.status }]))

export function RollCallTable(props: { classroomId: number; date: string; rows: RollCallRow[] }) {
  const { classroomId, date, rows } = props
  const router = useRouter()
  const [values, setValues] = useState(() => snapshot(rows))
  const [saved, setSaved] = useState(values)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  const missing = rows.filter((r) => !values[r.studentId]?.status).length
  const dirty = useMemo(
    () =>
      rows.some(
        (r) =>
          values[r.studentId]?.status !== saved[r.studentId]?.status ||
          values[r.studentId]?.note !== saved[r.studentId]?.note,
      ),
    [rows, saved, values],
  )

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const patch = (studentId: number, change: Partial<Row>) => {
    setMessage(null)
    setValues((v) => ({ ...v, [studentId]: { ...(v[studentId] as Row), ...change } }))
  }

  const setAll = (status: AttendanceStatus | null) => {
    setMessage(null)
    setValues((v) =>
      Object.fromEntries(Object.entries(v).map(([id, row]) => [id, { ...row, status }])),
    )
  }

  const save = async () => {
    setPending(true)
    setMessage(null)
    try {
      const res = await fetch('/api/attendance/save', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomId,
          date,
          entries: rows.map((r) => ({
            note: values[r.studentId]?.note ?? '',
            status: values[r.studentId]?.status,
            studentId: r.studentId,
          })),
        }),
      })
      const data = (await res.json()) as {
        created?: number
        error?: string
        unchanged?: number
        updated?: number
      }
      if (res.ok) {
        const changed = (data.created ?? 0) + (data.updated ?? 0)
        setMessage({
          ok: true,
          text: changed
            ? `บันทึกแล้ว: เพิ่ม ${data.created} คน แก้ไข ${data.updated} คน`
            : 'ไม่มีการเปลี่ยนแปลง',
        })
        setSaved(values)
        router.refresh()
      } else {
        setMessage({
          expired: res.status === 401,
          ok: false,
          text: data.error ?? 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
        })
      }
    } catch {
      setMessage({ ok: false, text: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ข้อมูลยังอยู่ในหน้านี้ กรุณาลองใหม่อีกครั้ง' })
    }
    setPending(false)
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <button className={toolClass} onClick={() => setAll('present')} type="button">
          เลือกทั้งหมด: มา
        </button>
        <button className={toolClass} onClick={() => setAll(null)} type="button">
          ล้างทั้งหมด
        </button>
      </div>

      <ul className="overflow-hidden rounded-xl border-t-3 border-brand-gold bg-surface shadow-card">
        {rows.map((row) => {
          const value = values[row.studentId]
          return (
            <li className="border-b border-line px-3 py-3 last:border-b-0" key={row.studentId}>
              <fieldset className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <legend className="contents">
                  <span className="font-medium">
                    {row.classNumber != null && <span className="text-muted">{row.classNumber}. </span>}
                    {row.name}
                    <span className="ml-2 text-sm font-normal text-muted">{row.studentCode}</span>
                  </span>
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {ATTENDANCE_STATUSES.map((s) => (
                    <label className="status-option cursor-pointer" key={s.value}>
                      <input
                        checked={value?.status === s.value}
                        className="peer sr-only"
                        name={`status-${row.studentId}`}
                        onChange={() => patch(row.studentId, { status: s.value })}
                        type="radio"
                      />
                      <span
                        className={`flex min-h-11 min-w-12 items-center justify-center rounded-lg border border-line px-2.5 font-semibold text-muted ${s.checkedClass}`}
                      >
                        {s.label}
                      </span>
                    </label>
                  ))}
                </div>
                <input
                  aria-label={`หมายเหตุของ ${row.name}`}
                  className="min-h-10 w-full rounded-lg border border-line px-3 text-sm md:col-span-2"
                  maxLength={500}
                  onChange={(e) => patch(row.studentId, { note: e.target.value })}
                  placeholder="หมายเหตุ (ถ้ามี)"
                  type="text"
                  value={value?.note ?? ''}
                />
              </fieldset>
            </li>
          )
        })}
      </ul>

      <div className="sticky bottom-0 z-10 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-t-xl border-t-2 border-brand-gold bg-surface px-3 py-3 shadow-card">
        <div aria-live="polite" className="text-sm">
          {message ? (
            <span className={message.ok ? 'font-semibold text-action-green' : 'font-semibold text-brand-red-dark'}>
              {message.text}
              {message.expired && (
                <>
                  {' '}
                  <Link href="/login" target="_blank">
                    เข้าสู่ระบบ
                  </Link>
                </>
              )}
            </span>
          ) : missing > 0 ? (
            <span className="text-muted">ยังไม่ได้เลือก {missing} คน</span>
          ) : (
            <span className="text-muted">เลือกครบ {rows.length} คน</span>
          )}
        </div>
        <button
          className="min-h-11 cursor-pointer rounded-lg border border-brand-gold bg-brand-red px-6 font-semibold text-on-dark hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending || missing > 0}
          onClick={save}
          type="button"
        >
          {pending ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
      </div>
    </>
  )
}
