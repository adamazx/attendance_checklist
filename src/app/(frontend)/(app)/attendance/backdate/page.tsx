import React from 'react'

import { AttendancePage, type AttendanceSearchParams } from '@/components/attendance/AttendancePage'

export const metadata = { title: 'เช็คชื่อย้อนหลัง | ระบบครูที่ปรึกษา' }

export default function Page(props: { searchParams: AttendanceSearchParams }) {
  return <AttendancePage mode="backdate" searchParams={props.searchParams} />
}
