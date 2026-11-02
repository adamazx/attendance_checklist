import type { Access } from 'payload'

import { advisorClassroomIds } from './advisorClassrooms'
import { isAdmin, isAdminOrDiscipline } from './roles'

export * from './roles'
export * from './attendance'
export { advisorActiveClassroomIds, advisorClassroomIds } from './advisorClassrooms'

/** Any authenticated user may read (config everyone needs: years, terms). */
export const readAuthenticated: Access = ({ req: { user } }) => Boolean(user)

/** Only an admin may perform the operation (create/update/delete of config). */
export const adminOnly: Access = ({ req: { user } }) => isAdmin(user)

/**
 * Classroom read: admin & discipline see all; an advisor sees only the
 * classrooms they are assigned to (`advisors` contains them).
 */
export const classroomRead: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isAdminOrDiscipline(user)) return true
  return { advisors: { in: [user.id] } }
}

/**
 * Student read: admin & discipline see all; an advisor sees only students whose
 * classroom is one they advise. Resolved via advisorClassroomIds (one hop away).
 */
export const studentRead: Access = async ({ req }) => {
  const user = req.user
  if (!user) return false
  if (isAdminOrDiscipline(user)) return true
  const ids = await advisorClassroomIds(req)
  return { classroom: { in: ids } }
}
