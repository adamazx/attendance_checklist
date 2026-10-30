// Storage of all dates is ISO/UTC; the UI layer renders them in Buddhist-era (พ.ศ.) with Thai month names.
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { AcademicYear } from './collections/AcademicYear'
import { Classroom } from './collections/Classroom'
import { Student } from './collections/Student'
import { Term } from './collections/Term'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
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
  // Phase 1: master-data collections. Teacher is modeled as fields on Users
  // (role + advisor assignment via Classroom.advisors). AttendanceRecord and
  // AuditLog are added in Phase 2.
  collections: [Users, AcademicYear, Term, Classroom, Student],
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
