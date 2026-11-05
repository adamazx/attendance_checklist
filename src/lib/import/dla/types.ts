/**
 * Types for the DLA (อปท.) student-master importer. Row numbers are 1-based
 * spreadsheet rows within their sheet, as staff see them in Excel.
 */

/** One data row of a classroom sheet `d{level}-{room}`, cells keyed by column index. */
export interface DlaSourceRow {
  sheet: string
  rowNo: number
  level: number
  room: number
  cells: string[]
}

export interface DlaSheet {
  name: string
  level: number
  room: number
  headers: string[]
  rows: DlaSourceRow[]
}

export interface DlaCardSheet {
  headers: string[]
  rows: Array<{ rowNo: number; cells: string[] }>
}

export interface ParsedDla {
  sheets: DlaSheet[]
  skippedSheets: Array<{ name: string; reason: string }>
  card: DlaCardSheet | null
}

/** A source row after column mapping + value normalization. */
export interface MappedRow {
  sheet: string
  rowNo: number
  level: number
  room: number
  studentId: string
  nationalId: string
  name: string
  /** Nested Student data (groups as objects), without classroom. */
  data: Record<string, unknown>
  /** Cells no rule mapped (or whose value could not be normalized), by header path. */
  unmapped: Record<string, string>
  warnings: string[]
  errors: string[]
}

/** An existing student, flattened for matching and change detection. */
export interface ExistingStudent {
  id: number | string
  studentId: string
  nationalId: string | null
  /** Flattened `path → value` of the fields the DLA import manages. */
  flat: Record<string, unknown>
}

export interface DlaEntry {
  sheet: string
  row: number
  studentId: string
  nationalIdMasked: string
  name: string
  classroom: string
  action: 'create' | 'update'
  /** Present for updates: existing student id + changed field paths. */
  targetId?: number | string
  changedFields?: string[]
  /** Update that only links an existing studentId to its national ID. */
  link?: boolean
  warnings: string[]
}

export interface DlaIssue {
  sheet: string
  row: number
  studentId?: string
  nationalIdMasked?: string
  name?: string
  message: string
}

export interface DlaPlan {
  creates: DlaEntry[]
  updates: DlaEntry[]
  unchanged: DlaEntry[]
  /** Same national ID more than once in the file with differing data (skipped). */
  conflicts: DlaIssue[]
  /** studentId ↔ nationalId disagreements against the DB or within the file (skipped). */
  idConflicts: DlaIssue[]
  /** Exact duplicate rows collapsed into one. */
  duplicates: DlaIssue[]
  errors: DlaIssue[]
  /** Rows to write (creates + updates) with their payload data. */
  writes: Array<{ entry: DlaEntry; data: Record<string, unknown> }>
}

export interface DlaImportResult {
  dryRun: boolean
  fileHash: string
  fatal?: string
  sheets: Array<{ name: string; rows: number }>
  skippedSheets: Array<{ name: string; reason: string }>
  unmappedColumns: string[]
  missingColumns: string[]
  creates: DlaEntry[]
  updates: DlaEntry[]
  unchanged: DlaEntry[]
  conflicts: DlaIssue[]
  idConflicts: DlaIssue[]
  duplicates: DlaIssue[]
  errors: DlaIssue[]
  /** Only after a confirmed write. */
  written?: { created: number; updated: number; failed: DlaIssue[] }
  summary: {
    rows: number
    creates: number
    updates: number
    unchanged: number
    conflicts: number
    idConflicts: number
    duplicates: number
    errors: number
  }
}
