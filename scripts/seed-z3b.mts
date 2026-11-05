/**
 * Phase 3b export test fixtures — an ISOLATED set, everything prefixed z3b-/Z3B-.
 *
 *   pnpm dlx tsx scripts/seed-z3b.mts <credentials-file>
 *
 * (Not `pnpm payload run`, which crashes on this setup.) Creates two advisors, two
 * classrooms in the active academic year, 5 + 1 students, one activity, and roll
 * calls over the last 5 weekdays covering all 5 statuses. Records are written as
 * their advisor through the Local API, so the snapshot and audit hooks run (audit
 * rows are created too). Passwords go only to <credentials-file>. Aborts if any Z3B
 * classroom already exists. Never touches other data.
 *
 * Cleanup: delete the Z3B attendance records (and their audit_logs rows), students,
 * classrooms, the Z3B activity and the z3b-advisor-* users.
 */
import 'dotenv/config'

import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

import type { AttendanceStatus } from '../src/lib/attendance/statuses.ts'
import { shiftThaiDay, todayThai } from '../src/lib/date/thaiDay.ts'

const credentialsFile = process.argv[2]
if (!credentialsFile) throw new Error('usage: tsx scripts/seed-z3b.mts <credentials-file>')

const { default: config } = await import('../src/payload.config.ts')
const { getPayload } = await import('payload')
const payload = await getPayload({ config })

const existing = await payload.find({ collection: 'classrooms', where: { name: { like: 'Z3B-' } }, limit: 1 })
if (existing.totalDocs > 0) {
  console.error('Z3B fixtures already exist — aborting (clean them up first).')
  process.exit(1)
}

const years = await payload.find({ collection: 'academic-years', where: { isActive: { equals: true } }, limit: 1 })
const year = years.docs[0]
if (!year) throw new Error('No active academic year')

/** The last `n` weekdays up to and including today, oldest first. */
const weekdays = (n: number): string[] => {
  const out: string[] = []
  for (let day = todayThai(); out.length < n; day = shiftThaiDay(day, -1)) {
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay()
    if (dow !== 0 && dow !== 6) out.unshift(day)
  }
  return out
}
const days = weekdays(5)

const password = () => randomBytes(12).toString('base64url')
const makeAdvisor = async (key: 'a' | 'b') => {
  const pw = password()
  const user = await payload.create({
    collection: 'users',
    data: { email: `z3b-advisor-${key}@test.local`, fullName: `Z3B-ครูทดสอบ ${key.toUpperCase()}`, password: pw, role: 'advisor' },
  })
  return { pw, user }
}
const a = await makeAdvisor('a')
const b = await makeAdvisor('b')

const makeRoom = (name: string, roomNumber: number, advisorId: number) =>
  payload.create({
    collection: 'classrooms',
    data: { academicYear: year.id, advisors: [advisorId], level: 'm6', name, roomNumber },
  })
const roomA = await makeRoom('Z3B-ห้องA', 901, a.user.id)
const roomB = await makeRoom('Z3B-ห้องB', 902, b.user.id)

const makeStudent = (code: string, first: string, classNumber: number, classroom: number) =>
  payload.create({
    collection: 'students',
    data: { classNumber, classroom, firstName: `Z3B-${first}`, lastName: 'ทดสอบ', prefix: 'นาย', status: 'studying', studentId: code },
  })
const studentsA = []
for (const [i, first] of ['หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า'].entries()) {
  studentsA.push(await makeStudent(`Z3B-00${i + 1}`, first, i + 1, roomA.id))
}
const studentB = await makeStudent('Z3B-101', 'บี', 1, roomB.id)

const activity = await payload.create({ collection: 'activities', data: { name: 'Z3B-กิจกรรมทดสอบ', type: 'activity' } })

// Homeroom matrix: rows = students 1..5, columns = the 5 days.
// P มา · L สาย · V ลา · A ขาด · R ลาออก
const code: Record<string, AttendanceStatus> = { A: 'absent', L: 'late', P: 'present', R: 'resigned', V: 'leave' }
const matrix = ['PPPPP', 'PLLPP', 'PAPVP', 'LAAPP', 'PVPPR']
const notes: Record<string, string> = { '1,1': 'รถติด', '2,1': 'ไม่แจ้ง', '2,3': 'ป่วย', '4,1': 'ลากิจ', '4,4': 'ลาออกกลางภาค' }

const record = (user: typeof a.user, student: number, date: string, status: AttendanceStatus, extra: { activity?: number; note?: string } = {}) =>
  payload.create({
    collection: 'attendance-records',
    data: { activity: extra.activity ?? null, date, note: extra.note ?? null, status, student },
    overrideAccess: false,
    user,
  })

let count = 0
for (const [s, row] of matrix.entries()) {
  for (const [d, letter] of [...row].entries()) {
    await record(a.user, studentsA[s]!.id, days[d]!, code[letter]!, { note: notes[`${s},${d}`] })
    count++
  }
}
// Activity records on day 3: student 1 มา, student 2 สาย (so the activity filter changes the late report).
await record(a.user, studentsA[0]!.id, days[2]!, 'present', { activity: activity.id })
await record(a.user, studentsA[1]!.id, days[2]!, 'late', { activity: activity.id, note: 'กิจกรรม' })
// Room B (the other advisor's room).
await record(b.user, studentB.id, days[3]!, 'present')
await record(b.user, studentB.id, days[4]!, 'late')
count += 4

await writeFile(
  credentialsFile,
  [
    `z3b-advisor-a@test.local  ${a.pw}`,
    `z3b-advisor-b@test.local  ${b.pw}`,
    '',
    `roomA=${roomA.id} roomB=${roomB.id} activity=${activity.id}`,
    `students A=${studentsA.map((s) => s.id).join(',')} B=${studentB.id}`,
    `days=${days.join(',')}`,
    '',
  ].join('\n'),
)
console.log(`Seeded Z3B: rooms ${roomA.id}/${roomB.id}, activity ${activity.id}, ${count} records over ${days[0]}..${days[4]}`)
console.log(`Credentials written to ${credentialsFile}`)
process.exit(0)
