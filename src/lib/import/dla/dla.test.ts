/**
 * DLA importer: parse (sheets, 3-row merged header), mapping, and the dedupe plan.
 * Uses the SYNTHETIC fixture only — run with `pnpm test`.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { maskNationalId, nationalIdChecksumOk } from '../nationalId.ts'

import { FAKE_IDS, buildSyntheticDla } from './__fixtures__/syntheticDla.ts'
import { mapDla, ruleFor } from './dlaMapping.ts'
import { parseDla } from './parseDla.ts'
import { compareView, planDla, type RoomResolver } from './planDla.ts'
import type { ExistingStudent } from './types.ts'

const parsed = parseDla(buildSyntheticDla('xls'))
const mapped = mapDla(parsed.sheets, parsed.card)
const byId = (sid: string) => mapped.rows.find((r) => r.studentId === sid)

/** Classrooms that exist: ม.1/1 and ม.1/2 only. */
const rooms: RoomResolver = (level, room) =>
  level === 1 && (room === 1 || room === 2)
    ? { id: room, name: `ม.${level}/${room}` }
    : { error: `ไม่พบห้องเรียน "${level}/${room}" ในระบบ` }

test('parse: classroom sheets read, stale d5-3- skipped, card sheet separate', () => {
  assert.deepEqual(
    parsed.sheets.map((s) => s.name),
    ['d1-1', 'd1-2', 'd6-9'],
  )
  assert.deepEqual(parsed.skippedSheets.map((s) => s.name), ['d5-3-'])
  assert.ok(parsed.card)
  assert.equal(parsed.card.rows.length, 2)
  // Data starts on spreadsheet row 4.
  assert.equal(parsed.sheets[0].rows[0].rowNo, 4)
})

test('parse: 3-row merged header becomes paths', () => {
  const h = parsed.sheets[0].headers
  assert.ok(h.includes('เลขประจำตัวประชาชน'))
  assert.ok(h.includes('ข้อมูลครอบครัว / บิดา / ชื่อ'))
  assert.ok(h.includes('ที่อยู่ / ปัจจุบัน / ตำบล'))
  assert.ok(h.includes('ประเภทความพิการ / การมองเห็น'))
})

test('mapping: group context decides the field', () => {
  assert.equal(ruleFor('ชื่อ')?.field, 'firstName')
  assert.equal(ruleFor('ข้อมูลครอบครัว / บิดา / ชื่อ')?.field, 'household.father.firstName')
  assert.equal(ruleFor('ข้อมูลครอบครัว / มารดา / รายได้/เดือน')?.field, 'household.mother.monthlyIncome')
  assert.equal(ruleFor('ที่อยู่ / ตามทะเบียนบ้าน / บ้านเลขที่')?.field, 'addressRegistered.houseNo')
  assert.equal(ruleFor('ศาสนา')?.field, 'bio.religion')
  assert.equal(ruleFor('หมายเหตุพิเศษ'), null)
})

test('mapping: values normalized, พ.ศ. dates converted, card dates joined', () => {
  const r = byId('z0001')
  assert.ok(r)
  assert.equal(r.nationalId, FAKE_IDS.z0001)
  assert.equal(r.data.prefix, 'ด.ช.')
  assert.equal(r.data.classNumber, 1)
  const bio = r.data.bio as Record<string, unknown>
  assert.equal(bio.gender, 'male')
  assert.equal(bio.birthDate, '2014-03-15')
  assert.equal(bio.religion, 'buddhism')
  assert.equal(bio.nationality, 'thai')
  assert.equal(bio.program, 'general')
  assert.equal(bio.heightCm, 150)
  const father = (r.data.household as Record<string, Record<string, unknown>>).father
  assert.equal(father.firstName, 'zบิดาz0001')
  assert.equal(father.monthlyIncome, 9000)
  assert.equal(father.maritalStatus, 'married')
  assert.equal((r.data.addressCurrent as Record<string, unknown>).postalCode, '40290')
  assert.equal((r.data.welfare as Record<string, unknown>).studentCondition, 'normal')
  assert.deepEqual(r.data.cardDates, { issueDate: '2026-06-01', expiryDate: '2029-05-31' })
  assert.equal(r.data.extras, undefined, 'empty disability/scout columns produce no extras')
  assert.deepEqual(r.unmapped, { หมายเหตุพิเศษ: 'ข้อมูลทดสอบ' })
  assert.equal((byId('z0002')?.data.bio as Record<string, unknown>).religion, 'islam')
})

