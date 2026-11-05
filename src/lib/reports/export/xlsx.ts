/**
 * ExportDoc → .xlsx (one sheet). Counts are number cells, %มา is a real percent cell
 * (`0.0%`, the page's one decimal), headers and summary rows are bold. No colors:
 * the file follows whatever theme Excel uses.
 */
import ExcelJS from 'exceljs'

import { SCHOOL_AFFILIATION, SCHOOL_NAME } from '../labels.ts'
import { DASH, type ColumnKind, type ExportCell, type ExportDoc } from './model.ts'

const PERCENT_FORMAT = '0.0%'
const MIN_WIDTH = 6
const MAX_WIDTH = 60

/** A cell's value as Excel should store it. */
const cellValue = (cell: ExportCell, kind: ColumnKind): number | string => {
  if (cell === null) return DASH
  if (kind === 'percent' && typeof cell === 'number') return cell / 100
  return cell
}

const styleCell = (cell: ExcelJS.Cell, kind: ColumnKind, value: ExportCell) => {
  if (kind === 'percent' && typeof value === 'number') cell.numFmt = PERCENT_FORMAT
  if (kind !== 'text') cell.alignment = { horizontal: 'right' }
}

/** Display width of a value (Thai combining marks take no column). */
const textWidth = (value: ExportCell, kind: ColumnKind): number => {
  if (value === null) return 1
  if (kind === 'percent' && typeof value === 'number') return `${value.toFixed(1)}%`.length
  return String(value).replace(/[ัิ-ฺ็-๎]/g, '').length
}

export async function renderXlsx(doc: ExportDoc): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = SCHOOL_NAME
  wb.created = new Date()
  const ws = wb.addWorksheet(doc.sheetName.slice(0, 31))
  const widths: number[] = []
  const fit = (col: number, w: number) => {
    widths[col] = Math.max(widths[col] ?? MIN_WIDTH, w + 2)
  }

  const title = ws.addRow([doc.title])
  title.font = { bold: true, size: 14 }
  ws.addRow([`${SCHOOL_NAME} ${SCHOOL_AFFILIATION}`])
  // One cell per line, so it spills across the (narrow) table columns.
  for (const m of doc.meta) ws.addRow([`${m.label}: ${m.value}`])

  let frozen = false
  for (const block of doc.blocks) {
    ws.addRow([])
    if (block.type === 'paragraph') {
      const row = ws.addRow([block.text])
      if (block.style === 'strong') row.font = { bold: true }
      if (block.style === 'note') row.font = { italic: true, size: 9 }
      continue
    }

    if (block.heading) ws.addRow([block.heading]).font = { bold: true, size: 12 }
    const header = ws.addRow(block.columns.map((c) => c.header))
    header.font = { bold: true }
    header.eachCell((cell, n) => {
      if (block.columns[n - 1]?.kind !== 'text') cell.alignment = { horizontal: 'right' }
    })
    block.columns.forEach((c, i) => fit(i, textWidth(c.header, 'text')))
    if (!frozen) {
      ws.views = [{ state: 'frozen', ySplit: header.number }]
      frozen = true
    }

    for (const cells of block.rows) {
      const row = ws.addRow(cells.map((v, i) => cellValue(v, block.columns[i]?.kind ?? 'text')))
      cells.forEach((v, i) => {
        const kind = block.columns[i]?.kind ?? 'text'
        styleCell(row.getCell(i + 1), kind, v)
        fit(i, textWidth(v, kind))
      })
    }

    if (block.footer) {
      const { cells, label, span } = block.footer
      const row = ws.addRow([label, ...Array(span - 1).fill(null), ...cells.map((v, i) => cellValue(v, block.columns[span + i]?.kind ?? 'text'))])
      row.font = { bold: true }
      if (span > 1) ws.mergeCells(row.number, 1, row.number, span)
      cells.forEach((v, i) => styleCell(row.getCell(span + i + 1), block.columns[span + i]?.kind ?? 'text', v))
    }
  }

  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = Math.min(MAX_WIDTH, w)
  })
  return Buffer.from(await wb.xlsx.writeBuffer())
}
