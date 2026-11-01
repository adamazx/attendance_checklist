import { redirect } from 'next/navigation'
import React from 'react'

import { LoginForm } from '@/components/auth/LoginForm'
import { getCurrentUser } from '@/lib/auth/currentUser'

export const metadata = { title: 'เข้าสู่ระบบ | ระบบครูที่ปรึกษา' }

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/')

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-red-dark px-4 py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-xl border-t-4 border-brand-gold bg-surface shadow-card">
        <div className="bg-brand-red px-6 py-6 text-center text-on-dark">
          <div aria-hidden="true" className="text-3xl">
            📘
          </div>
          <h1 className="mt-2 text-xl font-bold">ระบบครูที่ปรึกษา</h1>
          <p className="mt-1 text-sm text-gold-soft">โรงเรียนโนนหันวิทยายน องค์การบริหารส่วนจังหวัดขอนแก่น</p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
