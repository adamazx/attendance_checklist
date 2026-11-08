/**
 * Decide what a DLA import would do — pure, no I/O, unit-tested.
 *
 * National ID is the dedupe key (studentId had cross-room duplicates):
 *  - row errors (missing / non-13-digit national ID, bad date, missing name or
 *    studentId, unknown classroom) → `errors`, not written;
 *  - the same national ID more than once in the file: identical rows collapse
 *    (`duplicates`); rows that differ (e.g. two rooms) → `conflicts`, all skipped;
 *  - one studentId with different national IDs in the file → every such row in
 *    `idConflicts` (checked before row validation, so error rows are included);
 *  - studentId ↔ nationalId disagreement against the DB → `idConflicts`, skipped;
 *  - otherwise create, update (national ID match, or a DB student with the same
 *    studentId and no national ID yet = link), or unchanged.
 * Students in the DB but not in the file are left alone.
 */
import { isNationalIdFormat, maskNationalId, nationalIdChecksumOk } from '../nationalId.ts'

import type { DlaEntry, DlaIssue, DlaPlan, ExistingStudent, MappedRow } from './types.ts'

export type RoomResolver = (level: number, room: number) => { id: number | string; name: string } | { error: string }

/** Flatten nested data to `path → value` (arrays kept whole). */
export const flatten = (obj: Record<string, unknown>, prefix = ''): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v as Record<string, unknown>, path))
    else out[path] = v
  }
  return out
}

/** JSON with sorted object keys (Postgres jsonb does not keep key order). */
const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, val: unknown) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : val,
  )

/**
 * The comparable view of student data: groups flattened to paths, `dlaRaw` as one
 * stable string, empty values as null. Used for both the incoming row and the DB doc.
 */
export const compareView = (data: Record<string, unknown>): Record<string, unknown> => {
  const { dlaRaw, ...rest } = data
  const flat = flatten(rest)
  if (dlaRaw !== undefined) flat.dlaRaw = dlaRaw == null ? null : stable(dlaRaw)
  return flat
}

const same = (a: unknown, b: unknown): boolean => {
  const norm = (v: unknown) => (v === '' || v === undefined ? null : Array.isArray(v) ? [...v].sort() : v)
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b))
}

/** Stable comparison key for a row's data, ignoring the fields that differ per room. */
const contentKey = (row: MappedRow, ignoreRoom: boolean): string => {
  const flat = flatten(row.data)
  if (ignoreRoom) delete flat.classNumber
  const base = ignoreRoom ? '' : `${row.level}/${row.room}|`
  return base + JSON.stringify(Object.keys(flat).sort().map((k) => [k, flat[k]]))
}

