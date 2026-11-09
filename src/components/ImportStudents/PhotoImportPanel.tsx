'use client'

/**
 * Bulk student-photo import (decision D5): files named by studentId.
 *
 * 1. Browser pre-check (photoStems.precheck): type, ≤ 4MB, duplicates, and 13-digit
 *    (national-ID-looking) names — those never leave the browser.
 * 2. Dry run: POST /api/students/photo-match with the eligible stems only (JSON, no bytes).
 * 3. On confirm: each file is its own request through Payload REST — POST
 *    /api/student-photos (new) or PATCH /api/student-photos/:id ("แทนรูปเดิม") — so the
 *    4MB cap, mime check, UUID rename, EXIF stripping and admin-only write all apply.
 *
 * Colors come from Payload theme CSS variables only.
 */
import { Button } from '@payloadcms/ui'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  buildPlan,
  isJunkFile,
  precheck,
  type EligibleFile,
  type MatchResult,
  type PlanItem,
  type RejectReason,
  type RejectedFile,
} from '@/lib/import/photos/photoStems'

import { ResultTable, cardStyle } from './importUi'

const CONCURRENCY = 3

type Outcome = { item: PlanItem; ok: boolean; message: string }

const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.ceil(n / 1024)} KB`)

const REJECT_TITLES: Record<RejectReason, string> = {
  duplicate: 'ชื่อไฟล์ซ้ำ (ข้ามทุกไฟล์ที่ชื่อซ้ำกัน)',
  tooLarge: 'ไฟล์ใหญ่เกิน 4MB (ข้าม)',
  wrongType: 'ชนิดไฟล์ไม่รองรับ (รับเฉพาะ JPG/PNG)',
  emptyStem: 'ชื่อไฟล์ว่าง (ข้าม)',
  nationalId: 'ชื่อไฟล์เป็นเลข 13 หลัก — คล้ายเลขประจำตัวประชาชน ไม่ส่งไปเซิร์ฟเวอร์ (ให้ตั้งชื่อเป็นเลขประจำตัวนักเรียน)',
}

const planRows = (items: PlanItem[]) =>
  items.map((i) => ({
    file: i.name,
    studentId: i.student.studentId,
    name: i.student.name,
    classroom: i.student.classroom,
    size: fmtSize(i.size),
  }))
const planColumns = [
  { key: 'file', label: 'ไฟล์' },
  { key: 'studentId', label: 'เลขประจำตัว' },
  { key: 'name', label: 'ชื่อ-นามสกุล' },
  { key: 'classroom', label: 'ห้องเรียน' },
  { key: 'size', label: 'ขนาด' },
]

/** Upload one file; resolves to an outcome (never throws). */
const uploadOne = async (file: File, item: PlanItem): Promise<Outcome> => {
  const form = new FormData()
  form.append('file', file)
  let url = '/api/student-photos'
  let method = 'POST'
  if (item.photoId != null) {
    url = `/api/student-photos/${item.photoId}`
    method = 'PATCH'
  } else {
    form.append('_payload', JSON.stringify({ student: item.student.id }))
  }
  try {
    const res = await fetch(url, { method, body: form, credentials: 'same-origin' })
    if (res.ok) return { item, ok: true, message: method === 'PATCH' ? 'แทนรูปเดิมแล้ว' : 'อัปโหลดแล้ว' }
    let message = `ผิดพลาด (HTTP ${res.status})`
    try {
      const data = await res.json()
      const err = data?.errors?.[0]
      message = err?.data?.errors?.[0]?.message ?? err?.message ?? data?.error ?? message
    } catch {
      // non-JSON error body (e.g. a proxy's 413 page)
    }
    return { item, ok: false, message }
  } catch (err) {
    return { item, ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}

export const PhotoImportPanel: React.FC = () => {
  const [files, setFiles] = useState<File[]>([])
  const [ignored, setIgnored] = useState(0)
  const [replace, setReplace] = useState(false)
  const [check, setCheck] = useState<{ eligible: EligibleFile[]; rejected: RejectedFile[]; results: MatchResult[] } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<HTMLInputElement>(null)

  // `webkitdirectory` is not in React's input props; set it on the DOM node.
  useEffect(() => {
    folderRef.current?.setAttribute('webkitdirectory', '')
    folderRef.current?.setAttribute('directory', '')
  }, [])

  const pick = (list: FileList | null) => {
    const all = Array.from(list ?? [])
    const kept = all.filter((f) => !isJunkFile(f.name))
    setFiles(kept)
    setIgnored(all.length - kept.length)
    setCheck(null)
    setOutcomes(null)
    setProgress(null)
    setError(null)
  }

  const plan = useMemo(() => (check ? buildPlan(check.eligible, check.results, replace) : null), [check, replace])
  const toSend = useMemo(() => (plan ? [...plan.upload, ...plan.replaceExisting] : []), [plan])

  const runCheck = useCallback(async () => {
    setBusy(true)
    setError(null)
    setOutcomes(null)
    setProgress(null)
    try {
      const pre = precheck(files)
      let results: MatchResult[] = []
      if (pre.eligible.length > 0) {
        // Stems only — never image bytes, never a rejected (e.g. 13-digit) name.
        const res = await fetch('/api/students/photo-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stems: pre.eligible.map((e) => e.stem) }),
          credentials: 'same-origin',
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          setError(data?.error ?? `เกิดข้อผิดพลาด (HTTP ${res.status})`)
          setCheck(null)
          return
        }
        results = (data?.results ?? []) as MatchResult[]
      }
      setCheck({ ...pre, results })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [files])

  const runUpload = useCallback(
    async (items: PlanItem[]) => {
      if (items.length === 0) return
      setBusy(true)
      setError(null)
      const prior = (outcomes ?? []).filter((o) => o.ok)
      const results: Outcome[] = []
      let next = 0
      setProgress({ done: 0, total: items.length })
      const worker = async () => {
        while (next < items.length) {
          const item = items[next++]!
          results.push(await uploadOne(files[item.index]!, item))
          setProgress({ done: results.length, total: items.length })
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker))
      setOutcomes([...prior, ...results])
      // The preview is now stale (photos exist); a new upload needs a fresh check.
      setCheck(null)
      setBusy(false)
    },
    [files, outcomes],
  )

  const failed = (outcomes ?? []).filter((o) => !o.ok)
  const succeeded = (outcomes ?? []).filter((o) => o.ok)
  const rejectedBy = (reason: RejectReason) => (check?.rejected ?? []).filter((r) => r.reason === reason)

  return (
    <div>
      <p style={{ color: 'var(--theme-elevation-600)' }}>
        ตั้งชื่อไฟล์รูปเป็น <strong>เลขประจำตัวนักเรียน</strong> เช่น <code>10001.jpg</code> (ห้ามใช้เลขประจำตัวประชาชน) รับเฉพาะ
        JPG/PNG ขนาดไม่เกิน 4MB ต่อไฟล์ ระบบจะตรวจสอบก่อนเสมอ และจะยังไม่อัปโหลดจนกว่าจะกดยืนยัน
      </p>

      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <label>
            เลือกไฟล์รูป (หลายไฟล์){' '}
            <input
              ref={filesRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              disabled={busy}
              onChange={(e) => pick(e.target.files)}
            />
          </label>
          <label>
            หรือเลือกทั้งโฟลเดอร์{' '}
            <input ref={folderRef} type="file" multiple disabled={busy} onChange={(e) => pick(e.target.files)} />
          </label>
        </div>
        <p style={{ margin: '0.5rem 0 0' }}>
          เลือกแล้ว {files.length} ไฟล์
          {ignored > 0 && <span style={{ color: 'var(--theme-elevation-500)' }}> (ไม่นับไฟล์ระบบ/ไฟล์ซ่อน {ignored} ไฟล์)</span>}
        </p>
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <input type="checkbox" checked={replace} disabled={busy} onChange={(e) => setReplace(e.target.checked)} />
          แทนรูปเดิม (ถ้านักเรียนมีรูปอยู่แล้ว)
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <Button buttonStyle="secondary" disabled={busy || files.length === 0} onClick={runCheck}>
            ตรวจสอบ (ดูตัวอย่าง)
          </Button>
          <Button buttonStyle="primary" disabled={busy || !plan || toSend.length === 0} onClick={() => runUpload(toSend)}>
            ยืนยันอัปโหลด ({toSend.length} ไฟล์)
          </Button>
          {failed.length > 0 && (
            <Button buttonStyle="secondary" disabled={busy} onClick={() => runUpload(failed.map((f) => f.item))}>
              ลองใหม่เฉพาะที่ล้มเหลว ({failed.length})
            </Button>
          )}
        </div>
        {busy && !progress && <p>กำลังตรวจสอบ…</p>}
        {progress && (
          <div style={{ marginTop: '0.75rem' }}>
            <progress max={progress.total} value={progress.done} style={{ width: '100%' }} />
            <div>
              {busy ? 'กำลังอัปโหลด' : 'เสร็จแล้ว'} {progress.done}/{progress.total}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ ...cardStyle, borderColor: 'var(--theme-error-500)' }}>
          <strong style={{ color: 'var(--theme-error-600)' }}>ผิดพลาด:</strong> {error}
        </div>
      )}

      {outcomes && (
        <>
          <div style={cardStyle}>
            <strong>ผลการอัปโหลด</strong>
            <p style={{ margin: '0.5rem 0 0' }}>
              <span style={{ color: 'var(--theme-success-600)' }}>สำเร็จ {succeeded.length}</span> ·{' '}
              <span style={{ color: 'var(--theme-error-600)' }}>ล้มเหลว {failed.length}</span>
            </p>
          </div>
          <ResultTable
            title="ล้มเหลว"
            rows={failed.map((o) => ({ file: o.item.name, studentId: o.item.student.studentId, message: o.message }))}
            columns={[
              { key: 'file', label: 'ไฟล์' },
              { key: 'studentId', label: 'เลขประจำตัว' },
              { key: 'message', label: 'ปัญหา' },
            ]}
          />
          <ResultTable
            title="สำเร็จ"
            rows={succeeded.map((o) => ({ file: o.item.name, studentId: o.item.student.studentId, name: o.item.student.name, message: o.message }))}
            columns={[
              { key: 'file', label: 'ไฟล์' },
              { key: 'studentId', label: 'เลขประจำตัว' },
              { key: 'name', label: 'ชื่อ-นามสกุล' },
              { key: 'message', label: 'ผล' },
            ]}
          />
        </>
      )}

      {plan && check && (
        <>
          <div style={cardStyle}>
            <strong>ผลการตรวจสอบ (ยังไม่อัปโหลด)</strong>
            <p style={{ margin: '0.5rem 0 0' }}>
              ทั้งหมด {files.length} ไฟล์ ·{' '}
              <span style={{ color: 'var(--theme-success-600)' }}>
                จะอัปโหลด {plan.upload.length}
                {plan.replaceExisting.length > 0 && ` + แทนรูปเดิม ${plan.replaceExisting.length}`}
              </span>{' '}
              · <span style={{ color: 'var(--theme-warning-600)' }}>มีรูปอยู่แล้ว (ข้าม) {plan.skipExisting.length}</span> ·{' '}
              <span style={{ color: 'var(--theme-error-600)' }}>
                ไม่พบนักเรียน {plan.notFound.length + plan.ambiguous.length} · ไม่ผ่านการตรวจ {check.rejected.length}
              </span>
            </p>
          </div>
          <ResultTable title="จะอัปโหลด (รูปใหม่)" rows={planRows(plan.upload)} columns={planColumns} />
          <ResultTable title="จะแทนรูปเดิม" rows={planRows(plan.replaceExisting)} columns={planColumns} />
          <ResultTable
            title="มีรูปอยู่แล้ว (ข้าม — ติ๊ก “แทนรูปเดิม” เพื่ออัปโหลดทับ)"
            rows={planRows(plan.skipExisting)}
            columns={planColumns}
          />
          <ResultTable
            title="ไม่พบนักเรียนที่มีเลขประจำตัวตรงกับชื่อไฟล์"
            rows={plan.notFound.map((f) => ({ file: f.name, stem: f.stem }))}
            columns={[
              { key: 'file', label: 'ไฟล์' },
              { key: 'stem', label: 'เลขประจำตัวที่ค้นหา' },
            ]}
          />
          <ResultTable
            title="พบนักเรียนมากกว่า 1 คนที่เลขประจำตัวเดียวกัน (ข้าม — ตรวจข้อมูลนักเรียน)"
            rows={plan.ambiguous.map((f) => ({ file: f.name, stem: f.stem }))}
            columns={[
              { key: 'file', label: 'ไฟล์' },
              { key: 'stem', label: 'เลขประจำตัว' },
            ]}
          />
          {(Object.keys(REJECT_TITLES) as RejectReason[]).map((reason) => (
            <ResultTable
              key={reason}
              title={REJECT_TITLES[reason]}
              rows={rejectedBy(reason).map((r) => ({ file: r.name, size: fmtSize(r.size) }))}
              columns={[
                { key: 'file', label: 'ไฟล์' },
                { key: 'size', label: 'ขนาด' },
              ]}
            />
          ))}
        </>
      )}
    </div>
  )
}
