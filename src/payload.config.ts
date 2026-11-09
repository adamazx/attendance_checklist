// Storage of all dates is ISO/UTC; the UI layer renders them in Buddhist-era (พ.ศ.) with Thai month names.
import { postgresAdapter, sql } from '@payloadcms/db-postgres'
import { uniqueIndex } from '@payloadcms/db-postgres/drizzle/pg-core'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { en } from '@payloadcms/translations/languages/en'
import { th } from '@payloadcms/translations/languages/th'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { AcademicYear } from './collections/AcademicYear'
import { Activity } from './collections/Activity'
import { AttendanceRecord } from './collections/AttendanceRecord'
import { AuditLog } from './collections/AuditLog'
import { Classroom } from './collections/Classroom'
import { Student } from './collections/Student'
import { StudentPhotos } from './collections/StudentPhotos'
import { Term } from './collections/Term'
import { Users } from './collections/Users'
import { readS3Env } from './lib/storage/s3Env'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Public origin of the app. Payload adds it to the CSRF allowlist, so cookie auth is
 * honored only for requests from it (or from CSRF_ALLOWED_ORIGINS). Production must
 * set it: an empty serverURL with no extra origins means an empty allowlist, which
 * turns the CSRF check off.
 */
const serverURL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000')
if (!serverURL) throw new Error('NEXT_PUBLIC_SERVER_URL must be set in production')

/** Extra trusted origins (e.g. a preview deployment), comma-separated. */
const extraOrigins = (process.env.CSRF_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

/** Student-photo storage: private S3-compatible bucket when S3_* is set, else local disk (dev). */
const s3 = readS3Env(process.env)

export default buildConfig({
  serverURL,
  csrf: extraOrigins,
  i18n: {
    fallbackLanguage: 'th',
    supportedLanguages: { th, en },
  },
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      // "← กลับหน้าหลัก" at the top of the nav, for everyone who reaches /admin.
      beforeNavLinks: ['/components/BackToHome/BackToHomeNavLink#default'],
      // Admin-only custom view for the student-roster importer (phase-1b).
      afterNavLinks: ['/components/ImportStudents/ImportStudentsNavLink#default'],
      views: {
        importStudents: {
          Component: '/components/ImportStudents/ImportStudentsView#default',
          path: '/import-students',
        },
      },
    },
  },
  // Phase 1 master data (Teacher modeled as fields on Users) + Phase 2 daily
  // attendance layer: AttendanceRecord (audited) and the append-only AuditLog.
  // Activity is the optional subject/activity an attendance record is taken under.
  // StudentPhotos: one photo per student (local disk in dev; prod needs a storage adapter).
  collections: [Users, AcademicYear, Term, Activity, Classroom, Student, StudentPhotos, AttendanceRecord, AuditLog],
  // Uploads are student photos only; cap their size.
  upload: { limits: { fileSize: 5 * 1024 * 1024 } },
  // The app uses REST and the Local API only. GraphQL also can't build its schema:
  // the Thai Student.prefix option values aren't valid GraphQL enum names.
  graphQL: { disable: true },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    // Schema changes ship as migrations in src/migrations (run `pnpm payload migrate`),
    // never dev push — so the local DB and Neon follow the same path.
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
    // One attendance record per student per day per activity: homeroom (no activity)
    // and each activity are unique separately. Declared here, not as collection
    // `indexes`, because Payload can't express partial indexes; keeping them in the
    // Drizzle schema lets `migrate:create` see them.
    afterSchemaInit: [
      ({ schema, extendTable }) => {
        extendTable({
          table: schema.tables.attendance_records,
          extraConfig: (t) => ({
            homeroomUnique: uniqueIndex('attendance_records_student_date_homeroom_idx')
              .on(t.student, t.date)
              .where(sql`${t.activity} IS NULL`),
            activityUnique: uniqueIndex('attendance_records_student_date_activity_idx')
              .on(t.student, t.date, t.activity)
              .where(sql`${t.activity} IS NOT NULL`),
          }),
        })
        return schema
      },
    ],
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  sharp,
  plugins: [
    s3Storage({
      // Env-gated: without S3_* vars the collection keeps local disk exactly as before.
      enabled: s3 !== null,
      // Add the plugin's `prefix` / `_objectKey` columns whether or not a bucket is
      // configured, so the DB schema (and migrations) never depend on env vars.
      alwaysInsertFields: true,
      collections: {
        // Minors' photos stay private:
        // - disablePayloadAccessControl is NOT set (false): files and thumbnails are
        //   served only via /api/student-photos/file/… after the collection's read access.
        // - signedDownloads false: never hand out presigned bucket URLs.
        // - no prefix / generateFileURL: no public bucket URL is ever generated.
        'student-photos': { signedDownloads: false },
      },
      bucket: s3?.bucket ?? '',
      config: s3?.config ?? {},
      // Uploads pass through Payload (validation, UUID rename, size cap).
      clientUploads: false,
      // `acl` deliberately omitted: no ACL header is sent; the bucket itself must be private.
    }),
  ],
})