export const planDla = (rows: MappedRow[], existing: ExistingStudent[], resolveRoom: RoomResolver): DlaPlan => {
  const plan: DlaPlan = {
    creates: [],
    updates: [],
    unchanged: [],
    conflicts: [],
    idConflicts: [],
    duplicates: [],
    errors: [],
    writes: [],
  }
  const issue = (row: MappedRow, message: string): DlaIssue => ({
    sheet: row.sheet,
    row: row.rowNo,
    studentId: row.studentId || undefined,
    nationalIdMasked: row.nationalId ? maskNationalId(row.nationalId) : undefined,
    name: row.name || undefined,
    message,
  })

  // 0. studentId shared by different national IDs anywhere in the file — checked over
  //    ALL rows before validation, so every row of such a group is skipped the same
  //    way even when one of them also has a row error. (Two DLA records with one
  //    studentId: the school must correct DLA.) Same studentId + same national ID
  //    is the national-ID dedupe's case (step 2), not this one.
  const sidRows = new Map<string, MappedRow[]>()
  for (const row of rows) {
    if (row.studentId) sidRows.set(row.studentId, [...(sidRows.get(row.studentId) ?? []), row])
  }
  const sharedSid = new Set(
    [...sidRows].filter(([, rs]) => new Set(rs.map((r) => r.nationalId)).size > 1).map(([sid]) => sid),
  )

  // 1. Row-level validation.
  const valid: Array<{ row: MappedRow; room: { id: number | string; name: string }; warnings: string[] }> = []
  for (const row of rows) {
    if (sharedSid.has(row.studentId)) {
      const where = (sidRows.get(row.studentId) ?? []).map((r) => `${r.sheet} แถว ${r.rowNo}`).join(', ')
      const rowErrs = row.errors.length > 0 ? ` · แถวนี้มีข้อผิดพลาดด้วย: ${row.errors.join(' · ')}` : ''
      plan.idConflicts.push(
        issue(
          row,
          `เลขประจำตัวนักเรียน ${row.studentId} ถูกใช้กับเลขประจำตัวประชาชนหลายเลขในไฟล์ (${where}) — ข้าม โปรดแก้ไขใน DLA${rowErrs}`,
        ),
      )
      continue
    }
    const errs = [...row.errors]
    const warnings = [...row.warnings]
    if (!row.nationalId) errs.unshift('ไม่มีเลขประจำตัวประชาชน')
    else if (!isNationalIdFormat(row.nationalId)) errs.unshift(`เลขประจำตัวประชาชน "${row.nationalId}" ต้องเป็นตัวเลข 13 หลัก`)
    else if (!nationalIdChecksumOk(row.nationalId)) warnings.push('เลขประจำตัวประชาชนไม่ผ่านการตรวจหลักสุดท้าย (checksum) — โปรดตรวจสอบ')
    if (!row.studentId) errs.push('ไม่มีเลขประจำตัวนักเรียน')
    if (!row.data.firstName) errs.push('ไม่มีชื่อ')
    if (!row.data.lastName) errs.push('ไม่มีนามสกุล')
    const room = resolveRoom(row.level, row.room)
    if ('error' in room) errs.push(`ชีต ${row.sheet}: ${room.error}`)
    if (errs.length > 0 || 'error' in room) {
      plan.errors.push(issue(row, errs.join(' · ')))
      continue
    }
    valid.push({ row, room, warnings })
  }

  // 2. In-file dedupe by national ID.
  const byNid = new Map<string, typeof valid>()
  for (const v of valid) byNid.set(v.row.nationalId, [...(byNid.get(v.row.nationalId) ?? []), v])
  const unique: typeof valid = []
  for (const group of byNid.values()) {
    if (group.length === 1) {
      unique.push(group[0])
      continue
    }
    const keys = new Set(group.map((g) => contentKey(g.row, false)))
    if (keys.size === 1) {
      unique.push(group[0])
      for (const g of group.slice(1)) {
        plan.duplicates.push(issue(g.row, `ซ้ำทุกช่องกับชีต ${group[0].row.sheet} แถว ${group[0].row.rowNo} — ใช้แถวแรก`))
      }
      continue
    }
    const where = group.map((g) => `${g.row.sheet} แถว ${g.row.rowNo}`).join(', ')
    const roomOnly = new Set(group.map((g) => contentKey(g.row, true))).size === 1
    for (const g of group) {
      plan.conflicts.push(
        issue(
          g.row,
          roomOnly
            ? `พบเลขประจำตัวประชาชนนี้ในหลายห้อง (${where}) — ข้าม โปรดแก้ไขให้เหลือห้องเดียว`
            : `เลขประจำตัวประชาชนซ้ำแต่ข้อมูลไม่ตรงกัน (${where}) — ข้าม`,
        ),
      )
    }
  }

  // 3. Match against the DB.
  const dbByNid = new Map(existing.filter((e) => e.nationalId).map((e) => [e.nationalId as string, e]))
  const dbBySid = new Map(existing.map((e) => [e.studentId, e]))

  for (const { row, room, warnings } of unique) {
    const byN = dbByNid.get(row.nationalId)
    const byS = dbBySid.get(row.studentId)
    let target: ExistingStudent | undefined
    let link = false
    if (byN) {
      if (byN.studentId !== row.studentId) {
        plan.idConflicts.push(
          issue(row, `เลขประจำตัวประชาชนนี้เป็นของนักเรียนเลขประจำตัว ${byN.studentId} ในระบบ แต่ไฟล์ระบุ ${row.studentId} — ข้าม`),
        )
        continue
      }
      target = byN
    } else if (byS) {
      if (byS.nationalId) {
        plan.idConflicts.push(
          issue(row, `เลขประจำตัวนักเรียน ${row.studentId} ในระบบมีเลขประจำตัวประชาชนอื่นอยู่แล้ว (${maskNationalId(byS.nationalId)}) — ข้าม`),
        )
        continue
      }
      target = byS
      link = true
    }

    const data: Record<string, unknown> = {
      ...row.data,
      classroom: room.id,
      dlaRaw: { sheet: row.sheet, row: row.rowNo, unmapped: row.unmapped },
    }
    const entry: DlaEntry = {
      sheet: row.sheet,
      row: row.rowNo,
      studentId: row.studentId,
      nationalIdMasked: maskNationalId(row.nationalId),
      name: row.name,
      classroom: room.name,
      action: target ? 'update' : 'create',
      warnings,
    }

    if (!target) {
      plan.creates.push(entry)
      plan.writes.push({ entry, data })
      continue
    }

    const incoming = compareView(data)
    const changed = Object.keys(incoming).filter((k) => !same(incoming[k], target.flat[k]))
    entry.targetId = target.id
    entry.changedFields = changed
    if (link) entry.link = true
    if (changed.length === 0) {
      plan.unchanged.push(entry)
      continue
    }
    plan.updates.push(entry)
    plan.writes.push({ entry, data })
  }

  const byRow = (a: { sheet: string; row: number }, b: { sheet: string; row: number }) =>
    a.sheet.localeCompare(b.sheet, 'en', { numeric: true }) || a.row - b.row
  for (const list of [plan.creates, plan.updates, plan.unchanged, plan.conflicts, plan.idConflicts, plan.duplicates, plan.errors]) {
    list.sort(byRow)
  }
  return plan
}
