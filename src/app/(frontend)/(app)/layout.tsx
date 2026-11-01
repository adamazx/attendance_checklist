import React from 'react'

import { Footer } from '@/components/shell/Footer'
import { Navbar } from '@/components/shell/Navbar'
import { requireUser } from '@/lib/auth/currentUser'

export default async function AppLayout(props: { children: React.ReactNode }) {
  const user = await requireUser()

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar userName={user.fullName} />
      <main className="mx-auto w-full max-w-[1080px] flex-1 px-4">{props.children}</main>
      <Footer />
    </div>
  )
}
