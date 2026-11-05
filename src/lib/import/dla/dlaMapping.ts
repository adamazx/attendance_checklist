/**
 * DLA column mapping: header path → Student field path + value normalizer.
 *
 * Built to the documented DLA layout without the real file, so matching is by
 * keyword rather than exact header text. A rule with `ctx` only matches when the
 * header path mentions that group (บิดา, ที่อยู่ปัจจุบัน, …); a rule without `ctx`
 * only matches when the path mentions NO group, so "ชื่อ" alone is the student's
 * name and "บิดา / ชื่อ" is the father's.
 *
 * Anything no rule matches — or a value a normalizer can't read — is kept in
 * `dlaRaw.unmapped`, and the dry run lists those columns, so a mapping gap in the
 * real file shows up on its first preview and is fixed here (no migration).
 */
import { normalizeNationalId } from '../nationalId.ts'
import { normalizePrefix, thaiDigitsToArabic } from '../studentMapping.ts'
import { parseBEDate } from '../../date/buddhistDate.ts'

import type { DlaCardSheet, DlaSheet, MappedRow } from './types.ts'

type Kind =
  | 'text'
  | 'phone'
  | 'int'
  | 'number'
  | 'date'
  | 'prefix'
  | 'nationalId'
  | 'fullName'
  | 'disability'
  | 'scout'
  | { select: Array<[RegExp, string]> }

interface Rule {
  field: string
  leaf: RegExp
  ctx?: RegExp
  kind: Kind
  /** Value for `disability` columns. */
  value?: string
}

/** Any of these in a header path means the column belongs to a group. */
const GROUP_RE = /บิดา|มารดา|ผู้ปกครอง|ทะเบียนบ้าน|ปัจจุบัน|พิการ/

const RELIGION: Array<[RegExp, string]> = [
  [/พุทธ|buddh/i, 'buddhism'],
  [/อิสลาม|มุสลิม|islam/i, 'islam'],
  [/คริสต์|christ/i, 'christianity'],
  [/ฮินดู|hindu/i, 'hinduism'],
  [/ซิกข์|sikh/i, 'sikhism'],
  [/ไม่มี|ไม่นับถือ|none/i, 'none'],
]
const NATION: Array<[RegExp, string]> = [
  [/ไทย|thai/i, 'thai'],
  [/ลาว|lao/i, 'lao'],
  [/พม่า|เมียนมา|myanmar/i, 'myanmar'],
  [/กัมพูชา|เขมร|cambod/i, 'cambodian'],
  [/เวียดนาม|viet/i, 'vietnamese'],
  [/จีน|chin/i, 'chinese'],
]
const GENDER: Array<[RegExp, string]> = [
  [/^(ชาย|ช|male|m|1)$/i, 'male'],
  [/^(หญิง|ญ|female|f|2)$/i, 'female'],
]
const PROGRAM: Array<[RegExp, string]> = [
  [/วิทย|sci/i, 'sci_math'],
  [/ศิลป.*(คำนวณ|คณิต)/, 'arts_math'],
  [/ศิลป.*ภาษา/, 'arts_lang'],
  [/ทั่วไป|ปกติ|general/i, 'general'],
]
const MARITAL: Array<[RegExp, string]> = [
  [/เสียชีวิต|ถึงแก่กรรม|ตาย/, 'deceased'],
  [/หย่า/, 'divorced'],
  [/แยก/, 'separated'],
  [/หม้าย/, 'widowed'],
  [/โสด/, 'single'],
  [/สมรส|อยู่ด้วยกัน|อยู่ร่วมกัน|แต่งงาน/, 'married'],
]
const CONDITION: Array<[RegExp, string]> = [
  [/ด้อยโอกาส/, 'disadvantaged'],
  [/ยากจน|ยากไร้/, 'poor'],
  [/ปกติ/, 'normal'],
]

