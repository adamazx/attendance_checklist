import Link from 'next/link'
import React from 'react'

import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm'
import { requireUser } from '@/lib/auth/currentUser'

export const metadata = { title: 'เปลี่ยนรหัสผ่าน | ระบบครูที่ปรึกษา' }

export default async function ChangePasswordPage() {
  await requireUser()

  return (
    <div className="mx-auto mt-6 max-w-md">
      <Link className="text-brand-red-dark" href="/">
        ← กลับหน้าหลัก
      </Link>
      <h1 className="mt-3 mb-4 text-2xl font-bold text-brand-red">เปลี่ยนรหัสผ่าน</h1>
      <ChangePasswordForm />
    </div>
  )
}
