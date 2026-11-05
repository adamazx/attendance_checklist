/**
 * SYNTHETIC DLA-format workbook for tests and local dry runs — fake z-prefixed
 * students with fake (checksum-valid unless noted) national IDs. Never real data.
 *
 * Layout mirrors the DLA export: classroom sheets `d{level}-{room}` with a 3-row
 * merged header (data from row 4), a stale `d5-3-` copy, and a `card` sheet.
 *
 * Planted cases:
 *  - z0001, z0002 (Islam), z0006 (checksum fails → warning) — valid, `d1-1`/`d1-2`
 *  - z0003 in both d1-1 and d1-2 → cross-room conflict
 *  - z0004 bad birth date (31/02/2557) → error
 *  - z0005 no national ID → error
 *  - z0007 in `d6-9` (no such classroom) → error
 *  - `d5-3-` → skipped sheet
 *  - column "หมายเหตุพิเศษ" → unmapped (kept in dlaRaw)
 *  - all disability / scout columns empty
 */
import * as XLSX from 'xlsx'

/** Append the Thai national-ID check digit to 12 digits. */
export const withCheckDigit = (twelve: string): string => {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(twelve[i]) * (13 - i)
  return `${twelve}${(11 - (sum % 11)) % 10}`
}

export const FAKE_IDS = {
  z0001: withCheckDigit('990000000001'),
  z0002: withCheckDigit('990000000002'),
  z0003: withCheckDigit('990000000003'),
  z0004: withCheckDigit('990000000004'),
  z0006: (() => {
    const ok = withCheckDigit('990000000006')
    return `${ok.slice(0, 12)}${(Number(ok[12]) + 1) % 10}` // deliberately wrong check digit
  })(),
  z0007: withCheckDigit('990000000007'),
}

type Col = { top: string; mid?: string; leaf?: string }

const DISABILITIES = [
  'การมองเห็น',
  'การได้ยิน',
  'สติปัญญา',
  'ร่างกายหรือสุขภาพ',
  'การเรียนรู้',
  'การพูดและภาษา',
  'พฤติกรรมหรืออารมณ์',
  'ออทิสติก',
  'พิการซ้อน',
]
const PARENT_LEAVES = ['คำนำหน้า', 'ชื่อ', 'นามสกุล', 'ศาสนา', 'อาชีพ', 'รายได้/เดือน', 'เบอร์โทรศัพท์', 'สถานภาพ']
const ADDRESS_LEAVES = ['บ้านเลขที่', 'หมู่', 'ถนน', 'ตำบล', 'อำเภอ', 'จังหวัด', 'รหัสไปรษณีย์']

const COLUMNS: Col[] = [
  { top: 'เลขที่' },
  { top: 'เลขประจำตัวนักเรียน' },
  { top: 'เลขประจำตัวประชาชน' },
  { top: 'คำนำหน้า' },
  { top: 'ชื่อ' },
  { top: 'นามสกุล' },
  { top: 'เพศ' },
  { top: 'วันเกิด' },
  { top: 'สัญชาติ' },
  { top: 'เชื้อชาติ' },
  { top: 'ศาสนา' },
  { top: 'ส่วนสูง' },
  { top: 'น้ำหนัก' },
  { top: 'แผนการเรียน' },
  { top: 'วันเข้าศึกษา' },
  { top: 'สภาพนักเรียน' },
  { top: 'สิทธิเบิกค่าเล่าเรียน' },
  { top: 'สิทธิเบิกค่ารักษาพยาบาล' },
  { top: 'ความสามารถพิเศษ' },
  ...DISABILITIES.map((d) => ({ top: 'ประเภทความพิการ', mid: d })),
  { top: 'ลูกเสือ/เนตรนารี/ยุวกาชาด' },
  ...PARENT_LEAVES.map((l) => ({ top: 'ข้อมูลครอบครัว', mid: 'บิดา', leaf: l })),
  ...PARENT_LEAVES.map((l) => ({ top: 'ข้อมูลครอบครัว', mid: 'มารดา', leaf: l })),
  ...[...PARENT_LEAVES, 'ความเกี่ยวข้อง'].map((l) => ({ top: 'ข้อมูลครอบครัว', mid: 'ผู้ปกครอง', leaf: l })),
  ...ADDRESS_LEAVES.map((l) => ({ top: 'ที่อยู่', mid: 'ตามทะเบียนบ้าน', leaf: l })),
  ...ADDRESS_LEAVES.map((l) => ({ top: 'ที่อยู่', mid: 'ปัจจุบัน', leaf: l })),
  { top: 'หมายเหตุพิเศษ' },
]

