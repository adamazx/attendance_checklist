/**
 * Server-side session helpers for the teacher UI. The user comes from Payload's
 * auth cookie; `cache()` dedupes the lookup within one render.
 *
 * Every page must call `requireUser()` itself: a layout does not re-run on client
 * navigation, so it cannot act as the security boundary.
 */
import config from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { cache } from 'react'

export const getCurrentUser = cache(async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  return user
})

export const requireUser = async () => {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}
