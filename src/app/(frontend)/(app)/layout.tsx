import React from 'react'

import { Footer } from '@/components/shell/Footer'
import { Navbar } from '@/components/shell/Navbar'
import { requireUser } from '@/lib/auth/currentUser'

export default async function AppLayout(props: { children: React.ReactNode }) {
  const user = await requireUser()

  return (
    <div className="flex min-h-screen flex-col">
      <div className="print:hidden">
        <Navbar userName={user.fullName} />
      </div>
      <main className="mx-auto w-full max-w-[1080px] flex-1 px-4 print:max-w-none print:px-0">{props.children}</main>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  )
}
