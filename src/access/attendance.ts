import type { Access } from 'payload'

import { advisorActiveClassroomIds, advisorClassroomIds } from './advisorClassrooms'
import { isAdmin, isAdminOrDiscipline, isDiscipline } from './roles'

/**
 * Attendance read: admin & discipline see all; an advisor sees only records whose
 * snapshot `classroom` is one they advise (resolved via advisorClassroomIds).
 */
export const attendanceRead: Access = async ({ req }) => {
  const user = req.user
  if (!user) return false
  if (isAdminOrDiscipline(user)) return true
  const ids = await advisorClassroomIds(req)
  return { classroom: { in: ids } }
}

/**
 * Attendance create: admin and advisor may create; discipline (read-only) and
 * unauthenticated may not. An advisor's target student is further constrained to
 * their own active-year classroom(s) by the collection's beforeChange hook (create
 * access can't see the final snapshot classroom, so the hook enforces it).
 */
export const attendanceCreate: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isDiscipline(user)) return false
  return true // admin or advisor
}

/**
 * Attendance update/delete: admin full; advisor only within their own classroom(s)
 * of the active academic year (Where on the snapshot `classroom`), so past-year
 * records are read-only to them; discipline and anon denied.
 */
export const attendanceModify: Access = async ({ req }) => {
  const user = req.user
  if (!user) return false
  if (isAdmin(user)) return true
  if (isDiscipline(user)) return false
  const ids = await advisorActiveClassroomIds(req) // advisor
  return { classroom: { in: ids } }
}

/** AuditLog read: oversight roles only (admin + discipline). */
export const auditLogRead: Access = ({ req: { user } }) => isAdminOrDiscipline(user)

/** AuditLog is append-only and system-written: no API create/update/delete. */
export const denyAll: Access = () => false
