/**
 * DLA importer against the REAL export's layout quirks (synthetic values only):
 * misspelled national-ID header, merged report title, sub-column scout/ability
 * groups, 2-digit card dates, optional-date warnings, shared studentIds, and the
 * dlaRaw PII guard. Run with `pnpm test`.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseBEDate } from '../../date/buddhistDate.ts'

import { REAL_IDS, REAL_NID_HEADER, REAL_TITLE, buildRealLayoutDla } from './__fixtures__/realLayoutDla.ts'
import { mapDla, parentsStatusRule, ruleFor } from './dlaMapping.ts'
import { parseDla } from './parseDla.ts'
import { planDla, type RoomResolver } from './planDla.ts'

const parsed = parseDla(buildRealLayoutDla('xls'))
const mapped = mapDla(parsed.sheets, parsed.card)
const rowOf = (sid: string, sheet = 'd1-1') => {
  const r = mapped.rows.find((x) => x.studentId === sid && x.sheet === sheet)
  assert.ok(r, `row ${sid} on ${sheet}`)
  return r
}
const allRooms: RoomResolver = (level, room) => ({ id: `${level}/${room}`, name: `ม.${level}/${room}` })
const plan = planDla(mapped.rows, [], allRooms)

test('header: report title is stripped from paths, groups kept', () => {
  const h = parsed.sheets[0].headers
  assert.ok(h.every((p) => !p.includes(REAL_TITLE)), 'no path carries the merged title')
  assert.ok(h.includes('ลำดับที่'))
  assert.ok(h.includes(REAL_NID_HEADER))
  assert.ok(h.includes('ความสามารถพิเศษ / ดนตรี(ระบุ)'))
  assert.ok(h.includes('ลูกเสือ / เนตรนารี / เหล่า'))
  assert.ok(h.includes('ผู้ปกครอง / คำนำหน้า'), 'last titled column')
  assert.ok(h.includes('ผู้ปกครอง / ชื่อ'), 'first untitled column')
  assert.deepEqual(parsed.skippedSheets.map((s) => s.name), ['d5-3-'])
})

test('national ID: the real misspelled header maps (with and without the title)', () => {
  assert.equal(ruleFor(REAL_NID_HEADER)?.field, 'nationalId')
  assert.equal(ruleFor(`${REAL_TITLE} / ${REAL_NID_HEADER}`)?.field, 'nationalId')
  assert.equal(ruleFor('เลขประจำตัวประชาชน')?.field, 'nationalId')
  assert.equal(rowOf('zr001').nationalId, REAL_IDS.zr001)
  assert.ok(!mapped.missingColumns.includes('เลขประจำตัวประชาชน'))
})

test('scout / ability rules match on the full header path (real headers)', () => {
  assert.equal(ruleFor('ลูกเสือ / เนตรนารี / เหล่า')?.field, 'extras.scoutType')
  assert.equal(ruleFor('ยุวกาชาด / ประเภทสมาชิก')?.field, 'extras.scoutType')
  assert.equal(ruleFor('ลูกเสือ / เนตรนารี / ประเภท'), null, 'สามัญ/… type has no field')
  assert.equal(ruleFor('ยุวกาชาด / ระดับ'), null)
  for (const leaf of ['ดนตรี(ระบุ)', 'กีฬา(ระบุ)', 'ศิลปะ(ระบุ)', 'ภาษาสื่อสาร(ระบุ)', 'อื่นๆ (ระบุ)']) {
    assert.equal(ruleFor(`ความสามารถพิเศษ / ${leaf}`)?.field, 'extras.specialAbilities', leaf)
  }
  const extras = (sid: string) => rowOf(sid).data.extras as Record<string, unknown> | undefined
  assert.equal(extras('zr001')?.scoutType, 'scout', 'combined label + male')
  assert.equal(extras('zr002')?.scoutType, 'girl_guide', 'combined label + female')
  assert.equal(extras('zr003')?.scoutType, 'red_cross_youth', '"ไม่เป็น…" scout ignored, red cross member')
  assert.equal(extras('zr001')?.specialAbilities, 'ดนตรี: zกีตาร์')
  assert.equal(extras('zr002')?.specialAbilities, 'ดนตรี: zร้องเพลง\nกีฬา: zฟุตบอล')
  assert.equal(extras('zr100'), undefined, 'empty columns → no extras')
  assert.equal(
    (mapped.rows.find((r) => r.studentId === 'zr004')?.data.extras as Record<string, unknown> | undefined)?.scoutType,
    undefined,
    'negative anywhere in the cell → not a member',
  )
  assert.equal(rowOf('zr001').unmapped['ลูกเสือ / เนตรนารี / ประเภท'], 'สามัญ')
})

test('card dates: ออก / หมด as dd/mm/yy read as 2-digit พ.ศ.', () => {
  assert.deepEqual(rowOf('zr001').data.cardDates, { issueDate: '2025-05-12', expiryDate: '2028-03-31' })
})

test('optional dates: unreadable → warning, field empty, student kept; ค.ศ. still rejected', () => {
  assert.equal(parseBEDate('16/05/2024'), undefined, 'buddhistDate guard unchanged')
  const z3 = rowOf('zr003')
  assert.equal((z3.data.bio as Record<string, unknown>).enrollDate, undefined)
  assert.equal(z3.errors.length, 0)
  assert.ok(z3.warnings.some((w) => /เข้าศึกษา/.test(w)))
  const z4 = rowOf('zr004', 'd1-2')
  assert.deepEqual(z4.data.cardDates, { expiryDate: '2028-03-31' })
  assert.ok(z4.warnings.some((w) => /ออก/.test(w)))
  assert.ok(plan.creates.some((e) => e.studentId === 'zr003'))
  assert.ok(plan.creates.some((e) => e.studentId === 'zr004'))
  // A required date still fails the row (zr100 on d1-2, also an id conflict).
  assert.ok(rowOf('zr100', 'd1-2').errors.some((e) => /เกิด/.test(e)))
})

test('shared studentId: every row of the group skipped, error row included', () => {
  const zr100 = plan.idConflicts.filter((c) => c.studentId === 'zr100')
  assert.deepEqual(
    zr100.map((c) => `${c.sheet}:${c.row}`),
    ['d1-1:7', 'd1-2:4'],
  )
  assert.ok(zr100.every((c) => /หลายเลขในไฟล์ \(d1-1 แถว 7, d1-2 แถว 4\)/.test(c.message)))
  assert.ok(/ข้อผิดพลาดด้วย/.test(zr100[1].message), 'the error row says it also has an error')
  assert.ok(!plan.errors.some((e) => e.studentId === 'zr100'))
  assert.ok(!plan.creates.some((e) => e.studentId === 'zr100'))
  assert.deepEqual(
    plan.creates.map((e) => e.studentId),
    ['zr001', 'zr002', 'zr003', 'zr004'],
  )
})

test('dlaRaw PII guard: no 13-digit value, no card full name', () => {
  for (const r of mapped.rows) {
    for (const [k, v] of Object.entries(r.unmapped)) {
      assert.ok(!/^\d{13}$/.test(v.replace(/[\s\-.]/g, '')), `13-digit value kept under ${k}`)
      assert.ok(!/ชื่อ-สกุล/.test(k), `card full name kept under ${k}`)
    }
  }
  assert.equal(rowOf('zr001').unmapped['หมายเลขอ้างอิง'], undefined)
  assert.ok(!mapped.unmappedColumns.includes('card / ชื่อ-สกุล'))
  // Other unmapped columns are still kept, under title-free keys.
  assert.equal(rowOf('zr001').unmapped['ORG_CODE'], 'Z0000')
  assert.equal(rowOf('zr001').unmapped['card / ชั้น'], 'ม.1/1')
  for (const w of plan.writes) {
    const raw = JSON.stringify(w.data.dlaRaw)
    assert.ok(!Object.values(REAL_IDS).some((id) => raw.includes(id)))
  }
})

const statusOf = (data: Record<string, unknown>) => {
  const h = (data.household ?? {}) as Record<string, Record<string, unknown> | undefined>
  return { father: h.father?.maritalStatus, mother: h.mother?.maritalStatus, guardian: h.guardian?.maritalStatus }
}
const applyStatus = (raw: string, data: Record<string, unknown> = {}) => {
  const warnings: string[] = []
  const ok = parentsStatusRule.apply(raw, 'สถานภาพ', data, warnings)
  return { ok, warnings, ...statusOf(data) }
}

test('parents status: every label → father / mother; guardian never', () => {
  const cases: Array<[string, unknown, unknown]> = [
    ['อยู่ด้วยกัน', 'married', 'married'],
    ['หย่าร้าง', 'divorced', 'divorced'],
    ['แยกกันอยู่', 'separated', 'separated'],
    ['บิดาถึงแก่กรรม', 'deceased', undefined],
    ['มารดาถึงแก่กรรม', undefined, 'deceased'],
    ['บิดา-มารดาถึงแก่กรรม', 'deceased', 'deceased'],
    // spacing / dash variants
    ['บิดา - มารดา ถึงแก่กรรม', 'deceased', 'deceased'],
    ['บิดา–มารดาถึงแก่กรรม', 'deceased', 'deceased'],
    ['บิดามารดาถึงแก่กรรม', 'deceased', 'deceased'],
    [' แยกกัน อยู่ ', 'separated', 'separated'],
  ]
  for (const [raw, father, mother] of cases) {
    const r = applyStatus(raw)
    assert.equal(r.ok, true, raw)
    assert.deepEqual(r.warnings, [], raw)
    assert.equal(r.father, father, `${raw} father`)
    assert.equal(r.mother, mother, `${raw} mother`)
    assert.equal(r.guardian, undefined, `${raw} guardian`)
  }
})

test('parents status: บิดาถึงแก่กรรม does not touch mother (nor her other fields)', () => {
  const data: Record<string, unknown> = { household: { mother: { firstName: 'zแม่' } } }
  const r = applyStatus('บิดาถึงแก่กรรม', data)
  assert.equal(r.father, 'deceased')
  assert.deepEqual((data.household as Record<string, unknown>).mother, { firstName: 'zแม่' })
  assert.equal(applyStatus('มารดาถึงแก่กรรม').father, undefined)
})

test('parents status: per-parent value wins; disagreement warns, agreement does not', () => {
  const data: Record<string, unknown> = { household: { mother: { maritalStatus: 'married' } } }
  const r = applyStatus('หย่าร้าง', data)
  assert.equal(r.father, 'divorced', 'unset parent still filled')
  assert.equal(r.mother, 'married', 'per-parent value kept')
  assert.equal(r.warnings.length, 1)
  assert.ok(/มารดา/.test(r.warnings[0]))
  const same = applyStatus('อยู่ด้วยกัน', { household: { father: { maritalStatus: 'married' } } })
  assert.deepEqual(same.warnings, [])
})

test('parents status: unknown label → warning, nothing set; empty → nothing', () => {
  const r = applyStatus('zไม่ทราบ')
  assert.equal(r.ok, false)
  assert.equal(r.warnings.length, 1)
  assert.equal(r.father, undefined)
  assert.equal(r.mother, undefined)
  assert.equal(statusOf(rowOf('zr100').data).father, undefined)
  assert.ok(rowOf('zr100').warnings.some((w) => /สถานภาพ/.test(w)))
  assert.equal(rowOf('zr100').unmapped['สถานภาพ'], 'zไม่ทราบสถานะ', 'unknown kept raw')
})

test('parents status: real-layout rows mapped, column out of dlaRaw', () => {
  assert.deepEqual(statusOf(rowOf('zr001').data), { father: 'married', mother: 'married', guardian: undefined })
  assert.deepEqual(statusOf(rowOf('zr002').data), { father: 'deceased', mother: undefined, guardian: undefined })
  assert.deepEqual(statusOf(rowOf('zr003').data), { father: 'deceased', mother: 'deceased', guardian: undefined })
  const z4 = rowOf('zr004', 'd1-2')
  assert.deepEqual(statusOf(z4.data), { father: 'divorced', mother: 'married', guardian: undefined })
  assert.ok(z4.warnings.some((w) => /ไม่ตรงกับสถานภาพมารดา/.test(w)))
  for (const sid of ['zr001', 'zr002', 'zr003']) assert.equal(rowOf(sid).unmapped['สถานภาพ'], undefined, sid)
  assert.equal(z4.unmapped['สถานภาพ'], undefined)
  assert.ok(!mapped.unmappedColumns.includes('สถานภาพ'))
  assert.deepEqual(
    plan.creates.map((e) => e.studentId),
    ['zr001', 'zr002', 'zr003', 'zr004'],
    'plan unchanged by the rule',
  )
})

test('parents status: switched off → column back in dlaRaw, nothing set', () => {
  parentsStatusRule.enabled = false
  try {
    const off = mapDla(parsed.sheets, parsed.card)
    const z1 = off.rows.find((r) => r.studentId === 'zr001' && r.sheet === 'd1-1')
    assert.ok(z1)
    assert.equal(statusOf(z1.data).father, undefined)
    assert.equal(z1.unmapped['สถานภาพ'], 'อยู่ด้วยกัน')
    assert.ok(off.unmappedColumns.includes('สถานภาพ'))
  } finally {
    parentsStatusRule.enabled = true
  }
})
