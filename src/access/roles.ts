import type { FieldAccess } from 'payload'

import type { User } from '@/payload-types'

/**
 * Roles for the Advisor Attendance System (ระบบครูที่ปรึกษา).
 * - admin       — ผู้ดูแลระบบ: full access to every collection.
 * - advisor     — ครูที่ปรึกษา: scoped to their own classroom(s) only.
 * - discipline  — ฝ่ายปกครอง: read-only across classrooms.
 */
export type Role = 'admin' | 'advisor' | 'discipline'

type MaybeUser = Pick<User, 'role'> | null | undefined

export const isAdmin = (user: MaybeUser): boolean => user?.role === 'admin'

export const isAdvisor = (user: MaybeUser): boolean => user?.role === 'advisor'

export const isDiscipline = (user: MaybeUser): boolean => user?.role === 'discipline'

export const isAdminOrDiscipline = (user: MaybeUser): boolean =>
  isAdmin(user) || isDiscipline(user)

/**
 * Field-level guard: only an admin may read/write the field (e.g. `role`),
 * so an advisor can never escalate their own privileges.
 */
export const adminFieldAccess: FieldAccess = ({ req: { user } }) => isAdmin(user)
