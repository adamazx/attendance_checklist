import type { AttendanceRecord } from '../../payload-types'

export type AttendanceStatus = AttendanceRecord['status']

/** Roll-call statuses in display order. Labels match the AttendanceRecord collection. */
export const ATTENDANCE_STATUSES: ReadonlyArray<{
  badgeClass: string
  checkedClass: string
  /** The same color as a CSS value, for SVG fills (charts). */
  color: string
  label: string
  value: AttendanceStatus
}> = [
  {
    value: 'present',
    color: 'var(--action-green)',
    label: 'มา',
    badgeClass: 'bg-action-green text-on-dark',
    checkedClass: 'peer-checked:bg-action-green peer-checked:text-on-dark',
  },
  {
    value: 'late',
    color: 'var(--action-amber)',
    label: 'สาย',
    badgeClass: 'bg-action-amber text-on-amber',
    checkedClass: 'peer-checked:bg-action-amber peer-checked:text-on-amber',
  },
  {
    value: 'leave',
    color: 'var(--action-blue)',
    label: 'ลา',
    badgeClass: 'bg-action-blue text-on-dark',
    checkedClass: 'peer-checked:bg-action-blue peer-checked:text-on-dark',
  },
  {
    value: 'absent',
    color: 'var(--action-danger)',
    label: 'ขาด',
    badgeClass: 'bg-action-danger text-on-dark',
    checkedClass: 'peer-checked:bg-action-danger peer-checked:text-on-dark',
  },
  {
    value: 'resigned',
    color: 'var(--action-neutral)',
    label: 'ลาออก',
    badgeClass: 'bg-action-neutral text-on-dark',
    checkedClass: 'peer-checked:bg-action-neutral peer-checked:text-on-dark',
  },
]

export const statusInfo = (value: AttendanceStatus) =>
  ATTENDANCE_STATUSES.find((s) => s.value === value) as (typeof ATTENDANCE_STATUSES)[number]

export const isAttendanceStatus = (value: unknown): value is AttendanceStatus =>
  ATTENDANCE_STATUSES.some((s) => s.value === value)
