/**
 * ExportDoc + PdfTemplate → a pdfmake document definition. Pure data (no rendering),
 * so it is unit-tested directly.
 *
 * The page is assembled from separate pieces so the official layout can replace any
 * of them without touching the data layer (views → ExportDoc):
 *
 *   ┌ template.pageHeader(page, pages)   running band on every page (optional)
 *   │ template.letterhead(doc)           school / title / meta block, page 1
 *   │ renderBody(doc.blocks)             the report tables (shared by all templates)
 *   │ template.afterBody(doc)            ← SIGNATURE BLOCK SLOT (official template)
 *   └ template.pageFooter(page, pages)   running band on every page
 *
 * To add the official format: write `templates/official.ts` implementing PdfTemplate
 * (its own letterhead, footer and an `afterBody` with the signature lines) and pass
 * it instead of PLAIN_TEMPLATE in the export route. Nothing else changes.
 */
import type { Content, ContextPageSize, StyleDictionary, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'

import { formatRate } from '../../aggregate.ts'
import { DASH, type ColumnKind, type ExportBlock, type ExportCell, type ExportDoc } from '../model.ts'

/** The font family render.ts registers (vendored Sarabun, embedded + subset). */
export const PDF_FONT = 'Sarabun'

export interface PdfRenderContext {
  /** When the file was generated, already formatted (พ.ศ.). */
  printedOn: string
}

export interface PdfTemplate {
  /** Content after the tables: the official template's signature block goes here. */
  afterBody?: (doc: ExportDoc, ctx: PdfRenderContext) => Content[]
  /** Top of the first page: school name, สังกัด, title, classroom/range. */
  letterhead: (doc: ExportDoc, ctx: PdfRenderContext) => Content
  /** [left, top, right, bottom] in points; leave room for header/footer bands. */
  pageMargins: [number, number, number, number]
  pageFooter?: (page: number, pages: number, ctx: PdfRenderContext) => Content
  pageHeader?: (page: number, pages: number, pageSize: ContextPageSize) => Content
  pageSize: 'A4'
  styles: StyleDictionary
}

/** A cell as the page prints it: `—` for empty, %มา with one decimal. */
export const formatCell = (cell: ExportCell, kind: ColumnKind): string => {
  if (kind === 'percent') return formatRate(typeof cell === 'number' ? cell : null)
  if (cell === null || cell === '') return DASH
  return String(cell)
}

const align = (kind: ColumnKind) => (kind === 'text' ? 'left' : 'right')

const renderBlock = (block: ExportBlock): Content => {
  if (block.type === 'paragraph') {
    return { style: block.style === 'note' ? 'note' : block.style === 'strong' ? 'strong' : 'paragraph', text: block.text }
  }

  const { columns } = block
  // The last text column (name or หมายเหตุ) takes the spare width; the rest fit content.
  const stretch = columns.map((c) => c.kind).lastIndexOf('text')
  const header: TableCell[] = columns.map((c) => ({ alignment: align(c.kind), style: 'tableHeader', text: c.header }))
  const body: TableCell[][] = block.rows.map((row) =>
    columns.map((c, i) => ({ alignment: align(c.kind), text: formatCell(row[i] ?? null, c.kind) })),
  )
  if (block.footer) {
    const { cells, label, span } = block.footer
    body.push([
      { colSpan: span, style: 'tableFooter', text: label },
      ...Array.from({ length: span - 1 }, () => ({ text: '' })),
      ...cells.map((v, i) => {
        const kind = columns[span + i]?.kind ?? 'text'
        return { alignment: align(kind), style: 'tableFooter', text: formatCell(v, kind) }
      }),
    ])
  }

  const table: Content = {
    layout: 'lightHorizontalLines',
    table: {
      body: [header, ...body],
      dontBreakRows: true,
      headerRows: 1,
      widths: columns.map((_, i) => (i === stretch ? '*' : 'auto')),
    },
  }
  return block.heading ? { stack: [{ style: 'heading', text: block.heading }, table] } : table
}

/** The report tables and paragraphs, the same for every template. */
export const renderBody = (blocks: readonly ExportBlock[]): Content[] =>
  blocks.map((b) => ({ margin: [0, 0, 0, 10], stack: [renderBlock(b)] }) as Content)

export const buildPdfDocument = (
  doc: ExportDoc,
  template: PdfTemplate,
  ctx: PdfRenderContext,
): TDocumentDefinitions => ({
  content: [template.letterhead(doc, ctx), ...renderBody(doc.blocks), ...(template.afterBody?.(doc, ctx) ?? [])],
  defaultStyle: { font: PDF_FONT, fontSize: 11, lineHeight: 1.15 },
  footer: template.pageFooter ? (page, pages) => template.pageFooter!(page, pages, ctx) : undefined,
  header: template.pageHeader,
  info: { creator: 'ระบบครูที่ปรึกษา', title: doc.title },
  pageMargins: template.pageMargins,
  pageOrientation: doc.orientation,
  pageSize: template.pageSize,
  styles: template.styles,
})
