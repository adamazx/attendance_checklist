/**
 * Shared field shapes for the student master record: one parent/guardian shape
 * (used for father, mother, guardian) and one address shape (registered + current).
 */
import type { Field, TextFieldSingleValidation } from 'payload'

import { piiNoDiscipline } from '@/access/pii'

import { maritalStatusOptions, religionOptions } from './studentOptions'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Calendar day stored as `YYYY-MM-DD` (CE); the UI renders it in พ.ศ. */
export const dayField = (name: string, label: string, extra: Partial<Field> = {}): Field =>
  ({
    name,
    type: 'text',
    label,
    admin: { description: 'รูปแบบ YYYY-MM-DD (ค.ศ.) — แสดงผลเป็น พ.ศ.' },
    validate: ((value) =>
      !value || DAY_RE.test(value) ? true : 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD') as TextFieldSingleValidation,
    ...extra,
  }) as Field

/**
 * Father / mother / guardian. Name, phone and relationship are contact data
 * (readable by every role that can read the row); religion, occupation, income
 * and marital status are hidden from discipline.
 */
export const parentGroup = (name: string, label: string): Field => ({
  name,
  type: 'group',
  label,
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'prefix', type: 'text', label: 'คำนำหน้า' },
        { name: 'firstName', type: 'text', label: 'ชื่อ' },
        { name: 'lastName', type: 'text', label: 'นามสกุล' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'phone', type: 'text', label: 'เบอร์โทรศัพท์' },
        { name: 'relationship', type: 'text', label: 'ความเกี่ยวข้อง' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'religion', type: 'select', label: 'ศาสนา', options: religionOptions, access: piiNoDiscipline },
        { name: 'occupation', type: 'text', label: 'อาชีพ', access: piiNoDiscipline },
        {
          name: 'monthlyIncome',
          type: 'number',
          label: 'รายได้/เดือน (บาท)',
          min: 0,
          access: piiNoDiscipline,
        },
        {
          name: 'maritalStatus',
          type: 'select',
          label: 'สถานภาพ',
          options: maritalStatusOptions,
          access: piiNoDiscipline,
        },
      ],
    },
  ],
})

/** Registered (ทะเบียนบ้าน) or current address. Contact data: readable by all roles. */
export const addressGroup = (name: string, label: string): Field => ({
  name,
  type: 'group',
  label,
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'houseNo', type: 'text', label: 'บ้านเลขที่' },
        { name: 'moo', type: 'text', label: 'หมู่' },
        { name: 'road', type: 'text', label: 'ถนน' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'subdistrict', type: 'text', label: 'ตำบล' },
        { name: 'district', type: 'text', label: 'อำเภอ' },
        { name: 'province', type: 'text', label: 'จังหวัด' },
        {
          name: 'postalCode',
          type: 'text',
          label: 'รหัสไปรษณีย์',
          validate: ((value) =>
            !value || /^\d{5}$/.test(value) ? true : 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก') as TextFieldSingleValidation,
        },
      ],
    },
  ],
})
