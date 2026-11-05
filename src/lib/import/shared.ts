/**
 * Pieces shared by the roster importer (phase-1b) and the DLA importer: the single
 * active academic year, and classroom-cell → classroom-id resolution within it.
 * Every read runs with `overrideAccess: false` as the importing user.
 */
import type { Payload, PayloadRequest } from 'payload'

import { classroomKeyFromCell, thaiDigitsToArabic } from './studentMapping'

export interface ClassroomIndex {
  /** canonical key "level/room" or compact name → list of classroom ids */
  byKey: Map<string, Array<string | number>>
  /** classroom id → display name, for result messages */
  names: Map<string | number, string>
}

/** The one active academic year's id, or a Thai fatal message. */
export const loadActiveYear = async (
  payload: Payload,
  user: PayloadRequest['user'],
): Promise<{ id: string | number } | { fatal: string }> => {
  // Imports target the ACTIVE academic year, so classroom names resolve to that
  // year's rooms only. Require exactly one active year; otherwise it's ambiguous
  // which year to import into.
  const activeYears = await payload.find({
    collection: 'academic-years',
    where: { isActive: { equals: true } },
    depth: 0,
    limit: 2,
    pagination: false,
    overrideAccess: false,
    user,
  })
  if (activeYears.docs.length === 0) {
    return { fatal: 'ยังไม่ได้กำหนดปีการศึกษาที่ใช้งานอยู่ (isActive) โปรดตั้งค่าก่อนนำเข้า' }
  }
  if (activeYears.docs.length > 1) {
    return {
      fatal: 'มีปีการศึกษาที่ใช้งานอยู่ (isActive) มากกว่าหนึ่งปี โปรดตั้งให้เหลือเพียงปีเดียวก่อนนำเข้า',
    }
  }
  return { id: (activeYears.docs[0] as { id: string | number }).id }
}

export const buildClassroomIndex = async (
  payload: Payload,
  user: PayloadRequest['user'],
  academicYearId: string | number,
): Promise<ClassroomIndex> => {
  // Scope to a single academic year so a recurring room (e.g. "ม.4/2" present in
  // several years) resolves to exactly one classroom instead of being ambiguous.
  const res = await payload.find({
    collection: 'classrooms',
    where: { academicYear: { equals: academicYearId } },
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: false,
    user,
  })

  const byKey = new Map<string, Array<string | number>>()
  const names = new Map<string | number, string>()
  const add = (key: string, id: string | number) => {
    const list = byKey.get(key) ?? []
    // The level/room key and the name-derived key can coincide (both "5/97"):
    // only record a classroom once per key so a single room is not seen as
    // ambiguous. Genuine ambiguity (two distinct rooms sharing a key within the
    // same active year — a data-entry duplicate) still stands.
    if (!list.includes(id)) list.push(id)
    byKey.set(key, list)
  }

  for (const c of res.docs as Array<{
    id: string | number
    name?: string | null
    level?: string | null
    roomNumber?: number | null
  }>) {
    names.set(c.id, c.name ?? String(c.id))
    if (c.level && c.roomNumber != null) {
      const levelNum = Number(c.level.replace(/\D/g, ''))
      if (!Number.isNaN(levelNum)) add(`${levelNum}/${c.roomNumber}`, c.id)
    }
    if (c.name) {
      const key = classroomKeyFromCell(c.name)
      if (key) add(key, c.id)
      // Also index the compact raw name for odd/custom names.
      add(`name:${thaiDigitsToArabic(c.name).replace(/[\s.]/g, '')}`, c.id)
    }
  }
  return { byKey, names }
}

/** Resolve a classroom cell to a single id, or an error message. */
export const resolveClassroom = (
  cell: string,
  index: ClassroomIndex,
): { id: string | number } | { error: string } => {
  const candidates: string[] = []
  const key = classroomKeyFromCell(cell)
  if (key) candidates.push(key)
  candidates.push(`name:${thaiDigitsToArabic(cell).replace(/[\s.]/g, '')}`)

  for (const c of candidates) {
    const ids = index.byKey.get(c)
    if (ids && ids.length === 1) return { id: ids[0] }
    if (ids && ids.length > 1) {
      return {
        error: `ห้องเรียน "${cell}" ตรงกับหลายห้องในปีการศึกษาที่ใช้งานอยู่ โปรดตรวจสอบว่ามีห้องซ้ำกันหรือไม่`,
      }
    }
  }
  return { error: `ไม่พบห้องเรียน "${cell}" ในระบบ` }
}
