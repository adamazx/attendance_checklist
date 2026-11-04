/** Download file names and the Content-Disposition header for report exports. */
import { BE_OFFSET } from '../../date/thaiDay.ts'
import type { DateRange } from '../dateRange.ts'

/** `2026-11-05` → `2569-11-05` (พ.ศ., still sortable). */
export const beDay = (day: string): string => `${Number(day.slice(0, 4)) + BE_OFFSET}${day.slice(4)}`

/** The range part of a file name: `2569-11-01_2569-11-05`, or one day. */
export const rangePart = (range: DateRange): string =>
  range.from === range.to ? beDay(range.from) : `${beDay(range.from)}_${beDay(range.to)}`

/** Characters Windows/macOS reject in file names, control chars and whitespace → `-`. */
const UNSAFE = /[\\/:*?"<>|\u0000-\u001f\s]+/g

/** Parts joined by `_`, each made safe for a file name (`ม.4/2` → `ม.4-2`). */
export const filenameBase = (parts: readonly string[]): string =>
  parts
    .map((p) => p.replace(UNSAFE, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('_')

/**
 * `attachment` with an ASCII fallback name and the real (Thai) name as RFC 5987
 * `filename*`, which every current browser prefers.
 */
export const contentDisposition = (filename: string, asciiFallback: string): string =>
  `attachment; filename="${asciiFallback.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; filename*=UTF-8''${rfc5987(filename)}`

/** encodeURIComponent leaves `'()*` alone, but RFC 5987 values may not contain them. */
const rfc5987 = (value: string): string =>
  encodeURIComponent(value).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
