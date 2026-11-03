import type { CollectionBeforeDeleteHook, CollectionConfig } from 'payload'

import { APIError } from 'payload'

import { adminOnly, readAuthenticated } from '@/access'

/**
 * Refuse to delete an activity that attendance records still use. The FK would set
 * their `activity` to null, silently turning them into homeroom records (and
 * clashing with the homeroom unique index) without an AuditLog row.
 */
const blockDeleteWhileUsed: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const used = await req.payload.count({
    collection: 'attendance-records',
    where: { activity: { equals: id } },
    overrideAccess: true,
    req,
  })
  if (used.totalDocs > 0) {
    throw new APIError(
      `ลบไม่ได้: มีบันทึกการเช็คชื่อ ${used.totalDocs} รายการที่ใช้วิชา/กิจกรรมนี้ (แก้ไขชื่อได้แทน)`,
      409,
      null,
      true,
    )
  }
}

/**
 * Optional subject/activity an attendance record can be taken under. A record with
 * no activity is the daily homeroom roll-call.
 */
export const Activity: CollectionConfig = {
  slug: 'activities',
  labels: {
    singular: 'วิชา/กิจกรรม',
    plural: 'วิชา/กิจกรรม',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'description'],
    group: 'ข้อมูลหลัก',
  },
  access: {
    // Everyone signed in needs the list to pick or filter by it.
    read: readAuthenticated,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  hooks: {
    beforeDelete: [blockDeleteWhileUsed],
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      label: 'ประเภท',
      defaultValue: 'subject',
      options: [
        { label: 'วิชา', value: 'subject' },
        { label: 'กิจกรรม', value: 'activity' },
      ],
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'ชื่อ',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'รายละเอียด',
    },
  ],
}