test('mapping: unmapped and missing columns reported', () => {
  assert.ok(mapped.unmappedColumns.includes('หมายเหตุพิเศษ'))
  assert.deepEqual(mapped.missingColumns, [])
})

test('plan: empty DB → creates, cross-room conflict, errors', () => {
  const plan = planDla(mapped.rows, [], rooms)
  assert.deepEqual(
    plan.creates.map((e) => e.studentId),
    ['z0001', 'z0002', 'z0006'],
  )
  assert.equal(plan.conflicts.length, 2)
  assert.ok(plan.conflicts.every((c) => c.studentId === 'z0003' && /หลายห้อง/.test(c.message)))
  const errs = Object.fromEntries(plan.errors.map((e) => [e.studentId, e.message]))
  assert.match(errs.z0004, /31\/02\/2557/)
  assert.match(errs.z0005, /ไม่มีเลขประจำตัวประชาชน/)
  assert.match(errs.z0007, /ไม่พบห้องเรียน/)
  const z6 = plan.creates.find((e) => e.studentId === 'z0006')
  assert.ok(z6?.warnings.some((w) => /checksum/.test(w)), 'checksum failure is a warning, not an error')
  assert.equal(plan.writes.length, 3)
  // Preview never carries a full national ID.
  assert.ok(plan.creates.every((e) => !e.nationalIdMasked.includes(FAKE_IDS.z0001.slice(0, 9))))
  const w1 = plan.writes.find((w) => w.entry.studentId === 'z0001')
  assert.deepEqual(w1?.data.dlaRaw, { sheet: 'd1-1', row: 4, unmapped: { หมายเหตุพิเศษ: 'ข้อมูลทดสอบ' } })
})

test('plan: DB matches → update, link, unchanged, id conflicts', () => {
  const z1 = byId('z0001')
  assert.ok(z1)
  const asStored = compareView({ ...z1.data, classroom: 1, dlaRaw: { sheet: 'd1-1', row: 4, unmapped: z1.unmapped } })
  const existing: ExistingStudent[] = [
    { id: 101, studentId: 'z0001', nationalId: FAKE_IDS.z0001, flat: asStored }, // unchanged
    { id: 102, studentId: 'z0002', nationalId: null, flat: { studentId: 'z0002' } }, // link
    { id: 106, studentId: 'zOTHER', nationalId: FAKE_IDS.z0006, flat: {} }, // nid owned by another studentId
  ]
  const plan = planDla(mapped.rows, existing, rooms)
  assert.deepEqual(plan.unchanged.map((e) => e.studentId), ['z0001'])
  assert.equal(plan.updates.length, 1)
  assert.equal(plan.updates[0].studentId, 'z0002')
  assert.equal(plan.updates[0].link, true)
  assert.equal(plan.updates[0].targetId, 102)
  assert.deepEqual(plan.idConflicts.map((e) => e.studentId), ['z0006'])
  assert.equal(plan.creates.length, 0)
})

test('national ID: checksum + mask', () => {
  assert.equal(nationalIdChecksumOk(FAKE_IDS.z0001), true)
  assert.equal(nationalIdChecksumOk(FAKE_IDS.z0006), false)
  assert.equal(maskNationalId('1234567890123'), 'x-xxxx-xxxx0-12-3')
  assert.equal(maskNationalId(''), '')
})
