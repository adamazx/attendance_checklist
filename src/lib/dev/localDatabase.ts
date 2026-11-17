/**
 * Guard for dev-only scripts (fixture seeds, password rotation): refuse to run
 * unless DATABASE_URI points at a local Postgres. Pure, no Payload import, so a
 * script can call it before anything connects.
 *
 * Errors name the host at most, never the URI itself (it carries the password).
 */

/**
 * Hosts that count as local: loopback only. The scripts run on the host and reach
 * the compose DB through the published localhost:5432. A compose service name such
 * as `postgres` is deliberately NOT allowed: a production compose stack would likely
 * use the same name, so a script run inside a prod container would pass the guard.
 */
export const LOCAL_DATABASE_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '::1'])

/** Query params with which node-postgres overrides the URL's host. */
const HOST_OVERRIDE_PARAMS = ['host', 'hostaddr']

type Env = Record<string, string | undefined>

export function assertLocalDatabase(uri: string | undefined, env: Env = process.env): void {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to run a dev-only script with NODE_ENV=production.')
  }
  if (!uri) throw new Error('DATABASE_URI is not set — refusing to run a dev-only script.')

  let url: URL
  try {
    url = new URL(uri)
  } catch {
    throw new Error('DATABASE_URI is not a valid URL — refusing to run a dev-only script.')
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error(`DATABASE_URI must use postgres:// or postgresql:// (got ${url.protocol}//) — refusing.`)
  }

  // `postgres://` is not a WHATWG special scheme: the host is kept as written,
  // so normalise case and strip IPv6 brackets ourselves.
  const host = url.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1')
  if (!host) throw new Error('DATABASE_URI has no host — refusing to run a dev-only script.')
  if (!LOCAL_DATABASE_HOSTS.has(host)) {
    throw new Error(`DATABASE_URI host "${host}" is not a local database — refusing to run a dev-only script.`)
  }
  for (const param of HOST_OVERRIDE_PARAMS) {
    if (url.searchParams.has(param)) {
      throw new Error(`DATABASE_URI overrides its host with ?${param}= — refusing to run a dev-only script.`)
    }
  }
}
