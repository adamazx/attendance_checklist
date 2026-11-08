import React from 'react'
import { Sarabun } from 'next/font/google'
import { SCHOOL_FULL_NAME } from '@/lib/school'

import './styles.css'

// Thai web font (Buddhist-era / Thai UI). Exposed as a CSS variable for the theme.
const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sarabun',
  display: 'swap',
})

export const metadata = {
  description: `ระบบครูที่ปรึกษา ${SCHOOL_FULL_NAME}`,
  title: 'ระบบครูที่ปรึกษา',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="th" className={sarabun.variable}>
      <body>
        {children}
      </body>
    </html>
  )
}
