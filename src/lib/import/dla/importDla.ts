/**
 * DLA student-master import: parse → map → plan (dry run) → optional confirmed write.
 *
 * The dry run is the deliverable: it never writes. A write requires the SHA-256 of
 * the previewed file (`confirmHash`), so it can only ever apply the exact file the
 * admin reviewed. Writes go through the Local API with `overrideAccess: false` as
 * the admin user, like the roster importer.
 */
import { createHash } from 'node:crypto'

import type { Payload, PayloadRequest, RequiredDataFromCollectionSlug } from 'payload'

import { buildClassroomIndex, loadActiveYear, resolveClassroom } from '../shared'

import { mapDla } from './dlaMapping'
import { parseDla } from './parseDla'
import { compareView, planDla } from './planDla'
import type { DlaImportResult, DlaIssue, ExistingStudent } from './types'

export const hashFile = (bytes: ArrayBuffer): string => createHash('sha256').update(new Uint8Array(bytes)).digest('hex')

const emptyResult = (dryRun: boolean, fileHash: string): DlaImportResult => ({
  dryRun,
  fileHash,
  sheets: [],
  skippedSheets: [],
  unmappedColumns: [],
  missingColumns: [],
  creates: [],
  updates: [],
  unchanged: [],
  conflicts: [],
  idConflicts: [],
  duplicates: [],
  errors: [],
  summary: { rows: 0, creates: 0, updates: 0, unchanged: 0, conflicts: 0, idConflicts: 0, duplicates: 0, errors: 0 },
})

/** The Student fields the importer compares/overwrites (everything but bookkeeping). */
const IGNORED_KEYS = new Set(['id', 'createdAt', 'updatedAt', 'status', 'nationalIdMasked'])

export const importDla = async (
  payload: Payload,
  user: PayloadRequest['user'],
  bytes: ArrayBuffer,
  opts: { dryRun: boolean; confirmHash?: string },
): Promise<DlaImportResult> => {
  const fileHash = hashFile(bytes)
  const result = emptyResult(opts.dryRun, fileHash)

  if (!opts.dryRun && opts.confirmHash !== fileHash) {
    result.fatal = 'ไฟล์ไม่ตรงกับไฟล์ที่ตรวจสอบตัวอย่างไว้ โปรดตรวจสอบตัวอย่าง (dry run) ใหม่ก่อนยืนยัน'
    return result
  }

  const parsed = parseDla(bytes)
  result.sheets = parsed.sheets.map((s) => ({ name: s.name, rows: s.rows.length }))
  result.skippedSheets = parsed.skippedSheets
  if (parsed.sheets.length === 0) {
    result.fatal = 'ไม่พบชีตห้องเรียน (ชื่อชีตรูปแบบ d1-1 … d6-2) ในไฟล์'
    return result
  }

  const activeYear = await loadActiveYear(payload, user)
  if ('fatal' in activeYear) {
    result.fatal = activeYear.fatal
    return result
  }
  const index = await buildClassroomIndex(payload, user, activeYear.id)

  const existingDocs = await payload.find({
    collection: 'students',
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: false,
    user,
  })
  const existing: ExistingStudent[] = existingDocs.docs.map((doc) => {
    const rest = Object.fromEntries(
      Object.entries(doc as unknown as Record<string, unknown>).filter(([k]) => !IGNORED_KEYS.has(k)),
    )
    return {
      id: doc.id,
      studentId: doc.studentId,
      nationalId: doc.nationalId ?? null,
      flat: compareView(rest),
    }
  })

  const mapped = mapDla(parsed.sheets, parsed.card)
  result.unmappedColumns = mapped.unmappedColumns
  result.missingColumns = mapped.missingColumns

  const plan = planDla(mapped.rows, existing, (level, room) => {
    const r = resolveClassroom(`${level}/${room}`, index)
    return 'error' in r ? r : { id: r.id, name: index.names.get(r.id) ?? `ม.${level}/${room}` }
  })

  Object.assign(result, {
    creates: plan.creates,
    updates: plan.updates,
    unchanged: plan.unchanged,
    conflicts: plan.conflicts,
    idConflicts: plan.idConflicts,
    duplicates: plan.duplicates,
    errors: plan.errors,
  })
  result.summary = {
    rows: mapped.rows.length,
    creates: plan.creates.length,
    updates: plan.updates.length,
    unchanged: plan.unchanged.length,
    conflicts: plan.conflicts.length,
    idConflicts: plan.idConflicts.length,
    duplicates: plan.duplicates.length,
    errors: plan.errors.length,
  }

  if (opts.dryRun) return result

  // Confirmed write — per row, so one bad row doesn't block the rest.
  const written = { created: 0, updated: 0, failed: [] as DlaIssue[] }
  for (const { entry, data } of plan.writes) {
    try {
      if (entry.action === 'create') {
        await payload.create({
          collection: 'students',
          // Values were normalized to the collection's option values by the mapping.
          data: data as RequiredDataFromCollectionSlug<'students'>,
          overrideAccess: false,
          user,
        })
        written.created++
      } else {
        await payload.update({
          collection: 'students',
          id: entry.targetId as number,
          data: data as Partial<RequiredDataFromCollectionSlug<'students'>>,
          overrideAccess: false,
          user,
        })
        written.updated++
      }
    } catch (err) {
      written.failed.push({
        sheet: entry.sheet,
        row: entry.row,
        studentId: entry.studentId,
        nationalIdMasked: entry.nationalIdMasked,
        name: entry.name,
        message: `บันทึกไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }
  result.written = written
  return result
}
