/**
 * SYNTHETIC workbook mirroring the REAL DLA export's layout — fake z-prefixed
 * students, fake national IDs. Never real data. Complements `syntheticDla.ts`
 * (which mirrors the documented layout).
 *
 * Layout quirks reproduced from the real file (headers only):
 *  - header row 1 is a report title merged horizontally from column 0 across most
 *    (not all) columns; row 2 = column / group labels; row 3 = sub-labels
 *  - the national-ID header is misspelled "เลขประจำตัวประชาขน"
 *  - special abilities and scout / red-cross are sub-columns of a group label
 *  - card sheet: one header row, "ชื่อ-สกุล" full name, `dd/mm/yy` dates in "ออก" / "หมด"
 *
 * Planted cases:
 *  - zr001 male, scout branch "ลูกเสือ-เนตรนารี" → scout; music ability; unmapped
 *    "หมายเลขอ้างอิง" holds a 13-digit value (must never reach dlaRaw)
 *  - zr002 female, "ลูกเสือ-เนตรนารี" → girl_guide; two ability columns
 *  - zr003 not a scout, red-cross member → red_cross_youth; enrollment date in ค.ศ.
 *    (2024) → warning, field empty, student kept
 *  - zr100 on d1-1 and d1-2 with DIFFERENT national IDs (shared studentId); the d1-2
 *    row also has a bad birth date → both rows idConflicts
 *  - zr004 card issue date unreadable → warning, kept; red-cross cell with the
 *    negative mid-text ("สมาชิก (ไม่เป็น)") → not a member
 *  - `d5-3-` stale copy → skipped
 *  - top-level "สถานภาพ" (parents' status): zr001 อยู่ด้วยกัน → both married; zr002
 *    บิดาถึงแก่กรรม → father only; zr003 "บิดา - มารดา ถึงแก่กรรม" (spacing variant)
 *    → both deceased; zr004 หย่าร้าง but its "มารดา / สถานภาพ" column says สมรส →
 *    mother kept married + warning; zr100 (d1-1) unknown label → warning, kept raw
 */
import * as XLSX from 'xlsx'

import { withCheckDigit } from './syntheticDla.ts'

export const REAL_TITLE = 'รายงานรายละเอียดข้อมูลนักเรียนของโรงเรียนสังกัดองค์กรปกครองส่วนท้องถิ่น'
export const REAL_NID_HEADER = 'เลขประจำตัวประชาขน'

export const REAL_IDS = {
  zr001: withCheckDigit('980000000001'),
  zr002: withCheckDigit('980000000002'),
  zr003: withCheckDigit('980000000003'),
  zr004: withCheckDigit('980000000004'),
  zr100a: withCheckDigit('980000000100'),
  zr100b: withCheckDigit('980000000101'),
  /** A fake 13-digit value in an unmapped column. */
  ref: '9800000009999',
}

/** [row-2 label, row-3 sub-label?]. Consecutive equal row-2 labels with sub-labels merge. */
const COLS: Array<[string, string?]> = [
  ['ลำดับที่'],
  ['จังหวัด'],
  ['ORG_CODE'],
  ['เลขประจำตัวนักเรียน'],
  ['เพศ'],
  ['คำนำหน้า'],
  ['ชื่อ'],
  ['นามสกุล'],
  ['วัน/เดือน/ปี เกิด'],
  [REAL_NID_HEADER],
  ['วัน/เดือน/ปี ที่เข้าศึกษา'],
  ['ชั้นปี'],
  ['ความสามารถพิเศษ', 'ดนตรี(ระบุ)'],
  ['ความสามารถพิเศษ', 'กีฬา(ระบุ)'],
  ['ลูกเสือ / เนตรนารี', 'เหล่า'],
  ['ลูกเสือ / เนตรนารี', 'ประเภท'],
  ['ยุวกาชาด', 'ประเภทสมาชิก'],
  ['ยุวกาชาด', 'ระดับ'],
  ['บิดา', 'ชื่อ'],
  ['บิดา', 'นามสกุล'],
  ['มารดา', 'สถานภาพ'],
  ['สถานภาพ'],
  ['หมายเลขอ้างอิง'],
  ['ผู้ปกครอง', 'คำนำหน้า'],
  // ---- the title merge ends at the column above (as in the real file) ----
  ['ผู้ปกครอง', 'ชื่อ'],
  ['ที่อยู่ปัจจุบัน', 'จังหวัด'],
]
const TITLE_END = COLS.findIndex(([a, b]) => a === 'ผู้ปกครอง' && b === 'คำนำหน้า')

