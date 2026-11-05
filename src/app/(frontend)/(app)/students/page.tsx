/**
 * Student search → profile. Reads as the signed-in user, so an advisor only ever
 * finds students in their own classrooms. Matches name or studentId only (never a
 * restricted field), at most 50 results.
 */
import config from '@payload-config'
import Link from 'next/link'
import { createLocalReq, getPayload } from 'payload'
import React from 'react'

import { ReportHeading, tableClass, tdClass, thClass } from '@/components/reports/ReportParts'
import { requireUser } from '@/lib/auth/currentUser'
import type { Classroom } from '@/payload-types'

export const metadata = { title: 'ค้นหานักเรียน | ระบบครูที่ปรึกษา' }

const LIMIT = 50

export default async function Page(props: { searchParams: Promise<{ q?: string | string[] }> }) {
  const user = await requireUser()
  const { q: raw } = await props.searchParams
  const q = (typeof raw === 'string' ? raw : '').trim().slice(0, 100)

  const payload = await getPayload({ config })
  const req = await createLocalReq({ user }, payload)
  const result = q
    ? await payload.find({
        collection: 'students',
        where: {
          or: [{ firstName: { like: q } }, { lastName: { like: q } }, { studentId: { like: q } }],
        },
        select: { classNumber: true, classroom: true, firstName: true, lastName: true, prefix: true, studentId: true },
        sort: ['studentId'],
        depth: 1,
        limit: LIMIT,
        overrideAccess: false,
        req,
      })
    : null

  return (
    <div className="mt-6">
      <ReportHeading title="ค้นหานักเรียน" />
      <form action="/students" className="mb-4 flex flex-wrap gap-2" role="search">
        <label className="sr-only" htmlFor="q">
          ชื่อ นามสกุล หรือเลขประจำตัว
        </label>
        <input
          className="min-h-11 w-full max-w-sm rounded-lg border border-line bg-surface px-3"
          defaultValue={q}
          id="q"
          name="q"
          placeholder="ชื่อ นามสกุล หรือเลขประจำตัว"
          type="search"
        />
        <button className="min-h-11 rounded-lg bg-brand-red px-4 font-semibold text-on-dark" type="submit">
          ค้นหา
        </button>
      </form>

      {result &&
        (result.docs.length === 0 ? (
          <p className="text-muted">ไม่พบนักเรียน</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>เลขประจำตัว</th>
                  <th className={thClass}>ชื่อ - นามสกุล</th>
                  <th className={thClass}>ห้อง</th>
                  <th className={thClass}>เลขที่</th>
                </tr>
              </thead>
              <tbody>
                {result.docs.map((s) => (
                  <tr key={s.id}>
                    <td className={tdClass}>{s.studentId}</td>
                    <td className={tdClass}>
                      <Link className="text-brand-red-dark" href={`/students/${s.id}`}>
                        {`${s.prefix ?? ''}${s.firstName} ${s.lastName}`.trim()}
                      </Link>
                    </td>
                    <td className={tdClass}>{typeof s.classroom === 'object' ? (s.classroom as Classroom).name : '—'}</td>
                    <td className={tdClass}>{s.classNumber ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.totalDocs > LIMIT && (
              <p className="mt-2 text-sm text-muted">แสดง {LIMIT} รายการแรกจาก {result.totalDocs} — โปรดระบุคำค้นให้ละเอียดขึ้น</p>
            )}
          </div>
        ))}
    </div>
  )
}
