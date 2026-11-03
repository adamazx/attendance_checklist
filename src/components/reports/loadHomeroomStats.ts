import { loadReportContext, type ReportSearchParams } from '@/components/reports/loadReportContext'
import { countStatuses, filterByActivity, presentRate, summarizeByDay, summarizeByStudent } from '@/lib/reports/aggregate'
import { loadRangeRecords, loadReportStudents } from '@/lib/reports/queries'

/**
 * The homeroom statistics for the stats and charts pages: the same context, loaders
 * and aggregation as รายงานรายห้อง (so the numbers match it for the same classroom and
 * range), always homeroom only, and defaulting to เทอมนี้.
 */
export async function loadHomeroomStats(searchParams: ReportSearchParams) {
  const context = await loadReportContext(searchParams, { defaultRange: 'term' })
  const { classroom, range, req } = context
  if (!classroom) return { ...context, stats: null }

  const allRecords = await loadRangeRecords(req, { classroomId: classroom.id, from: range.from, to: range.to })
  const students = await loadReportStudents(
    req,
    classroom.id,
    allRecords.map((r) => r.studentId),
  )
  const records = filterByActivity(allRecords, 'homeroom')
  const counts = countStatuses(records)

  return {
    ...context,
    stats: {
      counts,
      days: summarizeByDay(allRecords, 'homeroom'),
      rate: presentRate(counts),
      studentCount: summarizeByStudent(allRecords, students, 'homeroom').length,
      total: records.length,
    },
  }
}
