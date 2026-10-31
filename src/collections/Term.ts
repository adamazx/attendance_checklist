import type { CollectionConfig } from 'payload'

import { adminOnly, readAuthenticated } from '@/access'

export const Term: CollectionConfig = {
  slug: 'terms',
  labels: {
    singular: 'ภาคเรียน',
    plural: 'ภาคเรียน',
  },
  admin: {
    useAsTitle: 'term',
    group: 'ข้อมูลหลัก',
  },
  access: {
    read: readAuthenticated,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'term',
      type: 'select',
      required: true,
      label: 'ภาคเรียน',
      options: [
        { label: 'ภาคเรียนที่ 1', value: '1' },
        { label: 'ภาคเรียนที่ 2', value: '2' },
      ],
    },
    {
      name: 'academicYear',
      type: 'relationship',
      relationTo: 'academic-years',
      required: true,
      label: 'ปีการศึกษา',
    },
    {
      // Stored as ISO/UTC; rendered in พ.ศ. with Thai month names at the UI layer later.
      name: 'startDate',
      type: 'date',
      label: 'วันที่เริ่ม',
    },
    {
      // Stored as ISO/UTC; rendered in พ.ศ. with Thai month names at the UI layer later.
      name: 'endDate',
      type: 'date',
      label: 'วันที่สิ้นสุด',
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: false,
      label: 'ภาคเรียนที่ใช้งานอยู่',
    },
  ],
}
