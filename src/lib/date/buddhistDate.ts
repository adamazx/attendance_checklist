/**
 * Parse Buddhist-era (พ.ศ.) dates from source files into the canonical calendar
 * day `YYYY-MM-DD` (ค.ศ.), the format every stored day uses.
 *
 * Accepts `DD/MM/YYYY` (also `D/M/YYYY`, `-` or `.` separators, Thai digits) with a
 * พ.ศ. year, e.g. `15/03/2557` → `2014-03-15`. A cell Excel stored as a real date
 * arrives from SheetJS as a serial number; it is converted, and a year > 2400 means
 * the พ.ศ. year was typed into a date cell, so 543 is subtracted.
 */
import { BE_OFFSET, isRealThaiDay } from './thaiDay.ts'

const pad = (n: number): string => String(n).padStart(2, '0')

const toDay = (y: number, m: number, d: number): string | null => {
  const day = `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`
  return isRealThaiDay(day) ? day : null
}

/** Excel serial (1900 date system) → [year, month, day] in UTC. */
const fromSerial = (serial: number): [number, number, number] => {
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  const dt = new Date(ms)
  return [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()]
}

/**
 * Returns the canonical day, `null` for an empty cell, or `undefined` when the
 * value is present but not a valid พ.ศ. date (the caller reports it).
 */
export const parseBEDate = (raw: unknown): string | null | undefined => {
  if (raw == null) return null
  const s = String(raw)
    .trim()
    .replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 0x0e50))
  if (!s) return null

  if (/^\d+(\.\d+)?$/.test(s) && Number(s) > 59 && Number(s) < 300000) {
    const [y, m, d] = fromSerial(Number(s))
    return toDay(y > 2400 ? y - BE_OFFSET : y, m, d) ?? undefined
  }

  const match = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (!match) return undefined
  const [, d, m, be] = match.map(Number) as [number, number, number, number]
  if (be < 2400) return undefined // a ค.ศ. year here would be silently wrong
  return toDay(be - BE_OFFSET, m, d) ?? undefined
}
