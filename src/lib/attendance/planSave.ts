/**
 * Pure upsert planner for a roll-call save. Decides, for each submitted row,
 * whether it is a create, an update, or unchanged. Unchanged rows are skipped so a
 * re-save writes no empty `edit` rows to AuditLog.
 *
 * A student may be written when they are on the classroom's roster, or already
 * have a record snapshotted to this classroom (a student who left since). Anyone
 * else is an outsider, and the caller must reject the whole save.
 *
 * A roster student who already has a record that day under another classroom (they
 * moved in after being recorded in their old room) is a conflict: there is one
 * record per student per day, and it belongs to the old classroom's snapshot, so
 * this classroom may neither create a second one nor edit that one. `existing`
 * must therefore include such records even when the caller can't read them.
 */
import type { AttendanceStatus } from './statuses'

export interface SaveEntry {
  note: string
  status: AttendanceStatus
  studentId: number
}

export interface ExistingRecord {
  classroomId: number | null
  id: number
  note: string | null
  status: AttendanceStatus
  studentId: number
}

export interface SavePlan {
  conflicts: number[]
  creates: SaveEntry[]
  outsiders: number[]
  unchanged: number
  updates: Array<{ id: number; note: string; status: AttendanceStatus }>
}

export const planSave = (args: {
  classroomId: number
  entries: SaveEntry[]
  existing: ExistingRecord[]
  rosterIds: ReadonlySet<number>
}): SavePlan => {
  const { classroomId, entries, existing, rosterIds } = args
  const byStudent = new Map(existing.map((r) => [r.studentId, r]))
  const plan: SavePlan = { conflicts: [], creates: [], outsiders: [], unchanged: 0, updates: [] }

  for (const entry of entries) {
    const record = byStudent.get(entry.studentId)
    const onRoster = rosterIds.has(entry.studentId)

    if (!onRoster && record?.classroomId !== classroomId) {
      plan.outsiders.push(entry.studentId)
    } else if (!record) {
      plan.creates.push(entry)
    } else if (record.classroomId !== classroomId) {
      plan.conflicts.push(entry.studentId)
    } else if (record.status === entry.status && (record.note ?? '') === entry.note) {
      plan.unchanged += 1
    } else {
      plan.updates.push({ id: record.id, note: entry.note, status: entry.status })
    }
  }

  return plan
}
