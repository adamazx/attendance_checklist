import type { CheckboxFieldValidation, CollectionConfig } from 'payload'

import { adminOnly, readAuthenticated } from '@/access'

export const AcademicYear: CollectionConfig = {
  slug: 'academic-years',
  labels: {
    singular: 'ปีการศึกษา',
    plural: 'ปีการศึกษา',
  },
  admin: {
    useAsTitle: 'year',
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
      // At most one active year: advisors may write attendance only in classrooms of
      // the active year, so a second one left active would reopen a past year.
      validate: (async (value, { id, req }) => {
        if (!value) return true
        const others = await req.payload.find({
          collection: 'academic-years',
          where: {
            and: [{ isActive: { equals: true } }, ...(id != null ? [{ id: { not_equals: id } }] : [])],
          },
          depth: 0,
          limit: 1,
          overrideAccess: true,
          req,
        })
        return others.docs.length === 0 || 'มีปีการศึกษาที่ใช้งานอยู่แล้ว ปิดปีเดิมก่อนเปิดปีใหม่'
      }) satisfies CheckboxFieldValidation,
    },
  ],
}
