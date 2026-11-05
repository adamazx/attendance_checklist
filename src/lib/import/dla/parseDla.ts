/**
 * Read a DLA export workbook (.xls BIFF or .xlsx) into classroom sheets.
 *
 * - Classroom sheets are named `d{level}-{room}` (d1-1 … d6-2). Anything else is
 *   skipped and reported — notably the stale duplicate `d5-3-` (trailing dash).
 * - The `card` sheet (print-card issue/expiry dates) is returned separately.
 * - Each classroom sheet has a 3-row merged header; data starts on row 4. Header
 *   cells are filled forward across merges and joined into a path such as
 *   "บิดา / ชื่อ", which the column mapping matches on.
 */
import type * as XLSX from 'xlsx'

import { readWorkbook, sheetToGrid } from '../parseRoster.ts'

import type { DlaCardSheet, DlaSheet, ParsedDla } from './types.ts'

export const CLASS_SHEET_RE = /^d([1-6])-(\d+)$/
export const DLA_HEADER_ROWS = 3

const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim()

/** Header paths for the first `headerRows` rows, with merged cells filled forward. */
export const headerPaths = (sheet: XLSX.WorkSheet, grid: string[][], headerRows: number): string[] => {
  const width = Math.max(0, ...grid.slice(0, headerRows).map((r) => r.length), ...grid.map((r) => r.length))
  const at = (r: number, c: number): string => collapse(grid[r]?.[c] ?? '')

  // Copy each merge's top-left value into every cell it covers (header rows only).
  const filled: string[][] = Array.from({ length: headerRows }, (_, r) =>
    Array.from({ length: width }, (_, c) => at(r, c)),
  )
  for (const m of sheet['!merges'] ?? []) {
    if (m.s.r >= headerRows) continue
    const v = at(m.s.r, m.s.c)
    for (let r = m.s.r; r <= Math.min(m.e.r, headerRows - 1); r++) {
      for (let c = m.s.c; c <= m.e.c && c < width; c++) filled[r][c] = v
    }
  }

  return Array.from({ length: width }, (_, c) => {
    const parts: string[] = []
    for (let r = 0; r < headerRows; r++) {
      const v = filled[r][c]
      if (v && parts[parts.length - 1] !== v) parts.push(v)
    }
    return parts.join(' / ')
  })
}

/** Index of the first row holding a 13-digit value (the card sheet's header height). */
const firstDataRow = (grid: string[][]): number => {
  const i = grid.findIndex((r) => r.some((c) => /^\d{13}$/.test(c.replace(/[\s-]/g, ''))))
  return i <= 0 ? 1 : Math.min(i, DLA_HEADER_ROWS)
}

const isBlank = (row: string[]): boolean => row.every((c) => c === '')

export const parseDla = (bytes: ArrayBuffer): ParsedDla => {
  const wb = readWorkbook(bytes)
  const result: ParsedDla = { sheets: [], skippedSheets: [], card: null }

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const grid = sheetToGrid(ws)

    if (name.trim().toLowerCase() === 'card') {
      const headerRows = firstDataRow(grid)
      const card: DlaCardSheet = {
        headers: headerPaths(ws, grid, headerRows),
        rows: grid
          .map((cells, i) => ({ rowNo: i + 1, cells }))
          .slice(headerRows)
          .filter((r) => !isBlank(r.cells)),
      }
      result.card = card
      continue
    }

    const m = name.match(CLASS_SHEET_RE)
    if (!m) {
      result.skippedSheets.push({
        name,
        reason: /^d\d+-\d+/.test(name)
          ? 'ชื่อชีตไม่ตรงรูปแบบ d{ชั้น}-{ห้อง} (น่าจะเป็นชีตสำเนาเก่า) — ข้าม'
          : 'ไม่ใช่ชีตห้องเรียน — ข้าม',
      })
      continue
    }

    const level = Number(m[1])
    const room = Number(m[2])
    const sheet: DlaSheet = {
      name,
      level,
      room,
      headers: headerPaths(ws, grid, DLA_HEADER_ROWS),
      rows: grid
        .map((cells, i) => ({ sheet: name, rowNo: i + 1, level, room, cells }))
        .slice(DLA_HEADER_ROWS)
        .filter((r) => !isBlank(r.cells)),
    }
    result.sheets.push(sheet)
  }
  return result
}
