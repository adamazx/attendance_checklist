import React from 'react'

import { AttendancePage, type AttendanceSearchParams } from '@/components/attendance/AttendancePage'

export const metadata = { title: 'แก้ไขเช็คชื่อ | ระบบครูที่ปรึกษา' }

export default function Page(props: { searchParams: AttendanceSearchParams }) {
  return <AttendancePage mode="edit" searchParams={props.searchParams} />
}
