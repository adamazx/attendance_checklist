/**
 * Read-only student profile sections. Each section shows only the fields the
 * viewer's role actually received (field-level access strips the rest), and a
 * section with nothing to show is left out — so discipline sees a shorter page
 * with no "hidden" placeholders.
 */
import React from 'react'

import {
  disabilityOptions,
  genderOptions,
  maritalStatusOptions,
  nationOptions,
  optionLabel,
  programOptions,
  religionOptions,
  scoutTypeOptions,
  studentConditionOptions,
} from '@/collections/fields/studentOptions'
import { formatThaiDay, isRealThaiDay } from '@/lib/date/thaiDay'
import type { Student } from '@/payload-types'

type Row = [label: string, value: React.ReactNode]

const has = (v: unknown): boolean =>
  v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)

const day = (v: string | null | undefined): string | null =>
  v ? (isRealThaiDay(v) ? formatThaiDay(v) : v) : null

const money = (v: number | null | undefined): string | null =>
  v == null ? null : `${v.toLocaleString('th-TH')} บาท`

export function Section(props: { title: string; rows: Row[]; children?: React.ReactNode }) {
  const rows = props.rows.filter(([, v]) => has(v))
  if (rows.length === 0 && !props.children) return null
  return (
    <section className="mb-4 rounded-xl border-t-3 border-brand-gold bg-surface p-4 shadow-card print:shadow-none">
      <h2 className="mb-2 text-lg font-bold text-brand-red">{props.title}</h2>
      {rows.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr_auto_1fr]">
          {rows.map(([label, value]) => (
            <React.Fragment key={label}>
              <dt className="text-muted">{label}</dt>
              <dd className="break-words">{value}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
      {props.children}
    </section>
  )
}

export const bioRows = (s: Student): Row[] => [
  ['เพศ', optionLabel(genderOptions, s.bio?.gender)],
  ['แผนการเรียน', optionLabel(programOptions, s.bio?.program)],
  ['วันเกิด', day(s.bio?.birthDate)],
  ['วันเข้าศึกษา', day(s.bio?.enrollDate)],
  ['สัญชาติ', optionLabel(nationOptions, s.bio?.nationality)],
  ['เชื้อชาติ', optionLabel(nationOptions, s.bio?.ethnicity)],
  ['ศาสนา', optionLabel(religionOptions, s.bio?.religion)],
  ['ส่วนสูง', s.bio?.heightCm != null ? `${s.bio.heightCm} ซม.` : null],
  ['น้ำหนัก', s.bio?.weightKg != null ? `${s.bio.weightKg} กก.` : null],
]

type Parent = NonNullable<NonNullable<Student['household']>['father']>

export const parentRows = (p: Parent | null | undefined): Row[] => [
  ['ชื่อ - นามสกุล', [p?.prefix, p?.firstName].filter(Boolean).join('') + (p?.lastName ? ` ${p.lastName}` : '')],
  ['ความเกี่ยวข้อง', p?.relationship],
  ['เบอร์โทรศัพท์', p?.phone],
  ['ศาสนา', optionLabel(religionOptions, p?.religion)],
  ['อาชีพ', p?.occupation],
  ['รายได้/เดือน', money(p?.monthlyIncome)],
  ['สถานภาพ', optionLabel(maritalStatusOptions, p?.maritalStatus)],
]

type Address = NonNullable<Student['addressCurrent']>

export const formatAddress = (a: Address | null | undefined): string | null => {
  if (!a) return null
  const parts = [
    a.houseNo && `บ้านเลขที่ ${a.houseNo}`,
    a.moo && `หมู่ ${a.moo}`,
    a.road && `ถนน${a.road}`,
    a.subdistrict && `ต.${a.subdistrict}`,
    a.district && `อ.${a.district}`,
    a.province && `จ.${a.province}`,
    a.postalCode,
  ].filter(Boolean)
  return parts.length ? parts.join(' ') : null
}

export const welfareRows = (s: Student): Row[] => [
  ['สภาพนักเรียน', optionLabel(studentConditionOptions, s.welfare?.studentCondition)],
  ['สิทธิเบิกค่าเล่าเรียน', s.welfare?.tuitionRight],
  ['สิทธิเบิกค่ารักษาพยาบาล', s.welfare?.medicalRight],
]

export const cardRows = (s: Student): Row[] => [
  ['วันออกบัตร', day(s.cardDates?.issueDate)],
  ['วันหมดอายุ', day(s.cardDates?.expiryDate)],
]

export const extrasRows = (s: Student): Row[] => [
  ['ความสามารถพิเศษ', s.extras?.specialAbilities],
  ['ความพิการ', (s.extras?.disabilities ?? []).map((d) => optionLabel(disabilityOptions, d)).join(', ')],
  ['ลูกเสือ/เนตรนารี/ยุวกาชาด', optionLabel(scoutTypeOptions, s.extras?.scoutType)],
]

/** `1234567890123` → `1-2345-67890-12-3` (admin only ever has the full ID). */
export const formatNationalId = (id: string): string =>
  /^\d{13}$/.test(id) ? `${id[0]}-${id.slice(1, 5)}-${id.slice(5, 10)}-${id.slice(10, 12)}-${id[12]}` : id
