/**
 * Rotate the passwords of the dev-only fixture users (every user whose email ends
 * with "@test.local", nothing else) — e.g. after a credentials file leaked.
 *
 *   pnpm dlx tsx scripts/rotate-fixture-passwords.mts .local/fixture-credentials.txt [expected-count]
 *
 * LOCAL DEV ONLY: refuses to run (before connecting) unless DATABASE_URI points at a
 * local Postgres and NODE_ENV is not production — see src/lib/dev/localDatabase.ts.
 *
 * - <credentials-file> must resolve inside <repo>/.local/ (gitignored) or outside the
 *   repo; anything else is refused. It is overwritten with one "<email> <password>"
 *   line per user. Passwords are never printed.
 * - [expected-count] (default 6, the z5a + z3b fixture users) must equal the number
 *   of matching users, or the script aborts before changing anything.
 * - All updates run in one transaction; the file is written before the commit, so
 *   either every password changes and is recorded, or none does.
 */
import 'dotenv/config'

import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { assertLocalDatabase } from '../src/lib/dev/localDatabase.ts'

assertLocalDatabase(process.env.DATABASE_URI)

const FIXTURE_DOMAIN = '@test.local'

const usage = 'usage: tsx scripts/rotate-fixture-passwords.mts <credentials-file> [expected-count]'
const target = process.argv[2]
if (!target) throw new Error(usage)
const expected = process.argv[3] === undefined ? 6 : Number(process.argv[3])
if (!Number.isInteger(expected) || expected < 1) throw new Error(usage)

// --- Where may the credentials file go? -------------------------------------
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const localDir = path.join(repoRoot, '.local')
const outFile = path.resolve(target)
const norm = (p: string) => (process.platform === 'win32' ? p.toLowerCase() : p)
const isInside = (dir: string, p: string) => {
  const rel = path.relative(norm(dir), norm(p))
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}
if (isInside(repoRoot, outFile) && !isInside(localDir, outFile)) {
  console.error(`Refusing to write credentials inside the repo outside .local/: ${outFile}`)
  process.exit(1)
}

// --- Rotate --------------------------------------------------------------------
const { default: config } = await import('../src/payload.config.ts')
const { getPayload } = await import('payload')
const payload = await getPayload({ config })

const found = await payload.find({
  collection: 'users',
  depth: 0,
  limit: 0,
  pagination: false,
  where: { email: { like: FIXTURE_DOMAIN } },
})
const users = found.docs.filter((u) => u.email.toLowerCase().endsWith(FIXTURE_DOMAIN))
if (users.length !== found.docs.length) {
  console.error(`Aborting: ${found.docs.length - users.length} user(s) contain but do not end with ${FIXTURE_DOMAIN}. Nothing changed.`)
  process.exit(1)
}
if (users.length !== expected) {
  console.error(`Aborting: expected ${expected} fixture users, found ${users.length}. Nothing changed.`)
  process.exit(1)
}

const transactionID = await payload.db.beginTransaction()
if (!transactionID) throw new Error('Could not start a transaction')
const lines: string[] = []
try {
  for (const user of users) {
    const password = randomBytes(12).toString('base64url')
    await payload.update({ collection: 'users', data: { password }, id: user.id, req: { transactionID } })
    lines.push(`${user.email} ${password}`)
  }
  await mkdir(path.dirname(outFile), { recursive: true })
  await writeFile(outFile, `${lines.join('\n')}\n`, { mode: 0o600 })
  await payload.db.commitTransaction(transactionID)
} catch (err) {
  await payload.db.rollbackTransaction(transactionID)
  console.error('Rotation failed and was rolled back; no password changed.')
  throw err
}

console.log(`rotated ${users.length} users → ${outFile}`)
process.exit(0)
