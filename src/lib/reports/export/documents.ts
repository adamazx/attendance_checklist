/**
 * Report views → ExportDoc, column for column what each report page renders
 * (same headers, order, conditional columns and empty states). No stats are
 * computed here: every number comes from the view (`../views`), i.e. aggregate.ts.
 */
import { ATTENDANCE_STATUSES, statusInfo } from '../../attendance/statuses.ts'
import { formatThaiDayLong } from '../../date/thaiDay.ts'
import type { ActivityFilter, ReportStudent } from '../aggregate.ts'
import type { DateRange } from '../dateRange.ts'
import {
  DEPARTED_SUFFIX,
  EMPTY_LATE,
  EMPTY_RECORDS,
  EMPTY_STUDENTS,
  activityFilterLabel,
  formatRange,
  rateFootnote,
  recordActivityName,
  totalLabel,
} from '../labels.ts'
import type { ClassroomView, LateView, StudentView } from '../views.ts'
import { filenameBase, rangePart } from './filename.ts'
import { DASH, type ExportBlock, type ExportColumn, type ExportDoc } from './model.ts'

export const REPORT_TITLES = {
  classroom: 'รายงานรายห้อง',
  late: 'นักเรียนมาสาย',
  student: 'รายงานนักเรียน',
} as const

/** What every report header needs, from the resolved report context. */
export interface ExportHeader {
  activity: ActivityFilter
  activityName: ReadonlyMap<number, string>
  classroomName: string
  range: DateRange
}

const studentName = (s: ReportStudent): string => (s.departed ? `${s.name} ${DEPARTED_SUFFIX}` : s.name)

const roomMeta = (h: ExportHeader) => [
  { label: 'ห้อง', value: h.classroomName },
  { label: 'วิชา/กิจกรรม', value: activityFilterLabel(h.activity, h.activityName) },
  { label: 'ช่วงวันที่', value: formatRange(h.range) },
]

const statusColumns = (): ExportColumn[] => ATTENDANCE_STATUSES.map((s) => ({ header: s.label, kind: 'int' }))

const empty = (text: string): ExportBlock[] => [{ text, type: 'paragraph' }]

export const classroomDoc = (h: ExportHeader, view: ClassroomView): ExportDoc => ({
  blocks:
    view.recordCount === 0
      ? empty(EMPTY_RECORDS)
      : [
          {
            columns: [
              { header: 'เลขที่', kind: 'int' },
              { header: 'รหัส', kind: 'text' },
              { header: 'ชื่อ - นามสกุล', kind: 'text' },
              ...statusColumns(),
              { header: totalLabel(h.activity), kind: 'int' },
              { header: '%มา', kind: 'percent' },
            ],
            footer: {
              cells: [...ATTENDANCE_STATUSES.map((s) => view.totals[s.value]), view.recordCount, view.totalRate],
              label: `รวมทั้งห้อง (${view.rows.length} คน)`,
              span: 3,
            },
            rows: view.rows.map((row) => [
              row.student.classNumber,
              row.student.studentCode,
              studentName(row.student),
              ...ATTENDANCE_STATUSES.map((s) => row.counts[s.value]),
              row.total,
              row.rate,
            ]),
            type: 'table',
          },
          { style: 'note', text: rateFootnote(h.activity), type: 'paragraph' },
        ],
  filenameBase: filenameBase([REPORT_TITLES.classroom, h.classroomName, rangePart(h.range)]),
  meta: roomMeta(h),
  orientation: 'landscape',
  sheetName: REPORT_TITLES.classroom,
  title: REPORT_TITLES.classroom,
})