const parentRules = (group: 'father' | 'mother' | 'guardian', ctx: RegExp): Rule[] => [
  { field: `household.${group}.prefix`, ctx, leaf: /คำนำหน้า/, kind: 'text' },
  { field: `household.${group}`, ctx, leaf: /^ชื่อ\s*[-–]?\s*(นาม)?สกุล/, kind: 'fullName' },
  { field: `household.${group}.lastName`, ctx, leaf: /^(นาม)?สกุล/, kind: 'text' },
  { field: `household.${group}.firstName`, ctx, leaf: /^ชื่อ(บิดา|มารดา|ผู้ปกครอง)?$/, kind: 'text' },
  { field: `household.${group}.religion`, ctx, leaf: /ศาสนา/, kind: { select: RELIGION } },
  { field: `household.${group}.occupation`, ctx, leaf: /อาชีพ/, kind: 'text' },
  { field: `household.${group}.monthlyIncome`, ctx, leaf: /รายได้/, kind: 'number' },
  { field: `household.${group}.phone`, ctx, leaf: /เบอร์|โทร/, kind: 'phone' },
  { field: `household.${group}.relationship`, ctx, leaf: /เกี่ยวข้อง/, kind: 'text' },
  { field: `household.${group}.maritalStatus`, ctx, leaf: /สถานภาพ/, kind: { select: MARITAL } },
]

const addressRules = (group: 'addressRegistered' | 'addressCurrent', ctx: RegExp): Rule[] => [
  { field: `${group}.houseNo`, ctx, leaf: /เลขที่/, kind: 'text' },
  { field: `${group}.moo`, ctx, leaf: /หมู่/, kind: 'text' },
  { field: `${group}.road`, ctx, leaf: /ถนน/, kind: 'text' },
  { field: `${group}.subdistrict`, ctx, leaf: /ตำบล|แขวง/, kind: 'text' },
  { field: `${group}.district`, ctx, leaf: /อำเภอ|เขต/, kind: 'text' },
  { field: `${group}.province`, ctx, leaf: /จังหวัด/, kind: 'text' },
  { field: `${group}.postalCode`, ctx, leaf: /ไปรษณีย์/, kind: 'int' },
]

const DISABILITY_CTX = /พิการ/
const disabilityRule = (leaf: RegExp, value: string): Rule => ({
  field: 'extras.disabilities',
  ctx: DISABILITY_CTX,
  leaf,
  kind: 'disability',
  value,
})

