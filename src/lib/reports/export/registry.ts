/**
 * The exportable reports and file formats. A new export target (e.g. the stats page)
 * is one more key here plus one entry in `@/components/reports/exportTargets`.
 */
export const REPORT_KEYS = ['classroom', 'student', 'late'] as const
export type ReportKey = (typeof REPORT_KEYS)[number]

export const EXPORT_FORMATS = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const
export type ExportFormat = keyof typeof EXPORT_FORMATS

export const isReportKey = (v: string): v is ReportKey => (REPORT_KEYS as readonly string[]).includes(v)
export const isExportFormat = (v: string): v is ExportFormat => Object.hasOwn(EXPORT_FORMATS, v)
