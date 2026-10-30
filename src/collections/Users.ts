import type { Access, CollectionConfig } from 'payload'

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

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'fullName',
  },
  auth: true,
  access: {
    read: usersRead,
    create: adminOnly,
    update: usersUpdate,
    delete: adminOnly,
  },
  fields: [
    // Email added by default
    // Add more fields as needed
    {
      name: 'fullName',
      type: 'text',
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