/** Ordered: the first matching rule wins. Group rules (with ctx) come first. */
export const DLA_RULES: Rule[] = [
  ...parentRules('father', /บิดา/),
  ...parentRules('mother', /มารดา/),
  ...parentRules('guardian', /ผู้ปกครอง/),
  ...addressRules('addressRegistered', /ทะเบียนบ้าน/),
  ...addressRules('addressCurrent', /ปัจจุบัน/),
  disabilityRule(/มองเห็น/, 'visual'),
  disabilityRule(/ได้ยิน/, 'hearing'),
  disabilityRule(/สติปัญญา/, 'intellectual'),
  disabilityRule(/ร่างกาย|สุขภาพ/, 'physical_health'),
  disabilityRule(/การเรียนรู้/, 'learning'),
  disabilityRule(/การพูด|ภาษา/, 'speech_language'),
  disabilityRule(/พฤติกรรม|อารมณ์/, 'behavioral_emotional'),
  disabilityRule(/ออทิสติก/, 'autism'),
  disabilityRule(/ซ้อน/, 'multiple'),

  { field: 'nationalId', leaf: /ประชาชน/, kind: 'nationalId' },
  { field: 'studentId', leaf: /^(เลขประจำตัวนักเรียน|รหัสนักเรียน|เลขประจำตัว)$/, kind: 'text' },
  { field: 'prefix', leaf: /คำนำหน้า/, kind: 'prefix' },
  { field: 'lastName', leaf: /^(นาม)?สกุล$/, kind: 'text' },
  { field: 'firstName', leaf: /^ชื่อ$/, kind: 'text' },
  { field: 'classNumber', leaf: /^(เลขที่|ที่)$/, kind: 'int' },
  { field: 'bio.gender', leaf: /^เพศ$/, kind: { select: GENDER } },
  { field: 'bio.birthDate', leaf: /เกิด/, kind: 'date' },
  { field: 'bio.enrollDate', leaf: /เข้าศึกษา|เข้าเรียน/, kind: 'date' },
  { field: 'bio.nationality', leaf: /สัญชาติ/, kind: { select: NATION } },
  { field: 'bio.ethnicity', leaf: /เชื้อชาติ/, kind: { select: NATION } },
  { field: 'bio.religion', leaf: /ศาสนา/, kind: { select: RELIGION } },
  { field: 'bio.heightCm', leaf: /ส่วนสูง/, kind: 'number' },
  { field: 'bio.weightKg', leaf: /น้ำหนัก/, kind: 'number' },
  { field: 'bio.program', leaf: /แผนการเรียน/, kind: { select: PROGRAM } },
  { field: 'welfare.studentCondition', leaf: /สภาพนักเรียน/, kind: { select: CONDITION } },
  { field: 'welfare.tuitionRight', leaf: /ค่าเล่าเรียน/, kind: 'text' },
  { field: 'welfare.medicalRight', leaf: /รักษาพยาบาล/, kind: 'text' },
  { field: 'extras.specialAbilities', leaf: /ความสามารถพิเศษ/, kind: 'text' },
  { field: 'extras.scoutType', leaf: /ลูกเสือ|เนตรนารี|ยุวกาชาด/, kind: 'scout' },
  { field: 'cardDates.issueDate', leaf: /ออกบัตร|วันที่ออก/, kind: 'date' },
  { field: 'cardDates.expiryDate', leaf: /หมดอายุ/, kind: 'date' },
]

/** Fields the DLA import manages (for change detection and the "missing columns" check). */
export const EXPECTED_FIELDS = [
  'studentId',
  'nationalId',
  'firstName',
  'lastName',
  'prefix',
  'bio.gender',
  'bio.birthDate',
  'bio.religion',
  'household.father.firstName',
  'household.mother.firstName',
  'addressRegistered.province',
  'addressCurrent.province',
]

const FIELD_LABEL: Record<string, string> = {
  studentId: 'เลขประจำตัวนักเรียน',
  nationalId: 'เลขประจำตัวประชาชน',
  firstName: 'ชื่อ',
  lastName: 'นามสกุล',
  prefix: 'คำนำหน้า',
  'bio.gender': 'เพศ',
  'bio.birthDate': 'วันเกิด',
  'bio.religion': 'ศาสนา',
  'household.father.firstName': 'ชื่อบิดา',
  'household.mother.firstName': 'ชื่อมารดา',
  'addressRegistered.province': 'จังหวัด (ทะเบียนบ้าน)',
  'addressCurrent.province': 'จังหวัด (ที่อยู่ปัจจุบัน)',
}

export const fieldLabel = (field: string): string => FIELD_LABEL[field] ?? field

const leafOf = (path: string): string => {
  const parts = path.split(' / ')
  return parts[parts.length - 1] ?? ''
}

/** The rule for a header path, or null when unmapped. */
export const ruleFor = (path: string): Rule | null => {
  if (!path) return null
  const leaf = leafOf(path)
  const grouped = GROUP_RE.test(path)
  for (const rule of DLA_RULES) {
    if (rule.ctx ? !rule.ctx.test(path) : grouped) continue
    if (rule.leaf.test(leaf)) return rule
  }
  return null
}

const setPath = (obj: Record<string, unknown>, path: string, value: unknown): void => {
  const keys = path.split('.')
  let cur = obj
  for (const k of keys.slice(0, -1)) {
    if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {}
    cur = cur[k] as Record<string, unknown>
  }
  cur[keys[keys.length - 1]] = value
}

/** Values that mean "no" in a yes/no flag column. */
const FALSY = /^(0|-|ไม่|ไม่มี|ไม่ใช่|no|false|n)$/i

