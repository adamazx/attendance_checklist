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

/**
 * With a CSRF allowlist configured, Payload ignores the auth cookie on a request
 * with no Origin unless Sec-Fetch-Site is same-origin/same-site/none, so a link
 * opened from LINE or email (`cross-site`) would land on /login. A page render is
 * a read, so that check doesn't apply here: present such a request as same-origin.
 * Requests that carry an Origin are still checked. Writes never use this helper;
 * route handlers authenticate with their own request headers.
 */
const pageRenderHeaders = async (): Promise<Headers> => {
  const incoming = new Headers(await headers())
  if (!incoming.has('origin')) incoming.set('sec-fetch-site', 'same-origin')
  return incoming
}

export const getCurrentUser = cache(async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await pageRenderHeaders() })
  return user
})

export const requireUser = async () => {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}
