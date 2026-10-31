import type { CollectionConfig } from 'payload'

import { auditLogRead, denyAll } from '@/access'

export const AuditLog: CollectionConfig = {
  slug: 'audit-logs',
  labels: {
    singular: 'บันทึกการเปลี่ยนแปลง',
    plural: 'บันทึกการเปลี่ยนแปลง',
  },
  admin: {
    useAsTitle: 'documentId',
    defaultColumns: ['timestamp', 'collectionSlug', 'action', 'actor', 'documentId'],
  },
  access: {
    read: auditLogRead,
    create: denyAll,
    update: denyAll,
    delete: denyAll,
  },
  fields: [
    {
      name: 'collectionSlug',
      type: 'text',
      label: 'คอลเล็กชัน',
    },
    {
      name: 'documentId',
      type: 'text',
      label: 'รหัสเอกสาร',
    },
    {
      name: 'action',
      type: 'select',
      label: 'การกระทำ',
      options: [
        { label: 'สร้าง', value: 'create' },
        { label: 'แก้ไข', value: 'edit' },
        { label: 'บันทึกย้อนหลัง', value: 'backdate' },
        { label: 'ลบ', value: 'delete' },
      ],
    },
    {
      name: 'actor',
      type: 'relationship',
      relationTo: 'users',
      label: 'ผู้ทำรายการ',
    },
    {
      // Stored as ISO; rendered in พ.ศ. with Thai month names at the UI layer.
      name: 'timestamp',
      type: 'date',
      label: 'เวลา',
    },
    {
      name: 'before',
      type: 'json',
      label: 'ค่าก่อน',
    },
    {
      name: 'after',
      type: 'json',
      label: 'ค่าหลัง',
    },
  ],
}