const toNumber = (s: string): number | null => {
  const v = thaiDigitsToArabic(s).replace(/[,\s]/g, '').replace(/บาท$/, '')
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : null
}

type Outcome = { ok: true; value?: unknown; warning?: string } | { ok: false; error?: string; warning?: string }

const normalize = (rule: Rule, raw: string, header: string): Outcome => {
  const kind = rule.kind
  if (typeof kind === 'object') {
    const hit = kind.select.find(([re]) => re.test(raw.trim()))
    if (hit) return { ok: true, value: hit[1] }
    return { ok: true, value: 'other', warning: `"${header}": ค่า "${raw}" ไม่อยู่ในตัวเลือก บันทึกเป็น "อื่น ๆ"` }
  }
  switch (kind) {
    case 'text':
      return { ok: true, value: raw }
    case 'phone':
      return { ok: true, value: thaiDigitsToArabic(raw).replace(/\s+/g, '') }
    case 'int': {
      const n = toNumber(raw)
      if (n === null || !Number.isInteger(n)) {
        return { ok: false, warning: `"${header}": อ่านตัวเลข "${raw}" ไม่ได้ (เก็บค่าเดิมไว้)` }
      }
      return { ok: true, value: rule.field.endsWith('postalCode') ? String(n).padStart(5, '0') : n }
    }
    case 'number': {
      const n = toNumber(raw)
      if (n === null) return { ok: false, warning: `"${header}": อ่านตัวเลข "${raw}" ไม่ได้ (เก็บค่าเดิมไว้)` }
      return { ok: true, value: n }
    }
    case 'date': {
      const day = parseBEDate(raw)
      if (day === undefined) return { ok: false, error: `"${header}": วันที่ "${raw}" ไม่ถูกต้อง (ต้องเป็น วว/ดด/ปปปป พ.ศ.)` }
      return { ok: true, value: day }
    }
    case 'prefix': {
      const p = normalizePrefix(raw)
      if (p === undefined) return { ok: false, warning: `"${header}": คำนำหน้า "${raw}" ไม่อยู่ในตัวเลือก (เก็บค่าเดิมไว้)` }
      return { ok: true, value: p ?? undefined }
    }
    case 'nationalId':
      return { ok: true, value: normalizeNationalId(raw) }
    case 'disability':
      return FALSY.test(raw.trim()) ? { ok: true } : { ok: true, value: rule.value }
    case 'scout': {
      const src = FALSY.test(raw.trim()) ? '' : `${raw} ${leafOf(header)}`
      if (!src) return { ok: true }
      if (/ยุวกาชาด/.test(src)) return { ok: true, value: 'red_cross_youth' }
      if (/เนตรนารี/.test(src)) return { ok: true, value: 'girl_guide' }
      return { ok: true, value: 'scout' }
    }
    case 'fullName':
      return { ok: true, value: raw }
  }
}

/** Apply a full name like "นายสมชาย ใจดี" to a parent group. */
const applyFullName = (data: Record<string, unknown>, base: string, raw: string): void => {
  const m = raw.trim().match(/^(นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.)?\s*(\S+)\s*(.*)$/)
  if (!m) return
  if (m[1]) setPath(data, `${base}.prefix`, m[1])
  setPath(data, `${base}.firstName`, m[2])
  if (m[3]) setPath(data, `${base}.lastName`, m[3].trim())
}

const valueAt = (data: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), data)

