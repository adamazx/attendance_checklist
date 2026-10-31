import type { CollectionConfig, FieldAccess } from 'payload'

import { attendanceCreate, attendanceModify, attendanceRead } from '@/access'
import { THAI_DAY_RE } from '@/lib/date/thaiDay'

import {
  auditAttendanceChange,
  auditAttendanceDelete,
  normalizeAttendanceDate,
  setSnapshotAndEnforce,
} from './hooks/attendanceHooks'

/**
 * Set-once guard. The field may be written on create (by the user, or overwritten
 * by the beforeChange hook for server-managed fields) but can NEVER change on
 * update — via REST/GraphQL/Local API, not just the admin UI. This keeps `student`
 * and `date` stable (a correction is delete + recreate, which audits cleanly) and
 * makes the snapshot/provenance fields tamper-proof. Without it an advisor could
 * PATCH `student`/`classroom` to escape their own-classroom scope.
 */
const noUpdate: FieldAccess = () => false

export const AttendanceRecord: CollectionConfig = {
  slug: 'attendance-records',
  labels: {
    singular: 'บันทึกการเช็คชื่อ',
    plural: 'การเช็คชื่อ',
  },
  admin: {
    useAsTitle: 'date',
    defaultColumns: ['student', 'date', 'status', 'classroom', 'recordedBy'],
  },
  access: {
    read: attendanceRead,
    create: attendanceCreate,
    update: attendanceModify,
    delete: attendanceModify,
  },
  hooks: {
    beforeValidate: [normalizeAttendanceDate],
    beforeChange: [setSnapshotAndEnforce],
    afterChange: [auditAttendanceChange],
    afterDelete: [auditAttendanceDelete],
  },
  indexes: [{ fields: ['student', 'date'], unique: true }],
  fields: [
    {
      name: 'student',
      type: 'relationship',
      relationTo: 'students',
      required: true,
      label: 'นักเรียน',
      // Immutable after create — prevents reassigning a record to another
      // classroom's student (which the update Where cannot catch).
      access: { update: noUpdate },
    },
    {
      // Stored as a canonical Thai calendar day (YYYY-MM-DD); rendered in พ.ศ.
      // with Thai month names at the UI layer. Immutable after create.
      name: 'date',
      type: 'text',
      required: true,
      label: 'วันที่',
      admin: {
        description: 'วันที่ตามปฏิทินไทย รูปแบบ YYYY-MM-DD',
      },
      validate: (val: unknown) =>
        (typeof val === 'string' && THAI_DAY_RE.test(val)) || 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD',
      access: { update: noUpdate },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      label: 'สถานะ',
      options: [
        { label: 'มา', value: 'present' },
        { label: 'สาย', value: 'late' },
        { label: 'ลา', value: 'leave' },
        { label: 'ขาด', value: 'absent' },
        { label: 'ออกก่อน', value: 'left_early' },
      ],
      admin: {
        description: 'สถานะปรับเพิ่มได้ภายหลัง',
      },
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'หมายเหตุ/เหตุผล',
    },
    {
      name: 'classroom',
      type: 'relationship',
      relationTo: 'classrooms',
      label: 'ห้องเรียน (ขณะบันทึก)',
      admin: {
        readOnly: true,
        description: 'บันทึกอัตโนมัติจากห้องของนักเรียน ณ เวลาที่เช็คชื่อ',
      },
      // Server-managed (set by the beforeChange hook); never client-writable on update.
      access: { update: noUpdate },
    },
    {
      name: 'academicYear',
      type: 'relationship',
      relationTo: 'academic-years',
      label: 'ปีการศึกษา',
      admin: {
        readOnly: true,
      },
      access: { update: noUpdate },
    },
    {
      name: 'term',
      type: 'relationship',
      relationTo: 'terms',
      label: 'ภาคเรียน',
      admin: {
        readOnly: true,
      },
      access: { update: noUpdate },
    },
    {
      name: 'recordedBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'ผู้บันทึก',
      admin: {
        readOnly: true,
      },
      access: { update: noUpdate },
    },
    {
      // Stored as ISO; rendered in พ.ศ. with Thai month names at the UI layer.
      name: 'recordedAt',
      type: 'date',
      label: 'เวลาที่บันทึก',
      admin: {
        readOnly: true,
      },
      access: { update: noUpdate },
    },
  ],
}
