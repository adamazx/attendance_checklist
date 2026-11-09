/**
 * Bulk student-photo import — pure file-name logic shared by the browser panel
 * (PhotoImportPanel) and the dry-run match route (/api/students/photo-match).
 *
 * Files are named by **studentId** (decision D5). A stem that looks like a Thai
 * national ID (13 digits, optionally with spaces/dashes) is refused in the browser
 * and never sent anywhere; the route refuses it again as a defence.
 *
 * No path aliases here so `node --test --experimental-strip-types` can load it.
 */

/** Same cap as payload.config.ts `upload.limits.fileSize` (below Vercel's 4.5 MB body limit). */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024
export const ACCEPTED_EXT: readonly string[] = ['jpg', 'jpeg', 'png']

export const MATCH_LIMITS = {
  maxStems: 3000,
  maxStemLength: 64,
  /** Byte cap for the match route's JSON body. */
  maxBodyBytes: 256 * 1024,
} as const

export type RejectReason = 'nationalId' | 'wrongType' | 'tooLarge' | 'duplicate' | 'emptyStem'

export interface FileLike {
  name: string
  size: number
}

export interface EligibleFile {
  index: number
  name: string
  stem: string
  ext: string
  size: number
}

export interface RejectedFile {
  index: number
  name: string
  stem: string
  size: number
  reason: RejectReason
}

export interface MatchedStudent {
  id: number
  studentId: string
  name: string
  classroom: string
}

export interface MatchResult {
  stem: string
  status: 'matched' | 'notFound' | 'ambiguous'
  student?: MatchedStudent
  photoId: number | null
}

export interface PlanItem extends EligibleFile {
  student: MatchedStudent
  /** Existing photo doc id (replace → PATCH it). */
  photoId: number | null
}

export interface UploadPlan {
  /** New photos → POST /api/student-photos. */
  upload: PlanItem[]
  /** Student already has a photo and "แทนรูปเดิม" is ticked → PATCH. */
  replaceExisting: PlanItem[]
  /** Student already has a photo and replace is off → skipped. */
  skipExisting: PlanItem[]
  notFound: EligibleFile[]
  /** More than one student with this studentId — never uploaded. */
  ambiguous: EligibleFile[]
}

/** Split a file name into a trimmed stem and a lowercased extension (last dot). */
export const splitName = (name: string): { stem: string; ext: string } => {
  const base = name.split(/[\\/]/).pop() ?? name
  const dot = base.lastIndexOf('.')
  if (dot < 0) return { stem: base.trim(), ext: '' }
  return { stem: base.slice(0, dot).trim(), ext: base.slice(dot + 1).trim().toLowerCase() }
}

/**
 * True when a stem looks like a national ID: exactly 13 digits, or 13 digits once
 * spaces/dashes are removed (e.g. "1-2345-67890-12-3").
 */
export const looksLikeNationalId = (stem: string): boolean => {
  const s = stem.trim()
  if (/^\d{13}$/.test(s)) return true
  return /^[\d\s-]+$/.test(s) && s.replace(/[\s-]/g, '').length === 13
}

const JUNK_NAMES = new Set(['thumbs.db', 'desktop.ini', 'ehthumbs.db', '.ds_store'])

/** OS junk / hidden files a folder picker drags in — dropped silently. */
export const isJunkFile = (name: string): boolean => {
  const base = (name.split(/[\\/]/).pop() ?? name).trim()
  return base.startsWith('.') || JUNK_NAMES.has(base.toLowerCase())
}

/** Browser pre-check: classify every file; only `eligible` stems are ever sent to the server. */
export const precheck = (
  files: readonly FileLike[],
): { eligible: EligibleFile[]; rejected: RejectedFile[] } => {
  const rejected: RejectedFile[] = []
  const passed: EligibleFile[] = []
  files.forEach((f, index) => {
    const { stem, ext } = splitName(f.name)
    const reject = (reason: RejectReason) => rejected.push({ index, name: f.name, stem, size: f.size, reason })
    if (looksLikeNationalId(stem)) return reject('nationalId')
    if (!ACCEPTED_EXT.includes(ext)) return reject('wrongType')
    if (stem === '') return reject('emptyStem')
    if (f.size > MAX_PHOTO_BYTES) return reject('tooLarge')
    passed.push({ index, name: f.name, stem, ext, size: f.size })
  })
  const counts = new Map<string, number>()
  for (const f of passed) counts.set(f.stem, (counts.get(f.stem) ?? 0) + 1)
  const eligible: EligibleFile[] = []
  for (const f of passed) {
    if ((counts.get(f.stem) ?? 0) > 1) rejected.push({ ...f, reason: 'duplicate' })
    else eligible.push(f)
  }
  rejected.sort((a, b) => a.index - b.index)
  return { eligible, rejected }
}

/** Combine the browser pre-check with the server match into what will happen on confirm. */
export const buildPlan = (
  eligible: readonly EligibleFile[],
  results: readonly MatchResult[],
  replace: boolean,
): UploadPlan => {
  const byStem = new Map(results.map((r) => [r.stem, r]))
  const plan: UploadPlan = { upload: [], replaceExisting: [], skipExisting: [], notFound: [], ambiguous: [] }
  for (const f of eligible) {
    const r = byStem.get(f.stem)
    if (!r || r.status === 'notFound' || !r.student) {
      if (r?.status === 'ambiguous') plan.ambiguous.push(f)
      else plan.notFound.push(f)
      continue
    }
    if (r.status === 'ambiguous') {
      plan.ambiguous.push(f)
      continue
    }
    const item: PlanItem = { ...f, student: r.student, photoId: r.photoId }
    if (r.photoId == null) plan.upload.push(item)
    else if (replace) plan.replaceExisting.push(item)
    else plan.skipExisting.push(item)
  }
  return plan
}

/**
 * Validate the match route's `stems` input. Returns the stems, or a generic Thai
 * error that never echoes the offending value.
 */
export const validateStems = (input: unknown): { stems: string[] } | { error: string } => {
  if (!Array.isArray(input) || input.length === 0) return { error: 'ต้องส่งรายชื่อไฟล์ (stems) อย่างน้อย 1 รายการ' }
  if (input.length > MATCH_LIMITS.maxStems) return { error: `ส่งได้ไม่เกิน ${MATCH_LIMITS.maxStems} รายการต่อครั้ง` }
  const seen = new Set<string>()
  for (const s of input) {
    if (typeof s !== 'string' || s.trim() === '' || s !== s.trim() || s.length > MATCH_LIMITS.maxStemLength) {
      return { error: 'ชื่อไฟล์ไม่ถูกต้อง' }
    }
    if (looksLikeNationalId(s)) return { error: 'ห้ามใช้เลขประจำตัวประชาชนเป็นชื่อไฟล์' }
    if (seen.has(s)) return { error: 'มีชื่อไฟล์ซ้ำในรายการ' }
    seen.add(s)
  }
  return { stems: input as string[] }
}
