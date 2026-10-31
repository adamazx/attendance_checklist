import type { CollectionConfig } from 'payload'

import { adminOnly, classroomRead } from '@/access'

/** ม.1..ม.6 level options; `value` stays English, `label` is Thai. */
const levelOptions = [
  { label: 'ม.1', value: 'm1' },
  { label: 'ม.2', value: 'm2' },
  { label: 'ม.3', value: 'm3' },
  { label: 'ม.4', value: 'm4' },
  { label: 'ม.5', value: 'm5' },
  { label: 'ม.6', value: 'm6' },
] as const

/** Map a stored level value (m1..m6) to its Thai display prefix (ม.1..ม.6). */
const levelToThai: Record<string, string> = {
  m1: 'ม.1',
  m2: 'ม.2',
  m3: 'ม.3',
  m4: 'ม.4',
  m5: 'ม.5',
  m6: 'ม.6',
}

export const Classroom: CollectionConfig = {
  slug: 'classrooms',
  labels: {
    singular: 'ห้องเรียน',
    plural: 'ห้องเรียน',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'level', 'roomNumber', 'academicYear', 'advisors'],
    group: 'ข้อมูลหลัก',
  },
  access: {
    read: classroomRead,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'ชื่อห้อง',
      admin: {
        description: 'เช่น ม.4/2 — เว้นว่างได้ ระบบจะสร้างให้อัตโนมัติจากระดับชั้นและห้องที่',
      },
      hooks: {
        // Field-level hook only (no collection hook): auto-derive `${level}/${roomNumber}`
        // when the admin leaves `name` empty, e.g. m4 + 2 -> "ม.4/2".
        beforeValidate: [
          ({ value, siblingData }) => {
            if (value) return value
            const level = (siblingData as { level?: string }).level
            const roomNumber = (siblingData as { roomNumber?: number }).roomNumber
            if (level && levelToThai[level] && roomNumber != null) {
              return `${levelToThai[level]}/${roomNumber}`
            }
            return value
          },
        ],
      },
    },
    {
      name: 'level',
      type: 'select',
      required: true,
      label: 'ระดับชั้น',
      options: [...levelOptions],
    },
    {
      name: 'roomNumber',
      type: 'number',
      required: true,
      label: 'ห้องที่',
    },
    {
      name: 'academicYear',
      type: 'relationship',
      relationTo: 'academic-years',
      required: true,
      label: 'ปีการศึกษา',
    },
    {
      name: 'advisors',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      label: 'ครูที่ปรึกษา',
      admin: {
        description: 'ครูที่ปรึกษาประจำห้อง (รองรับหลายคน)',
      },
    },
  ],
}
