import type { AttendanceRecord } from '../../payload-types'

export type AttendanceStatus = AttendanceRecord['status']

/** Roll-call statuses in display order. Labels match the AttendanceRecord collection. */
export const ATTENDANCE_STATUSES: ReadonlyArray<{
  checkedClass: string
  label: string
  value: AttendanceStatus
}> = [
  { value: 'present', label: 'มา', checkedClass: 'peer-checked:bg-action-green peer-checked:text-on-dark' },
  { value: 'late', label: 'สาย', checkedClass: 'peer-checked:bg-action-amber peer-checked:text-on-amber' },
  { value: 'leave', label: 'ลา', checkedClass: 'peer-checked:bg-action-blue peer-checked:text-on-dark' },
  { value: 'absent', label: 'ขาด', checkedClass: 'peer-checked:bg-action-danger peer-checked:text-on-dark' },
  { value: 'left_early', label: 'ออกก่อน', checkedClass: 'peer-checked:bg-action-neutral peer-checked:text-on-dark' },
]

export const isAttendanceStatus = (value: unknown): value is AttendanceStatus =>
  ATTENDANCE_STATUSES.some((s) => s.value === value)
