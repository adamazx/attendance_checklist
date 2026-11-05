/**
 * Phase 5a test fixtures — an ISOLATED set, everything prefixed z5a-/Z5A-.
 *
 *   pnpm dlx tsx scripts/seed-z5a.mts <credentials-file>
 *
 * Creates one user per role (z5a-admin, z5a-advisor-a, z5a-advisor-b, z5a-discipline)
 * and two classrooms in the active academic year, Z5A-1/1 (advisor A) and Z5A-1/2
 * (advisor B), which the synthetic DLA fixture's sheets d1-1 / d1-2 resolve to.
 * Students come from importing that fixture. Passwords go only to <credentials-file>.
 * Aborts if any Z5A classroom already exists. Never touches other data.
 *
 * Cleanup: delete the z-prefixed students (and their student-photos + files), the
 * Z5A classrooms and the z5a-* users.
 */
import 'dotenv/config'

import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

const credentialsFile = process.argv[2]
if (!credentialsFile) throw new Error('usage: tsx scripts/seed-z5a.mts <credentials-file>')

const { default: config } = await import('../src/payload.config.ts')
const { getPayload } = await import('payload')
const payload = await getPayload({ config })

const existing = await payload.find({ collection: 'classrooms', where: { name: { like: 'Z5A-' } }, limit: 1 })
if (existing.totalDocs > 0) {
  console.error('Z5A fixtures already exist — aborting (clean them up first).')
  process.exit(1)
}

const years = await payload.find({ collection: 'academic-years', where: { isActive: { equals: true } }, limit: 1 })
const year = years.docs[0]
if (!year) throw new Error('No active academic year')

const creds: Record<string, string> = {}
const makeUser = async (key: string, role: 'admin' | 'advisor' | 'discipline') => {
  const pw = randomBytes(12).toString('base64url')
  const email = `z5a-${key}@test.local`
  const user = await payload.create({
    collection: 'users',
    data: { email, fullName: `Z5A-${key}`, password: pw, role },
  })
  creds[email] = pw
  return user
}

await makeUser('admin', 'admin')
const advisorA = await makeUser('advisor-a', 'advisor')
const advisorB = await makeUser('advisor-b', 'advisor')
await makeUser('discipline', 'discipline')

for (const [room, advisor] of [
  [1, advisorA],
  [2, advisorB],
] as const) {
  await payload.create({
    collection: 'classrooms',
    data: { academicYear: year.id, advisors: [advisor.id], level: 'm1', name: `Z5A-1/${room}`, roomNumber: room },
  })
}

await writeFile(credentialsFile, JSON.stringify(creds, null, 2))
console.log(`Z5A fixtures created; credentials written to ${credentialsFile}`)
process.exit(0)
