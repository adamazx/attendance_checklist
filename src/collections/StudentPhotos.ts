/**
 * Student photos (groundwork) — one photo per student, minors' PII.
 *
 * - `student` is the single source of truth (unique → one photo per student);
 *   `Student.photos` is a virtual join back to it.
 * - Read: admin + discipline all; an advisor only photos of students in their own
 *   classrooms. Payload's file route (/api/student-photos/file/…) checks the same
 *   access, so a file URL is not a way around it.
 * - Stored files are renamed to a random UUID, so URLs and the disk never carry a
 *   student or national ID.
 *
 * Storage: local disk (media/student-photos, gitignored) — DEV ONLY. Vercel's
 * filesystem is ephemeral, so production needs a storage adapter before photos go
 * live: a private S3-compatible bucket via @payloadcms/storage-s3, served through
 * Payload's access check (not installed yet — decision D6).
 *
 * Not built yet — bulk import seam: a folder/zip of photos named by **studentId**
 * (decision D5; not national ID, which would put a 13-digit PII number in file
 * names). For each file: find the student by `studentId` = file stem, then
 * create (or replace) its `student-photos` doc with `student` set. Unmatched
 * stems and duplicates are reported in a dry run first, like the DLA importer.
 */
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type {
  Access,
  CollectionBeforeOperationHook,
  CollectionConfig,
  RelationshipFieldSingleValidation,
} from 'payload'

import { adminOnly, advisorClassroomIds, isAdminOrDiscipline } from '@/access'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' }

/** Replace the uploaded file name with a UUID before Payload stores it. */
const randomizeFilename: CollectionBeforeOperationHook = ({ args, operation, req }) => {
  if ((operation === 'create' || operation === 'update') && req.file) {
    const ext = EXT[req.file.mimetype] ?? path.extname(req.file.name).slice(1).toLowerCase()
    req.file.name = `${randomUUID()}.${ext}`
  }
  return args
}

const photoRead: Access = async ({ req }) => {
  const user = req.user
  if (!user) return false
  if (isAdminOrDiscipline(user)) return true
  const ids = await advisorClassroomIds(req)
  return { 'student.classroom': { in: ids } }
}

export const StudentPhotos: CollectionConfig = {
  slug: 'student-photos',
  labels: {
    singular: 'รูปนักเรียน',
    plural: 'รูปนักเรียน',
  },
  admin: {
    group: 'ข้อมูลหลัก',
    defaultColumns: ['filename', 'student', 'updatedAt'],
    description: 'รูปนักเรียน 1 รูปต่อ 1 คน (JPG/PNG ไม่เกิน 5MB)',
  },
  access: {
    read: photoRead,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  hooks: {
    beforeOperation: [randomizeFilename],
  },
  upload: {
    staticDir: path.resolve(dirname, '../../media/student-photos'),
    mimeTypes: ['image/jpeg', 'image/png'],
    imageSizes: [{ name: 'thumbnail', width: 240 }],
    adminThumbnail: 'thumbnail',
  },
  fields: [
    {
      name: 'student',
      type: 'relationship',
      relationTo: 'students',
      required: true,
      unique: true,
      label: 'นักเรียน',
      admin: { description: 'นักเรียนหนึ่งคนมีรูปได้หนึ่งรูป' },
      // Checked here, not only by the unique index: validation runs before Payload
      // writes the file, so a refused second photo leaves no orphan file on disk.
      validate: (async (value, { id, req }) => {
        if (value == null) return 'กรุณาเลือกนักเรียน'
        const studentId = typeof value === 'object' ? (value as unknown as { id: number }).id : value
        const taken = await req.payload.find({
          collection: 'student-photos',
          where: { and: [{ student: { equals: studentId } }, ...(id ? [{ id: { not_equals: id } }] : [])] },
          depth: 0,
          limit: 1,
          overrideAccess: true,
          req,
        })
        return taken.totalDocs === 0 ? true : 'นักเรียนคนนี้มีรูปอยู่แล้ว — แก้ไขรูปเดิมแทนการเพิ่มใหม่'
      }) as RelationshipFieldSingleValidation,
    },
  ],
}
