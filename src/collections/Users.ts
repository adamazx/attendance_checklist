import type { Access, CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import { Forbidden } from 'payload'

import { adminFieldAccess, adminOnly, isAdmin, isAdminOrDiscipline } from '@/access'

/**
 * Read scoping for users:
 * - admin & discipline may read every user record;
 * - any other authenticated user may read only their own record;
 * - an unauthenticated request reads nothing.
 */
const usersRead: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isAdminOrDiscipline(user)) return true
  return { id: { equals: user.id } }
}

/**
 * Update scoping for users:
 * - an admin may edit any account;
 * - any other authenticated user may edit ONLY their own record;
 * - an unauthenticated request is denied.
 * The `role` field stays admin-only (adminFieldAccess), so a self-update
 * can never escalate privileges. Without this explicit function, Payload's
 * default would let any logged-in user edit (or take over) any account.
 */
const usersUpdate: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isAdmin(user)) return true
  return { id: { equals: user.id } }
}

/**
 * A non-admin may change their password or email only through
 * /api/account/change-password, which verifies the current password and sets this
 * flag. `req.context` is server-only, so a REST/GraphQL client cannot forge it;
 * without this, anyone at an unattended session could take over the account.
 */
const guardCredentialChange: CollectionBeforeValidateHook = ({ data, operation, originalDoc, req }) => {
  if (operation !== 'update' || !req.user || isAdmin(req.user)) return data
  const changesCredentials = Boolean(data?.password) || (data?.email && data.email !== originalDoc?.email)
  if (changesCredentials && !req.context.passwordChangeVerified) throw new Forbidden(req.t)
  return data
}

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'ชื่อผู้ใช้',
    plural: 'ชื่อผู้ใช้',
  },
  admin: {
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'email', 'role'],
    group: 'ข้อมูลหลัก',
  },
  auth: true,
  access: {
    read: usersRead,
    create: adminOnly,
    update: usersUpdate,
    delete: adminOnly,
    // Payload's default lets any logged-in user clear any account's lockout,
    // which would reset the login-attempt counter and allow unlimited guessing.
    unlock: adminOnly,
  },
  hooks: {
    beforeValidate: [guardCredentialChange],
  },
  fields: [
    // Email added by default
    // Add more fields as needed
    {
      name: 'fullName',
      type: 'text',
      required: true,
      label: 'ชื่อ-นามสกุล',
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'advisor',
      label: 'บทบาท',
      options: [
        { label: 'ผู้ดูแลระบบ', value: 'admin' },
        { label: 'ครูที่ปรึกษา', value: 'advisor' },
        { label: 'ฝ่ายปกครอง', value: 'discipline' },
      ],
      // Only admins may set or change a user's role (prevents privilege escalation).
      access: {
        create: adminFieldAccess,
        update: adminFieldAccess,
      },
    },
  ],
}
