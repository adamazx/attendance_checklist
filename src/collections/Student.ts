import type { CollectionConfig, FieldHook, TextFieldSingleValidation } from 'payload'

import { adminOnly, studentRead } from '@/access'
import { piiAdmin, piiNoDiscipline } from '@/access/pii'
import { isNationalIdFormat, maskNationalId, normalizeNationalId } from '@/lib/import/nationalId'

import { addressGroup, dayField, parentGroup } from './fields/studentGroups'
import {
  disabilityOptions,
  genderOptions,
  nationOptions,
  programOptions,
  religionOptions,
  scoutTypeOptions,
  studentConditionOptions,
} from './fields/studentOptions'

/** Store the national ID normalized (digits only); empty → null so the unique index allows many blanks. */
const normalizeNationalIdHook: FieldHook = ({ value }) => {
  const v = normalizeNationalId(value)
  return v || null
}

/**
 * Keep `nationalIdMasked` in step with `nationalId`. Runs on the server with the full
 * incoming data, so it sees the ID even though advisors can never read it.
 */
const deriveMaskedHook: FieldHook = ({ data, originalDoc }) => {
  const id = data?.nationalId !== undefined ? data.nationalId : originalDoc?.nationalId
  return id ? maskNationalId(id as string) : null
}

/**
 * Student master record (DLA/อปท. export) — minors' PII (PDPA).
 *
 * Access tiers (row scope from `studentRead`, field scope from `@/access/pii`):
 *  - every reader: identity, class, gender, program, addresses, parent name/phone
 *  - admin + advisor (own room only): + bio details, household details, welfare,
 *    card dates, extras, masked national ID
 *  - admin only: full national ID, `dlaRaw`
 */
export const Student: CollectionConfig = {
  slug: 'students',
  labels: {
    singular: 'นักเรียน',
    plural: 'นักเรียน',
  },
  admin: {
    useAsTitle: 'studentId',
    defaultColumns: ['studentId', 'firstName', 'lastName', 'classroom', 'status'],
    group: 'ข้อมูลหลัก',
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
    {
      name: 'nationalId',
      type: 'text',
      unique: true,
      label: 'เลขประจำตัวประชาชน',
      access: piiAdmin,
      admin: { description: 'ตัวเลข 13 หลัก — เฉพาะผู้ดูแลระบบเห็นเลขเต็ม' },
      hooks: { beforeValidate: [normalizeNationalIdHook] },
      validate: ((value) =>
        !value || isNationalIdFormat(normalizeNationalId(value))
          ? true
          : 'เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก') as TextFieldSingleValidation,
    },
    {
      name: 'nationalIdMasked',
      type: 'text',
      label: 'เลขประจำตัวประชาชน (ปิดบัง)',
      access: piiNoDiscipline,
      admin: { readOnly: true, description: 'สร้างอัตโนมัติจากเลขประจำตัวประชาชน (แสดง 4 หลักท้าย)' },
      hooks: { beforeChange: [deriveMaskedHook] },
    },
    {
      name: 'bio',
      type: 'group',
      label: 'ข้อมูลส่วนตัว',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'gender', type: 'select', label: 'เพศ', options: genderOptions },
            { name: 'program', type: 'select', label: 'แผนการเรียน', options: programOptions },
          ],
        },
        {
          type: 'row',
          fields: [
            dayField('birthDate', 'วันเกิด', { access: piiNoDiscipline }),
            dayField('enrollDate', 'วันเข้าศึกษา', { access: piiNoDiscipline }),
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'nationality', type: 'select', label: 'สัญชาติ', options: nationOptions, access: piiNoDiscipline },
            { name: 'ethnicity', type: 'select', label: 'เชื้อชาติ', options: nationOptions, access: piiNoDiscipline },
            { name: 'religion', type: 'select', label: 'ศาสนา', options: religionOptions, access: piiNoDiscipline },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'heightCm', type: 'number', label: 'ส่วนสูง (ซม.)', min: 0, access: piiNoDiscipline },
            { name: 'weightKg', type: 'number', label: 'น้ำหนัก (กก.)', min: 0, access: piiNoDiscipline },
          ],
        },
      ],
    },
    {
      name: 'household',
      type: 'group',
      label: 'ครอบครัว',
      fields: [
        parentGroup('father', 'บิดา'),
        parentGroup('mother', 'มารดา'),
        parentGroup('guardian', 'ผู้ปกครอง'),
      ],
    },
    addressGroup('addressRegistered', 'ที่อยู่ตามทะเบียนบ้าน'),
    addressGroup('addressCurrent', 'ที่อยู่ปัจจุบัน'),
    {
      name: 'welfare',
      type: 'group',
      label: 'สวัสดิการ',
      access: piiNoDiscipline,
      fields: [
        {
          name: 'studentCondition',
          type: 'select',
          label: 'สภาพนักเรียน',
          options: studentConditionOptions,
        },
        {
          type: 'row',
          fields: [
            { name: 'tuitionRight', type: 'text', label: 'สิทธิเบิกค่าเล่าเรียน' },
            { name: 'medicalRight', type: 'text', label: 'สิทธิเบิกค่ารักษาพยาบาล' },
          ],
        },
      ],
    },
    {
      name: 'cardDates',
      type: 'group',
      label: 'บัตรนักเรียน',
      access: piiNoDiscipline,
      fields: [
        {
          type: 'row',
          fields: [dayField('issueDate', 'วันออกบัตร'), dayField('expiryDate', 'วันหมดอายุ')],
        },
      ],
    },
    {
      name: 'extras',
      type: 'group',
      label: 'ข้อมูลเพิ่มเติม',
      access: piiNoDiscipline,
      fields: [
        { name: 'specialAbilities', type: 'textarea', label: 'ความสามารถพิเศษ' },
        {
          name: 'disabilities',
          type: 'select',
          hasMany: true,
          label: 'ความพิการ',
          options: disabilityOptions,
        },
        { name: 'scoutType', type: 'select', label: 'ลูกเสือ/เนตรนารี/ยุวกาชาด', options: scoutTypeOptions },
      ],
    },
    {
      name: 'dlaRaw',
      type: 'json',
      label: 'ข้อมูลดิบจากไฟล์ DLA ที่ยังไม่ได้จับคู่',
      access: piiAdmin,
      admin: {
        description:
          'เก็บเฉพาะคอลัมน์ที่ระบบยังไม่ได้จับคู่ พร้อมชื่อชีต/แถวต้นทาง เพื่อไม่ให้ข้อมูลสูญหาย',
      },
    },
  ],
}