export const studentDoc = (
  h: ExportHeader,
  view: StudentView,
  classroomNames: ReadonlyMap<number, string>,
): ExportDoc => {
  const { student } = view
  const base = {
    orientation: 'portrait' as const,
    sheetName: REPORT_TITLES.student,
    title: REPORT_TITLES.student,
  }
  if (!student) {
    return {
      ...base,
      blocks: empty(EMPTY_STUDENTS),
      filenameBase: filenameBase([REPORT_TITLES.student, h.classroomName, rangePart(h.range)]),
      meta: roomMeta(h),
    }
  }

  const all = h.activity === 'all'
  const columns: ExportColumn[] = [
    { header: 'ลำดับ', kind: 'int' },
    { header: 'วันที่', kind: 'text' },
    ...(view.multiRoom ? [{ header: 'ห้อง', kind: 'text' as const }] : []),
    ...(all ? [{ header: 'วิชา/กิจกรรม', kind: 'text' as const }] : []),
    { header: 'สถานะ', kind: 'text' },
    { header: 'หมายเหตุ', kind: 'text' },
  ]

  return {
    ...base,
    blocks: [
      {
        columns: [...statusColumns(), { header: totalLabel(h.activity), kind: 'int' }, { header: '%มา', kind: 'percent' }],
        heading: 'สรุปสถานะ',
        rows: [[...ATTENDANCE_STATUSES.map((s) => view.counts[s.value]), view.records.length, view.rate]],
        type: 'table',
      },
      ...(view.records.length === 0
        ? empty(EMPTY_RECORDS)
        : [
            {
              columns,
              heading: 'รายการเช็คชื่อ',
              rows: view.records.map((r, i) => [
                i + 1,
                formatThaiDayLong(r.date),
                ...(view.multiRoom ? [(r.classroomId && classroomNames.get(r.classroomId)) ?? DASH] : []),
                ...(all ? [recordActivityName(r.activityId, h.activityName)] : []),
                statusInfo(r.status).label,
                r.note || DASH,
              ]),
              type: 'table' as const,
            },
          ]),
    ],
    filenameBase: filenameBase([REPORT_TITLES.student, h.classroomName, student.studentCode, rangePart(h.range)]),
    meta: [
      { label: 'ชื่อ - นามสกุล', value: studentName(student) },
      { label: 'เลขประจำตัว', value: student.studentCode },
      {
        label: 'ห้อง',
        value: student.classNumber != null ? `${h.classroomName} เลขที่ ${student.classNumber}` : h.classroomName,
      },
      { label: 'วิชา/กิจกรรม', value: activityFilterLabel(h.activity, h.activityName) },
      { label: 'ช่วงวันที่', value: formatRange(h.range) },
    ],
  }
}

export const lateDoc = (h: ExportHeader, view: LateView): ExportDoc => {
  const { late } = view
  const all = h.activity === 'all'
  return {
    blocks:
      late.total === 0
        ? empty(EMPTY_LATE)
        : [
            { style: 'strong', text: `มาสายรวม ${late.total} ครั้ง · ${late.perStudent.length} คน`, type: 'paragraph' },
            {
              columns: [
                { header: 'เลขที่', kind: 'int' },
                { header: 'ชื่อ - นามสกุล', kind: 'text' },
                { header: 'จำนวนครั้งที่สาย', kind: 'int' },
              ],
              heading: 'สรุปรายคน',
              rows: late.perStudent.map(({ count, student }) => [student.classNumber, studentName(student), count]),
              type: 'table',
            },
            {
              columns: [
                { header: 'วันที่', kind: 'text' },
                { header: 'เลขที่', kind: 'int' },
                { header: 'ชื่อ - นามสกุล', kind: 'text' },
                ...(all ? [{ header: 'วิชา/กิจกรรม', kind: 'text' as const }] : []),
                { header: 'หมายเหตุ', kind: 'text' },
              ],
              heading: 'รายการมาสาย',
              rows: late.rows.map(({ record, student }) => [
                formatThaiDayLong(record.date),
                student.classNumber,
                studentName(student),
                ...(all ? [recordActivityName(record.activityId, h.activityName)] : []),
                record.note || DASH,
              ]),
              type: 'table',
            },
          ],
    filenameBase: filenameBase([REPORT_TITLES.late, h.classroomName, rangePart(h.range)]),
    meta: roomMeta(h),
    orientation: 'portrait',
    sheetName: REPORT_TITLES.late,
    title: REPORT_TITLES.late,
  }
}
