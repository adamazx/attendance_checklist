'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

const HREF = '/admin/import-students'

/** Styled like Payload's nav links; active state uses theme CSS variables. */
export const ImportStudentsNavLinkClient: React.FC = () => {
  const pathname = usePathname()
  const active = pathname === HREF
  return (
    <Link
      href={HREF}
      className="nav__link"
      style={{
        display: 'block',
        padding: '0.5rem 0',
        color: active ? 'var(--theme-elevation-1000)' : 'var(--theme-elevation-800)',
        fontWeight: active ? 600 : 400,
      }}
    >
      นำเข้ารายชื่อนักเรียน
    </Link>
  )
}
