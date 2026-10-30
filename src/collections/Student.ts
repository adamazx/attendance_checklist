import type { CollectionConfig } from 'payload'

import { adminOnly, studentRead } from '@/access'

export const Student: CollectionConfig = {
  slug: 'students',
  labels: {
    singular: 'นักเรียน',
    plural: 'นักเรียน',
  },
  admin: {
    useAsTitle: 'studentId',
    defaultColumns: ['studentId', 'firstName', 'lastName', 'classroom', 'status'],
  },
  access: {
    read: studentRead,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'studentId',
      type: 'text',
      required: true,
      unique: true,
      label: 'เลขประจำตัว',
    },
    {
      name: 'prefix',
      type: 'select',
      label: 'คำนำหน้า',
      options: [
        { label: 'เด็กชาย', value: 'ด.ช.' },
        { label: 'เด็กหญิง', value: 'ด.ญ.' },
        { label: 'นาย', value: 'นาย' },
        { label: 'นางสาว', value: 'น.ส.' },
      ],
    },
    {
      name: 'firstName',
      type: 'text',
      required: true,
      label: 'ชื่อ',
    },
    {
      name: 'lastName',
      type: 'text',
      required: true,
      label: 'นามสกุล',
    },
    {
      name: 'classNumber',
      type: 'number',
      label: 'เลขที่',
    },
    {
      name: 'classroom',
      type: 'relationship',
      relationTo: 'classrooms',
      required: true,
      label: 'ห้องเรียน',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'studying',
      label: 'สถานะ',
      options: [
        { label: 'กำลังศึกษา', value: 'studying' },
        { label: 'ย้าย', value: 'transferred' },
        { label: 'ลาพัก', value: 'on_leave' },
        { label: 'จบการศึกษา', value: 'graduated' },
      ],
      admin: {
        description: 'สถานะปรับเพิ่มได้ภายหลัง (เช่น แยกลาป่วย/ลากิจ)',
      },
    },
  ],
}
