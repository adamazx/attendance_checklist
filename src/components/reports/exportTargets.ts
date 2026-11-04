/**
 * Each exportable report: load the same view as its page, then turn it into an
 * ExportDoc. Returns `forbidden` when the URL names something outside the user's
 * scope — checked by membership in the allowed list, never by comparing to the
 * page's fallback choice.
 */
import { classroomDoc, lateDoc, studentDoc, type ExportHeader } from '@/lib/reports/export/documents'
import type { ExportDoc } from '@/lib/reports/export/model'
import type { ReportKey } from '@/lib/reports/export/registry'

import { loadClassroomView, loadLateView, loadStudentView, type RoomContext } from './reportViews'

export type ExportResult = { doc: ExportDoc } | { forbidden: true }

/** A query param that is present must be a single value from `allowed`. */
export const paramAllowed = (raw: string | string[] | undefined, allowed: readonly { id: number }[]): boolean =>
  raw === undefined || (typeof raw === 'string' && allowed.some((a) => String(a.id) === raw))

const headerOf = (ctx: RoomContext): ExportHeader => ({
  activity: ctx.activity,
  activityName: ctx.activityName,
  classroomName: ctx.classroom.name,
  range: ctx.range,
})

export const EXPORT_TARGETS: Record<ReportKey, (ctx: RoomContext) => Promise<ExportResult>> = {
  classroom: async (ctx) => ({ doc: classroomDoc(headerOf(ctx), await loadClassroomView(ctx)) }),
  late: async (ctx) => ({ doc: lateDoc(headerOf(ctx), await loadLateView(ctx)) }),
  student: async (ctx) => {
    const view = await loadStudentView(ctx)
    if (!paramAllowed(ctx.params.student, view.students)) return { forbidden: true }
    return { doc: studentDoc(headerOf(ctx), view, new Map(ctx.classrooms.map((c) => [c.id, c.name]))) }
  },
}
