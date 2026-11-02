// Storage of all dates is ISO/UTC; the UI layer renders them in Buddhist-era (พ.ศ.) with Thai month names.
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { en } from '@payloadcms/translations/languages/en'
import { th } from '@payloadcms/translations/languages/th'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { AcademicYear } from './collections/AcademicYear'
import { AttendanceRecord } from './collections/AttendanceRecord'
import { AuditLog } from './collections/AuditLog'
import { Classroom } from './collections/Classroom'
import { Student } from './collections/Student'
import { Term } from './collections/Term'
import { Users } from './collections/Users'

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
  collections: [Users, AcademicYear, Term, Classroom, Student, AttendanceRecord, AuditLog],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  sharp,
  plugins: [],
})
