/**
 * Turn an uploaded roster file into a grid of string cells (array of rows,
 * each row an array of trimmed string cells). The first row is the header.
 *
 * Supports:
 *  - CSV exported from Excel, incl. UTF-8 **with BOM** (the BOM is stripped by
 *    TextDecoder), Thai text, quoted fields, embedded newlines, and `,`/`;`/tab
 *    delimiters (auto-detected from the header line).
 *  - .xlsx / .xls workbooks via SheetJS (first worksheet only).
 */
import * as XLSX from 'xlsx'

export type Grid = string[][]

const isXlsxName = (fileName: string): boolean => /\.xlsx?$/i.test(fileName)

/** Detect the most likely CSV delimiter from the first non-empty line. */
const detectDelimiter = (text: string): string => {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? ''
  const candidates: Array<[string, number]> = [
    [',', (firstLine.match(/,/g) ?? []).length],
    [';', (firstLine.match(/;/g) ?? []).length],
    ['\t', (firstLine.match(/\t/g) ?? []).length],
  ]
  candidates.sort((a, b) => b[1] - a[1])
  return candidates[0][1] > 0 ? candidates[0][0] : ','
}

/**
 * Minimal RFC-4180-style CSV parser: handles quoted fields, `""` escapes, and
 * newlines inside quotes. `delimiter` is a single character.
 */
const parseCsv = (text: string, delimiter: string): Grid => {
  const rows: Grid = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  let i = 0

  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    pushField()
    rows.push(row)
    row = []
  }

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (ch === delimiter) {
      pushField()
      i += 1
      continue
    }
    if (ch === '\r') {
      // Swallow CR; handle the row break on the following LF (or here if lone CR).
      if (text[i + 1] === '\n') {
        pushRow()
        i += 2
      } else {
        pushRow()
        i += 1
      }
      continue
    }
    if (ch === '\n') {
      pushRow()
      i += 1
      continue
    }
    field += ch
    i += 1
  }
  // Flush the final field/row if the file did not end with a newline.
  if (field.length > 0 || row.length > 0) pushRow()

  return rows
}

/** Trim every cell (stringified). */
const trimCells = (grid: Grid): Grid => grid.map((r) => r.map((c) => (c ?? '').toString().trim()))

/** Drop fully-empty rows and trim every cell. */
export const normalizeGrid = (grid: Grid): Grid => trimCells(grid).filter((r) => r.some((c) => c.length > 0))

/** Read a .xls (BIFF) / .xlsx workbook. Shared by the roster and DLA importers. */
export const readWorkbook = (bytes: ArrayBuffer): XLSX.WorkBook => XLSX.read(new Uint8Array(bytes), { type: 'array' })

/**
 * A worksheet as a grid of trimmed string cells, with blank rows KEPT so a grid
 * index maps back to the spreadsheet row (index 0 = row 1).
 *
 * `raw: true` returns underlying values (numbers stay numbers, text stays text)
 * rather than Excel's *formatted* text. JS prints integers up to 1e21 without an
 * exponent — so a 13-digit numeric ID (e.g. 1234567890123) survives intact,
 * whereas `raw: false` would format it to "1.23457E+12". A real date cell comes
 * back as its serial number; the DLA date parser handles that case.
 */
export const sheetToGrid = (sheet: XLSX.WorkSheet): Grid =>
  trimCells(
    XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
      header: 1,
      blankrows: true,
      defval: '',
      raw: true,
    }) as unknown as Grid,
  )

export const parseRoster = (fileName: string, bytes: ArrayBuffer): Grid => {
  if (isXlsxName(fileName)) {
    const wb = readWorkbook(bytes)
    const sheetName = wb.SheetNames[0]
    if (!sheetName) return []
    return normalizeGrid(sheetToGrid(wb.Sheets[sheetName]))
  }

  // CSV / text: decode as UTF-8 (default TextDecoder strips a leading BOM).
  const text = new TextDecoder('utf-8').decode(bytes)
  const delimiter = detectDelimiter(text)
  return normalizeGrid(parseCsv(text, delimiter))
}
