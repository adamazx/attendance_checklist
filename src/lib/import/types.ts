/**
 * Shared types for the student-roster importer (phase-1b).
 *
 * The importer is re-runnable: staff upload a CSV/XLSX roster, preview the
 * parsed result (dry run), then confirm the write. All row numbers reported to
 * the user are 1-based spreadsheet rows (the header is row 1, so the first data
 * row is row 2) to match what they see in Excel.
 */

/** Canonical student fields the importer knows how to map to. */
export type StudentField =
  | 'studentId'
  | 'prefix'
  | 'firstName'
  | 'lastName'
  | 'classNumber'
  | 'classroom'
  | 'status'

/** A single created (or, in a dry run, would-be-created) student. */
export interface CreatedRow {
  row: number
  studentId: string
  name: string
  classroom: string
}

/** A row skipped because its studentId already exists (in the DB or the file). */
export interface DuplicateRow {
  row: number
  studentId: string
  message: string
}

/** A row that failed validation or writing. */
export interface ErrorRow {
  row: number
  studentId?: string
  message: string
}

/** Full result of an import (or dry-run preview). */
export interface ImportResult {
  dryRun: boolean
  /** Number of data rows (excludes the header). */
  totalRows: number
  created: CreatedRow[]
  duplicates: DuplicateRow[]
  errors: ErrorRow[]
  summary: {
    created: number
    duplicates: number
    errors: number
  }
  /**
   * A fatal, whole-file problem (e.g. missing required columns, empty file).
   * When set, no rows were processed.
   */
  fatal?: string
}
