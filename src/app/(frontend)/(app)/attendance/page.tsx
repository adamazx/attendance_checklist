import React from 'react'

import { AttendancePage, type AttendanceSearchParams } from '@/components/attendance/AttendancePage'

export const metadata = { title: 'เช็คชื่อ | ระบบครูที่ปรึกษา' }

export default function Page(props: { searchParams: AttendanceSearchParams }) {
  return <AttendancePage mode="today" searchParams={props.searchParams} />
}
