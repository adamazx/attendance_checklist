import type { CollectionConfig } from 'payload'

import { adminOnly, readAuthenticated } from '@/access'

export const AcademicYear: CollectionConfig = {
  slug: 'academic-years',
  labels: {
    singular: 'ปีการศึกษา',
    plural: 'ปีการศึกษา',
  },
  admin: {
    useAsTitle: 'year',
  },
  access: {
    read: readAuthenticated,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'year',
      type: 'number',
      required: true,
      unique: true,
      label: 'ปีการศึกษา (พ.ศ.)',
      admin: {
        description: 'ปีการศึกษาแบบพุทธศักราช (พ.ศ.) เช่น 2569',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: false,
      label: 'ปีที่ใช้งานอยู่',
    },
  ],
}
