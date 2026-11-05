/**
 * A format-agnostic report document: what the Excel and PDF renderers both draw.
 * Built from a report view by `./documents`; holds raw numbers (a renderer decides
 * how to show them), so Excel keeps numbers as numbers and %มา as a percent cell.
 */

/** `int` and `percent` cells hold a number or null (shown as `—`). `percent` is 0–100. */
export type ColumnKind = 'int' | 'percent' | 'text'

export type ExportCell = number | string | null

export interface ExportColumn {
  header: string
  kind: ColumnKind
}

export interface ExportTable {
  columns: ExportColumn[]
  /** A summary row under the table: `label` spans the first `span` columns. */
  footer?: { cells: ExportCell[]; label: string; span: number }
  heading?: string
  rows: ExportCell[][]
  type: 'table'
}

export interface ExportParagraph {
  /** `note` = small print (a footnote); `strong` = a highlighted summary line. */
  style?: 'note' | 'strong'
  text: string
  type: 'paragraph'
}

export type ExportBlock = ExportParagraph | ExportTable

export interface ExportDoc {
  blocks: ExportBlock[]
  /** File name without extension (Thai allowed; sanitized by `./filename`). */
  filenameBase: string
  /** Label → value lines under the title (ห้อง, วิชา/กิจกรรม, ช่วงวันที่ …). */
  meta: { label: string; value: string }[]
  /** Wide tables print in landscape. */
  orientation: 'landscape' | 'portrait'
  /** Excel sheet name (≤ 31 chars, no `[]:*?/\`). */
  sheetName: string
  title: string
}

/** `null` → `—`, as on the report pages. */
export const DASH = '—'
