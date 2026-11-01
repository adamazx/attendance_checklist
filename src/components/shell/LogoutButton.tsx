'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export function LogoutButton(props: { children: React.ReactNode; className?: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const logout = async () => {
    setPending(true)
    try {
      await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    } finally {
      router.replace('/login')
      router.refresh()
    }
  }

  return (
    <button className={props.className} disabled={pending} onClick={logout} type="button">
      {props.children}
    </button>
  )
}
