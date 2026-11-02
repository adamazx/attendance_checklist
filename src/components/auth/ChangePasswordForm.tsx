'use client'

import React, { useState } from 'react'

const inputClass =
  'mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 focus:outline-2 focus:outline-brand-gold'

const MIN_LENGTH = 8

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirm) {
      setMessage({ ok: false, text: 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน' })
      return
    }
    setPending(true)
    setMessage(null)
    try {
      const res = await fetch('/api/account/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = (await res.json()) as { error?: string }
      if (res.ok) {
        setMessage({ ok: true, text: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirm('')
      } else {
        setMessage({ ok: false, text: data.error ?? 'เปลี่ยนรหัสผ่านไม่สำเร็จ' })
      }
    } catch {
      setMessage({ ok: false, text: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง' })
    }
    setPending(false)
  }

  return (
    <form className="space-y-4 rounded-xl border-t-4 border-brand-gold bg-surface p-5 shadow-card" onSubmit={submit}>
      <label className="block font-medium">
        รหัสผ่านปัจจุบัน
        <input
          autoComplete="current-password"
          className={inputClass}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          type="password"
          value={currentPassword}
        />
      </label>
      <label className="block font-medium">
        รหัสผ่านใหม่ (อย่างน้อย {MIN_LENGTH} ตัวอักษร)
        <input
          autoComplete="new-password"
          className={inputClass}
          minLength={MIN_LENGTH}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          type="password"
          value={newPassword}
        />
      </label>
      <label className="block font-medium">
        ยืนยันรหัสผ่านใหม่
        <input
          autoComplete="new-password"
          className={inputClass}
          minLength={MIN_LENGTH}
          onChange={(e) => setConfirm(e.target.value)}
          required
          type="password"
          value={confirm}
        />
      </label>
      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${message.ok ? 'bg-action-green text-on-dark' : 'bg-gold-pale text-brand-red-dark'}`}
          role="alert"
        >
          {message.text}
        </p>
      )}
      <button
        className="min-h-11 w-full cursor-pointer rounded-lg border border-brand-gold bg-brand-red font-semibold text-on-dark hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}
      </button>
    </form>
  )
}
