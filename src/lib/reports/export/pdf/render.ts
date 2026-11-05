/**
 * Renders a report PDF on the server with pdfmake and the vendored Sarabun TTFs
 * (assets/fonts/sarabun). pdfkit embeds only the glyphs used (a subset), so Thai
 * renders in any viewer. Fonts are read from disk — never fetched — and pdfmake is
 * denied every URL and local path, so a document can't pull anything else in.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import pdfmake from 'pdfmake'

import { formatThaiDateTime } from '@/lib/date/thaiDay'

import type { ExportDoc } from '../model'
import { buildPdfDocument, PDF_FONT, type PdfTemplate } from './layout'

const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts', 'sarabun')
const REGULAR = 'Sarabun-Regular.ttf'
const BOLD = 'Sarabun-Bold.ttf'

let fontsReady: Promise<void> | null = null

const loadFonts = (): Promise<void> =>
  (fontsReady ??= (async () => {
    const [normal, bold] = await Promise.all([
      readFile(path.join(FONT_DIR, REGULAR)),
      readFile(path.join(FONT_DIR, BOLD)),
    ])
    // Font sources must be names: pdfmake's URL pass rewrites any non-string source.
    // Names found in its in-memory virtual fs are read from there, never from disk.
    const vfs = (pdfmake as unknown as { virtualfs: { writeFileSync: (name: string, data: Buffer) => void } })
      .virtualfs
    vfs.writeFileSync(REGULAR, normal)
    vfs.writeFileSync(BOLD, bold)
    pdfmake.setUrlAccessPolicy(() => false)
    pdfmake.setLocalAccessPolicy(() => false)
    pdfmake.addFonts({ [PDF_FONT]: { bold: BOLD, bolditalics: BOLD, italics: REGULAR, normal: REGULAR } })
  })().catch((err) => {
    fontsReady = null
    throw err
  }))

export async function renderPdf(doc: ExportDoc, template: PdfTemplate): Promise<Buffer> {
  await loadFonts()
  const definition = buildPdfDocument(doc, template, { printedOn: formatThaiDateTime(new Date()) })
  return pdfmake.createPdf(definition).getBuffer()
}