const header = (): { rows: string[][]; merges: XLSX.Range[] } => {
  const rows: string[][] = [COLS.map(() => ''), COLS.map(() => ''), COLS.map(() => '')]
  const merges: XLSX.Range[] = []
  rows[0][0] = REAL_TITLE
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: TITLE_END } })
  COLS.forEach(([label, sub], c) => {
    if (!sub) {
      rows[1][c] = label
      merges.push({ s: { r: 1, c }, e: { r: 2, c } })
      return
    }
    rows[2][c] = sub
    if (COLS[c - 1]?.[0] === label && COLS[c - 1]?.[1]) return
    let end = c
    while (COLS[end + 1]?.[0] === label && COLS[end + 1]?.[1]) end++
    rows[1][c] = label
    if (end > c) merges.push({ s: { r: 1, c }, e: { r: 1, c: end } })
  })
  return { rows, merges }
}

interface Fake {
  sid: string
  nid: string
  male: boolean
  birth?: string
  enroll?: string
  music?: string
  sport?: string
  scout?: string
  scoutType?: string
  redCross?: string
  ref?: string
  /** Top-level สถานภาพ (parents' status). Default อยู่ด้วยกัน. */
  status?: string
  /** Per-parent "มารดา / สถานภาพ". */
  motherStatus?: string
}

const row = (no: number, s: Fake): Array<string | number> => [
  no,
  'ขอนแก่น',
  'Z0000',
  s.sid,
  s.male ? 'ชาย' : 'หญิง',
  s.male ? 'เด็กชาย' : 'เด็กหญิง',
  `zนักเรียน${s.sid}`,
  'zทดสอบ',
  s.birth ?? '15/03/2557',
  s.nid,
  s.enroll ?? '16/05/2567',
  'ม.1',
  s.music ?? '',
  s.sport ?? '',
  s.scout ?? '',
  s.scoutType ?? '',
  s.redCross ?? '',
  '',
  `zบิดา${s.sid}`,
  'zทดสอบ',
  s.motherStatus ?? '',
  s.status ?? 'อยู่ด้วยกัน',
  s.ref ?? '',
  'นาง',
  `zผู้ปกครอง${s.sid}`,
  'ขอนแก่น',
]

const sheet = (students: Fake[]): XLSX.WorkSheet => {
  const h = header()
  const ws = XLSX.utils.aoa_to_sheet([...h.rows, ...students.map((s, i) => row(i + 1, s))])
  ws['!merges'] = h.merges
  return ws
}

export const buildRealLayoutDla = (bookType: 'xls' | 'xlsx' = 'xls'): ArrayBuffer => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    sheet([
      { sid: 'zr001', nid: REAL_IDS.zr001, male: true, music: 'zกีตาร์', scout: 'ลูกเสือ-เนตรนารี', scoutType: 'สามัญ', redCross: 'ไม่เป็นยุวกาชาด', ref: REAL_IDS.ref },
      { sid: 'zr002', nid: REAL_IDS.zr002, male: false, music: 'zร้องเพลง', sport: 'zฟุตบอล', scout: 'ลูกเสือ-เนตรนารี', redCross: 'ไม่เป็นยุวกาชาด', status: 'บิดาถึงแก่กรรม' },
      { sid: 'zr003', nid: REAL_IDS.zr003, male: false, enroll: '16/05/2024', scout: 'ไม่เป็นลูกเสือ-เนตรนารี', redCross: 'ยุวกาชาด', status: 'บิดา - มารดา ถึงแก่กรรม' },
      { sid: 'zr100', nid: REAL_IDS.zr100a, male: true, status: 'zไม่ทราบสถานะ' },
    ]),
    'd1-1',
  )
  XLSX.utils.book_append_sheet(
    wb,
    sheet([
      { sid: 'zr100', nid: REAL_IDS.zr100b, male: true, birth: '31/02/2557' },
      { sid: 'zr004', nid: REAL_IDS.zr004, male: true, scout: 'ไม่เป็นลูกเสือ-เนตรนารี', redCross: 'สมาชิก (ไม่เป็น)', status: 'หย่าร้าง', motherStatus: 'สมรส' },
    ]),
    'd1-2',
  )
  XLSX.utils.book_append_sheet(wb, sheet([{ sid: 'zr001', nid: REAL_IDS.zr001, male: true }]), 'd5-3-')
  const card = (sid: string, nid: string, issue = '12/05/68', expiry = '31/03/71') => [
    'z',
    1,
    `เด็กชายzนักเรียน${sid} zทดสอบ`,
    sid,
    nid,
    'ม.1/1',
    '15/03/2557',
    issue,
    expiry,
  ]
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['', 'ลำดับที่', 'ชื่อ-สกุล', 'รหัสนักเรียน', 'บัตรประชาชน', 'ชั้น', 'วันเกิด', 'ออก', 'หมด'],
      card('zr001', REAL_IDS.zr001),
      card('zr002', REAL_IDS.zr002),
      card('zr003', REAL_IDS.zr003),
      card('zr004', REAL_IDS.zr004, '32/13/68'),
    ]),
    'card',
  )
  return XLSX.write(wb, { type: 'array', bookType }) as ArrayBuffer
}
