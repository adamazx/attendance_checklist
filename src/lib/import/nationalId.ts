/**
 * Thai national ID (เลขประจำตัวประชาชน) helpers: normalize, validate, mask.
 *
 * Format: 13 digits. The last digit is a mod-11 checksum of the first 12:
 *   check = (11 - (Σ d[i] * (13 - i)) mod 11) mod 10
 * Some non-Thai students carry IDs that fail the checksum, so callers treat a
 * checksum failure as a warning and only a non-13-digit value as an error.
 */

/** Strip spaces, dashes and dots; convert Thai digits. Returns '' for empty input. */
export const normalizeNationalId = (raw: unknown): string =>
  String(raw ?? '')
    .replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50))
    .replace(/[\s\-.]/g, '')

export const isNationalIdFormat = (id: string): boolean => /^\d{13}$/.test(id)

export const nationalIdChecksumOk = (id: string): boolean => {
  if (!isNationalIdFormat(id)) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i)
  return (11 - (sum % 11)) % 10 === Number(id[12])
}

/**
 * Mask all but the last 4 digits, keeping the 1-4-5-2-1 grouping:
 * `1234567890123` → `x-xxxx-xxxx0-12-3`.
 */
export const maskNationalId = (id: string | null | undefined): string => {
  const v = normalizeNationalId(id)
  if (!v) return ''
  if (!isNationalIdFormat(v)) return `${'x'.repeat(Math.max(0, v.length - 4))}${v.slice(-4)}`
  return `x-xxxx-xxxx${v[9]}-${v.slice(10, 12)}-${v[12]}`
}