/** Build the 3 header rows + merges (vertical for single-level, horizontal for groups). */
const header = (): { rows: string[][]; merges: XLSX.Range[] } => {
  const rows: string[][] = [[], [], []]
  const merges: XLSX.Range[] = []
  COLUMNS.forEach((c, i) => {
    rows[0][i] = ''
    rows[1][i] = ''
    rows[2][i] = ''
    if (!c.mid) {
      rows[0][i] = c.top
      merges.push({ s: { r: 0, c: i }, e: { r: 2, c: i } })
    } else if (!c.leaf) {
      rows[1][i] = c.mid
      merges.push({ s: { r: 1, c: i }, e: { r: 2, c: i } })
    } else {
      rows[2][i] = c.leaf
    }
  })
  // Horizontal merges for group (row 0) and sub-group (row 1) labels.
  const span = (row: 0 | 1, key: (c: Col) => string | undefined) => {
    let start = -1
    COLUMNS.forEach((c, i) => {
      const k = key(c)
      const next = COLUMNS[i + 1]
      if (k === undefined) return
      if (start < 0) start = i
      if (!next || key(next) !== k) {
        rows[row][start] = row === 0 ? c.top : (c.mid ?? '')
        if (i > start) merges.push({ s: { r: row, c: start }, e: { r: row, c: i } })
        start = -1
      }
    })
  }
  span(0, (c) => (c.mid ? c.top : undefined))
  span(1, (c) => (c.leaf ? `${c.top}|${c.mid}` : undefined))
  return { rows, merges }
}

interface FakeStudent {
  no: number
  sid: string
  nid: string
  prefix: string
  first: string
  last: string
  gender: string
  birth: string
  religion: string
  note?: string
}

const row = (s: FakeStudent): Array<string | number> => {
  const parent = (p: string, first: string, income: number) => [p, first, s.last, s.religion, 'เกษตรกร', income, '0812345678', 'สมรส']
  return [
    s.no,
    s.sid,
    s.nid,
    s.prefix,
    s.first,
    s.last,
    s.gender,
    s.birth,
    'ไทย',
    'ไทย',
    s.religion,
    150,
    45,
    'ทั่วไป',
    '16/05/2569',
    'ปกติ',
    'เบิกได้',
    'บัตรทอง',
    '',
    ...DISABILITIES.map(() => ''),
    '',
    ...parent('นาย', `zบิดา${s.sid}`, 9000),
    ...parent('นาง', `zมารดา${s.sid}`, 8000),
    ...parent('นาง', `zผู้ปกครอง${s.sid}`, 8000),
    'มารดา',
    '99',
    '1',
    '',
    'โนนหัน',
    'ชุมแพ',
    'ขอนแก่น',
    '40290',
    '99',
    '1',
    '',
    'โนนหัน',
    'ชุมแพ',
    'ขอนแก่น',
    '40290',
    s.note ?? '',
  ]
}

const z = (no: number, sid: string, nid: string, extra: Partial<FakeStudent> = {}): FakeStudent => ({
  no,
  sid,
  nid,
  prefix: 'ด.ช.',
  first: `zนักเรียน${sid}`,
  last: 'zทดสอบ',
  gender: 'ชาย',
  birth: '15/03/2557',
  religion: 'พุทธ',
  ...extra,
})

const sheet = (students: FakeStudent[]): XLSX.WorkSheet => {
  const h = header()
  const ws = XLSX.utils.aoa_to_sheet([...h.rows, ...students.map(row)])
  ws['!merges'] = h.merges
  return ws
}

export const buildSyntheticDla = (bookType: 'xls' | 'xlsx' = 'xls'): ArrayBuffer => {
  const z3 = z(3, 'z0003', FAKE_IDS.z0003)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    sheet([
      z(1, 'z0001', FAKE_IDS.z0001, { note: 'ข้อมูลทดสอบ' }),
      z(2, 'z0002', FAKE_IDS.z0002, { prefix: 'ด.ญ.', gender: 'หญิง', religion: 'อิสลาม', birth: '01/12/2556' }),
      z3,
      z(4, 'z0004', FAKE_IDS.z0004, { birth: '31/02/2557' }),
      z(5, 'z0005', ''),
    ]),
    'd1-1',
  )
  XLSX.utils.book_append_sheet(wb, sheet([{ ...z3, no: 1 }, z(2, 'z0006', FAKE_IDS.z0006)]), 'd1-2')
  XLSX.utils.book_append_sheet(wb, sheet([z(1, 'z0099', withCheckDigit('990000000099'))]), 'd5-3-')
  XLSX.utils.book_append_sheet(wb, sheet([z(1, 'z0007', FAKE_IDS.z0007)]), 'd6-9')
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['เลขประจำตัวประชาชน', 'ชื่อ', 'วันออกบัตร', 'วันหมดอายุ'],
      [FAKE_IDS.z0001, 'zนักเรียนz0001', '01/06/2569', '31/05/2572'],
      [FAKE_IDS.z0002, 'zนักเรียนz0002', '01/06/2569', '31/05/2572'],
    ]),
    'card',
  )
  return XLSX.write(wb, { type: 'array', bookType }) as ArrayBuffer
}
