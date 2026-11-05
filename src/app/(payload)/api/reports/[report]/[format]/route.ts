/**
 * GET /api/reports/{classroom|student|late}/{xlsx|pdf}?classroom&from&to&activity[&student]
 *
 * Downloads a report exactly as its page shows it for the same query: the same
 * loadReportContext (sign-in, role-scoped classrooms, range and activity parsing),
 * the same view loaders and aggregate.ts numbers. Signed out → redirect to /login,
 * like the page. Unlike the page — which quietly falls back to the first room — a
 * `classroom` (or `student`) param outside the user's scope is a 403, so a file is
 * never silently about something other than what was asked for.
 *
 * Takes precedence over the `/api/[...slug]` catch-all (more specific segments win).
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { EXPORT_TARGETS, paramAllowed } from '@/components/reports/exportTargets'
import { loadReportContext } from '@/components/reports/loadReportContext'
import { contentDisposition } from '@/lib/reports/export/filename'
import { renderPdf } from '@/lib/reports/export/pdf/render'
import { PLAIN_TEMPLATE } from '@/lib/reports/export/pdf/templates/plain'
import { EXPORT_FORMATS, isExportFormat, isReportKey } from '@/lib/reports/export/registry'
import { renderXlsx } from '@/lib/reports/export/xlsx'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const forbidden = () => NextResponse.json({ error: 'ไม่มีสิทธิ์ดาวน์โหลดรายงานของห้องนี้' }, { status: 403 })

/** URLSearchParams → the shape Next gives a page (repeated keys become arrays). */
const toPageParams = (search: URLSearchParams): Record<string, string | string[]> => {
  const out: Record<string, string | string[]> = {}
  for (const key of new Set(search.keys())) {
    const all = search.getAll(key)
    out[key] = all.length === 1 ? all[0]! : all
  }
  return out
}

export async function GET(request: NextRequest, props: { params: Promise<{ format: string; report: string }> }) {
  const { format, report } = await props.params
  if (!isReportKey(report) || !isExportFormat(format)) {
    return NextResponse.json({ error: 'ไม่พบรายงาน' }, { status: 404 })
  }

  const ctx = await loadReportContext(Promise.resolve(toPageParams(request.nextUrl.searchParams)))
  const { classroom } = ctx
  if (!classroom || !paramAllowed(ctx.params.classroom, ctx.classrooms)) return forbidden()

  const result = await EXPORT_TARGETS[report]({ ...ctx, classroom })
  if ('forbidden' in result) return forbidden()

  const { doc } = result
  try {
    const file = format === 'xlsx' ? await renderXlsx(doc) : await renderPdf(doc, PLAIN_TEMPLATE)
    return new Response(new Uint8Array(file), {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': contentDisposition(
          `${doc.filenameBase}.${format}`,
          `report-${report}-${ctx.range.from}_${ctx.range.to}.${format}`,
        ),
        'Content-Type': EXPORT_FORMATS[format],
      },
    })
  } catch (err) {
    ctx.req.payload.logger.error({ err, msg: `report export failed (${report}.${format})` })
    return NextResponse.json({ error: 'สร้างไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }, { status: 500 })
  }
}
