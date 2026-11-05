/**
 * The plain PDF layout used until the school's official format is supplied: a
 * minimal letterhead, the tables, and a page-number footer. No signature block
 * (`afterBody` is left out) — the official template adds one.
 */
import { SCHOOL_AFFILIATION, SCHOOL_NAME } from '../../../labels.ts'
import type { PdfTemplate } from '../layout.ts'

export const PLAIN_TEMPLATE: PdfTemplate = {
  letterhead: (doc) => ({
    margin: [0, 0, 0, 12],
    stack: [
      { alignment: 'center', style: 'school', text: SCHOOL_NAME },
      { alignment: 'center', text: SCHOOL_AFFILIATION },
      { alignment: 'center', margin: [0, 6, 0, 6], style: 'title', text: doc.title },
      ...doc.meta.map((m) => ({ text: [{ bold: true, text: `${m.label}: ` }, m.value] })),
    ],
  }),
  pageFooter: (page, pages, ctx) => ({
    columns: [
      { style: 'note', text: `พิมพ์เมื่อ ${ctx.printedOn}` },
      { alignment: 'right', style: 'note', text: `หน้า ${page}/${pages}` },
    ],
    margin: [40, 10, 40, 0],
  }),
  pageMargins: [40, 36, 40, 44],
  pageSize: 'A4',
  styles: {
    heading: { bold: true, fontSize: 13, margin: [0, 4, 0, 4] },
    note: { fontSize: 9 },
    paragraph: { fontSize: 11 },
    school: { bold: true, fontSize: 16 },
    strong: { bold: true, fontSize: 12 },
    tableFooter: { bold: true },
    tableHeader: { bold: true },
    title: { bold: true, fontSize: 15 },
  },
}
