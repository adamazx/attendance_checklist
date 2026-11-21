/**
 * GET /api/health — liveness + database check for the Docker healthcheck and an
 * external uptime monitor. Public (no auth) on purpose, so it returns nothing but
 * a status word: no version, counts, timings or error text.
 *
 *  - 200 {"status":"ok"}          Payload is up and `select 1` answered in time
 *  - 503 {"status":"unavailable"} anything else (DB down, slow, Payload init failed)
 *
 * Nothing is logged here: a failure is the expected signal, and connection errors
 * can carry host details. (Payload's own init logs a refused connection with the
 * host:port only, never the connection string.)
 *
 * Takes precedence over the `/api/[...slug]` catch-all (more specific segments win).
 */
import config from '@payload-config'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Give up after this long, so a hung connection reports 503 instead of hanging the check. */
const TIMEOUT_MS = 2000

const reply = (status: 200 | 503) =>
  Response.json({ status: status === 200 ? 'ok' : 'unavailable' }, { status, headers: { 'Cache-Control': 'no-store' } })

const checkDatabase = async (): Promise<void> => {
  const payload = await getPayload({ config })
  await (payload.db as unknown as PostgresAdapter).drizzle.execute(sql`select 1`)
}

export async function GET(): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const check = checkDatabase()
  // The check keeps running after a timeout; swallow its late rejection.
  check.catch(() => {})
  try {
    await Promise.race([
      check,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
      }),
    ])
    return reply(200)
  } catch {
    return reply(503)
  } finally {
    clearTimeout(timer)
  }
}
