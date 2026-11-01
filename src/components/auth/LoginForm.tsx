'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

const inputClass =
  'mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-text-ink focus:outline-2 focus:outline-brand-gold'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) {
        router.replace('/')
        router.refresh()
        return
      }
      setError(
        res.status === 401
          ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หากกรอกผิดเกิน 5 ครั้ง บัญชีจะถูกล็อก 10 นาที'
          : 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      )
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง')
    }
    setPending(false)
  }

  return (
    <form className="space-y-4 px-6 py-6" onSubmit={submit}>
      <label className="block font-medium">
        อีเมล
        <input
          autoComplete="username"
          className={inputClass}
          onChange={(e) => setEmail(e.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      <label className="block font-medium">
        รหัสผ่าน
        <input
          autoComplete="current-password"
          className={inputClass}
          onChange={(e) => setPassword(e.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {error && (
        <p className="rounded-lg bg-gold-pale px-3 py-2 text-sm text-brand-red-dark" role="alert">
          {error}
        </p>
      )}
      <button
        className="min-h-11 w-full cursor-pointer rounded-lg border border-brand-gold bg-brand-red font-semibold text-on-dark hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
      </button>
    </form>
  )
}
