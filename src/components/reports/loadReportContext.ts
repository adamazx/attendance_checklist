import config from '@payload-config'
import { createLocalReq, getPayload } from 'payload'

import { ALL_ACTIVITIES } from '@/components/attendance/ActivitySelect'
import { listActivities, type RollCallActivity } from '@/lib/attendance/rollCall'
import { requireUser } from '@/lib/auth/currentUser'
import { todayThai } from '@/lib/date/thaiDay'
import type { ActivityFilter } from '@/lib/reports/aggregate'
import { parseRange, quickRanges, type RangeNotice } from '@/lib/reports/dateRange'
import { listReportClassrooms, loadActiveTerm } from '@/lib/reports/queries'

export type ReportSearchParams = Promise<{
  activity?: string | string[]
  classroom?: string | string[]
  from?: string | string[]
  student?: string | string[]
  to?: string | string[]
}>

export const one = (v: string | string[] | undefined): string | undefined => (typeof v === 'string' ? v : undefined)

/** `activity` param → filter: absent, empty or unknown is the homeroom default. */
const parseActivity = (value: string | undefined, activities: RollCallActivity[]): ActivityFilter => {
  if (value === ALL_ACTIVITIES) return 'all'
  return activities.find((a) => String(a.id) === value)?.id ?? 'homeroom'
}

/** The filter as its URL/select value: `''` homeroom, `'all'`, or the id. */
export const activityParam = (filter: ActivityFilter): string =>
  filter === 'homeroom' ? '' : filter === 'all' ? ALL_ACTIVITIES : String(filter)

/** Extra query params for links that keep the activity filter (none for homeroom). */
export const activityLinkParams = (filter: ActivityFilter): Record<string, string> =>
  filter === 'homeroom' ? {} : { activity: activityParam(filter) }

/**
 * What every report page needs: the signed-in user's request, the classrooms they
 * may report on, the chosen one (a classroom outside that list falls back to the
 * first), the resolved date range, and the activity filter (homeroom by default).
 * Each page calls this itself, so each page runs requireUser(). With
 * `defaultRange: 'term'`, a request without from/to shows เทอมนี้ (when there is one).
 */
export async function loadReportContext(searchParams: ReportSearchParams, options: { defaultRange?: 'term' } = {}) {
  const user = await requireUser()
  const params = await searchParams
  const payload = await getPayload({ config })
  const req = await createLocalReq({ user }, payload)
  const [classrooms, activeTerm, activities] = await Promise.all([
    listReportClassrooms(req),
    loadActiveTerm(req),
    listActivities(req),
  ])

  const today = todayThai()
  const quick = quickRanges(today, activeTerm)
  const requested = { from: one(params.from), to: one(params.to) }
  const term = quick.find((q) => q.key === 'term')
  const range =
    options.defaultRange === 'term' && term && requested.from === undefined && requested.to === undefined
      ? { from: term.from, notices: [] as RangeNotice[], to: term.to }
      : parseRange(requested, today)
  const classroom = classrooms.find((c) => String(c.id) === one(params.classroom)) ?? classrooms[0] ?? null
  const activity = parseActivity(one(params.activity), activities)
  const activityName = new Map(activities.map((a) => [a.id, a.name]))

  return {
    activities,
    activity,
    activityName,
    classroom,
    classrooms,
    params,
    quick,
    range,
    req,
    today,
  }
}