/** Map one row's cells through `headers`. Shared by classroom sheets and the card sheet. */
const mapCells = (
  headers: string[],
  cells: string[],
  data: Record<string, unknown>,
  unmapped: Record<string, string>,
  warnings: string[],
  errors: string[],
  opts: { only?: (field: string) => boolean; keyPrefix?: string } = {},
): void => {
  headers.forEach((header, i) => {
    const raw = (cells[i] ?? '').trim()
    if (!raw) return
    const key = `${opts.keyPrefix ?? ''}${header || `คอลัมน์ ${i + 1}`}`
    const rule = ruleFor(header)
    if (!rule) {
      unmapped[key] = raw
      return
    }
    if (opts.only && !opts.only(rule.field)) return
    const out = normalize(rule, raw, header)
    if (out.warning) warnings.push(out.warning)
    if (!out.ok) {
      if (out.error) errors.push(out.error)
      unmapped[key] = raw
      return
    }
    if (out.value === undefined) return
    if (rule.kind === 'fullName') return applyFullName(data, rule.field, String(out.value))
    if (rule.kind === 'disability') {
      const list = (valueAt(data, rule.field) as string[] | undefined) ?? []
      if (!list.includes(String(out.value))) setPath(data, rule.field, [...list, out.value])
      return
    }
    setPath(data, rule.field, out.value)
  })
}

export interface MappedSheets {
  rows: MappedRow[]
  unmappedColumns: string[]
  missingColumns: string[]
}

/**
 * Map every classroom-sheet row, joining the card sheet's issue/expiry dates by
 * national ID (fallback studentId). Card columns other than the card dates are
 * duplicates of the data sheets and are not copied; unmapped card columns go to
 * `dlaRaw` under a `card / ` prefix.
 */
export const mapDla = (sheets: DlaSheet[], card: DlaCardSheet | null): MappedSheets => {
  const unmappedColumns = new Set<string>()
  const mappedFields = new Set<string>()
  for (const s of sheets) {
    for (const h of s.headers) {
      const rule = ruleFor(h)
      if (rule) mappedFields.add(rule.kind === 'fullName' ? `${rule.field}.firstName` : rule.field)
      else if (h) unmappedColumns.add(h)
    }
  }

  // Card sheet: index by national ID and studentId.
  const cardBy = new Map<string, { rowNo: number; cells: string[] }>()
  let cardNid = -1
  let cardSid = -1
  if (card) {
    card.headers.forEach((h, i) => {
      const rule = ruleFor(h)
      if (rule?.field === 'nationalId' && cardNid < 0) cardNid = i
      if (rule?.field === 'studentId' && cardSid < 0) cardSid = i
      if (rule && rule.field.startsWith('cardDates.')) mappedFields.add(rule.field)
      if (!rule && h) unmappedColumns.add(`card / ${h}`)
    })
    for (const r of card.rows) {
      const nid = cardNid >= 0 ? normalizeNationalId(r.cells[cardNid]) : ''
      const sid = cardSid >= 0 ? (r.cells[cardSid] ?? '').trim() : ''
      if (nid) cardBy.set(`n:${nid}`, r)
      if (sid) cardBy.set(`s:${sid}`, r)
    }
  }

  const rows: MappedRow[] = []
  for (const s of sheets) {
    for (const src of s.rows) {
      const data: Record<string, unknown> = {}
      const unmapped: Record<string, string> = {}
      const warnings: string[] = []
      const errors: string[] = []
      mapCells(s.headers, src.cells, data, unmapped, warnings, errors)

      const nationalId = String(data.nationalId ?? '')
      const studentId = String(data.studentId ?? '')
      const cardRow = (nationalId && cardBy.get(`n:${nationalId}`)) || (studentId && cardBy.get(`s:${studentId}`))
      if (card && cardRow) {
        mapCells(card.headers, cardRow.cells, data, unmapped, warnings, errors, {
          only: (f) => f.startsWith('cardDates.'),
          keyPrefix: 'card / ',
        })
      }

      rows.push({
        sheet: src.sheet,
        rowNo: src.rowNo,
        level: src.level,
        room: src.room,
        studentId,
        nationalId,
        name: `${data.prefix ?? ''}${data.firstName ?? ''} ${data.lastName ?? ''}`.trim(),
        data,
        unmapped,
        warnings,
        errors,
      })
    }
  }

  const missingColumns = EXPECTED_FIELDS.filter((f) => !mappedFields.has(f)).map(fieldLabel)
  return { rows, unmappedColumns: [...unmappedColumns], missingColumns }
}
