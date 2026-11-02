import config from '@payload-config'
import { createLocalReq, getPayload } from 'payload'

import { requireUser } from '@/lib/auth/currentUser'
import { todayThai } from '@/lib/date/thaiDay'
import { parseRange, quickRanges } from '@/lib/reports/dateRange'
import { listReportClassrooms, loadActiveTerm } from '@/lib/reports/queries'

export type ReportSearchParams = Promise<{
  classroom?: string | string[]
  from?: string | string[]
  student?: string | string[]
  to?: string | string[]
}>

export const one = (v: string | string[] | undefined): string | undefined => (typeof v === 'string' ? v : undefined)

/**
 * What every report page needs: the signed-in user's request, the classrooms they
 * may report on, the chosen one (a classroom outside that list falls back to the
 * first), and the resolved date range. Each page calls this itself, so each page
 * runs requireUser().
 */
export async function loadReportContext(searchParams: ReportSearchParams) {
  const user = await requireUser()
  const params = await searchParams
  const payload = await getPayload({ config })
  const req = await createLocalReq({ user }, payload)
  const [classrooms, activeTerm] = await Promise.all([listReportClassrooms(req), loadActiveTerm(req)])

  const today = todayThai()
  const range = parseRange({ from: one(params.from), to: one(params.to) }, today)
  const classroom = classrooms.find((c) => String(c.id) === one(params.classroom)) ?? classrooms[0] ?? null

  return { classroom, classrooms, params, quick: quickRanges(today, activeTerm), range, req, today }
}
