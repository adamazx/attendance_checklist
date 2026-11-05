import Link from 'next/link'
import React from 'react'

import { LogoutButton } from './LogoutButton'

const itemClass = 'block w-full cursor-pointer px-4 py-2 text-left no-underline hover:bg-gold-pale'

export function Navbar(props: { userName: string }) {
  return (
    <nav className="border-b-2 border-brand-gold bg-brand-red text-on-dark">
      <div className="mx-auto flex min-h-15 max-w-[1080px] items-center justify-between gap-3 px-4 py-2.5">
        <Link className="flex items-center gap-2.5 text-lg font-bold no-underline" href="/">
          <span aria-hidden="true">📘</span>
          <span>ระบบครูที่ปรึกษา</span>
        </Link>
        <div className="flex items-center gap-3 font-medium">
          <span className="hidden sm:inline">ชื่อ: {props.userName}</span>
          <details className="relative">
            <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-full border border-brand-gold bg-on-dark/15 px-3.5 font-semibold hover:bg-on-dark/25">
              เมนู <span aria-hidden="true">▾</span>
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-lg border border-line bg-surface text-text-ink shadow-card">
              <Link className={itemClass} href="/">
                หน้าหลัก
              </Link>
              <Link className={itemClass} href="/students">
                ค้นหานักเรียน
              </Link>
              <Link className={itemClass} href="/change-password">
                เปลี่ยนรหัสผ่าน
              </Link>
              <LogoutButton className={itemClass}>ออกจากระบบ</LogoutButton>
            </div>
          </details>
        </div>
      </div>
    </nav>
  )
}
