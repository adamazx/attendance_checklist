'use client'

/**
 * DLA student-master import: upload → dry-run preview → (separately) confirmed write.
 * The confirm sends the dry run's `fileHash`, so the server only writes the exact
 * file that was previewed. National IDs in the preview are masked by the server.
 */
import { Button } from '@payloadcms/ui'
import React, { useCallback, useState } from 'react'

import type { DlaImportResult } from '@/lib/import/dla/types'

import { ResultTable, cardStyle } from './importUi'

type Rows = Array<Record<string, unknown>>

const entryColumns = [
  { key: 'sheet', label: 'ชีต' },
  { key: 'row', label: 'แถว' },
  { key: 'studentId', label: 'เลขประจำตัว' },
  { key: 'nationalIdMasked', label: 'เลขประจำตัวประชาชน' },
  { key: 'name', label: 'ชื่อ-นามสกุล' },
  { key: 'classroom', label: 'ห้อง' },
  { key: 'note', label: 'หมายเหตุ' },
]

const issueColumns = [
  { key: 'sheet', label: 'ชีต' },
  { key: 'row', label: 'แถว' },
  { key: 'studentId', label: 'เลขประจำตัว' },
  { key: 'nationalIdMasked', label: 'เลขประจำตัวประชาชน' },
  { key: 'name', label: 'ชื่อ-นามสกุล' },
  { key: 'message', label: 'ปัญหา' },
]

const withNote = (entries: DlaImportResult['creates']): Rows =>
  entries.map((e) => ({
    ...e,
    note: [
      e.link ? 'เชื่อมเลขประจำตัวประชาชนกับนักเรียนเดิม' : '',
      e.changedFields?.length ? `เปลี่ยน ${e.changedFields.length} ช่อง` : '',
      ...e.warnings,
    ]
      .filter(Boolean)
      .join(' · '),
  }))

export const DlaImportPanel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<DlaImportResult | null>(null)
  const [preview, setPreview] = useState<DlaImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const send = useCallback(
    async (dryRun: boolean) => {
      if (!file) return
      setLoading(true)
      setError(null)
      try {
        const form = new FormData()
        form.append('file', file)
        form.append('format', 'dla')
        form.append('dryRun', dryRun ? 'true' : 'false')
        if (!dryRun && preview) form.append('confirmHash', preview.fileHash)
        const res = await fetch('/api/students/import', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok) {
          setError(data?.error ?? 'เกิดข้อผิดพลาด')
          return
        }
        setResult(data as DlaImportResult)
        if (dryRun) setPreview(data as DlaImportResult)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [file, preview],
  )

  const confirmWrite = () => {
    if (!preview) return
    const n = preview.summary.creates + preview.summary.updates
    if (window.confirm(`ยืนยันบันทึกข้อมูลนักเรียน ${n} รายการ (เพิ่ม ${preview.summary.creates}, แก้ไข ${preview.summary.updates})?`)) {
      void send(false)
    }
  }

  const canConfirm = Boolean(preview && !preview.fatal && preview.summary.creates + preview.summary.updates > 0)

  return (
    <div>
      <p style={{ color: 'var(--theme-elevation-600)' }}>
        ไฟล์ส่งออกจากระบบ DLA (.xls) ชีตละห้อง (d1-1 … d6-2) หัวตาราง 3 แถว ระบบจะตรวจซ้ำด้วยเลขประจำตัวประชาชน
        ขั้นแรกเป็นการตรวจสอบเท่านั้น ยังไม่บันทึกข้อมูล
      </p>
      <div style={cardStyle}>
        <input
          type="file"
          accept=".xls,.xlsx"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null)
            setResult(null)
            setPreview(null)
            setError(null)
          }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <Button buttonStyle="secondary" disabled={loading || !file} onClick={() => send(true)}>
            ตรวจสอบ (ดูตัวอย่าง)
          </Button>
          <Button buttonStyle="primary" disabled={loading || !canConfirm} onClick={confirmWrite}>
            ยืนยันบันทึกตามตัวอย่าง
          </Button>
        </div>
        {loading && <p>กำลังประมวลผล…</p>}
      </div>

      {error && (
        <div style={{ ...cardStyle, borderColor: 'var(--theme-error-500)' }}>
          <strong style={{ color: 'var(--theme-error-600)' }}>ผิดพลาด:</strong> {error}
        </div>
      )}

      {result && (
        <>
          <div style={cardStyle}>
            <strong>{result.dryRun ? 'ผลการตรวจสอบ (ยังไม่บันทึก)' : 'ผลการบันทึก'}</strong>
            {result.fatal ? (
              <p style={{ color: 'var(--theme-error-600)' }}>{result.fatal}</p>
            ) : (
              <>
                <p style={{ margin: '0.5rem 0 0' }}>
                  ชีต {result.sheets.length} ห้อง · ทั้งหมด {result.summary.rows} แถว ·{' '}
                  <span style={{ color: 'var(--theme-success-600)' }}>เพิ่ม {result.summary.creates}</span> · แก้ไข{' '}
                  {result.summary.updates} · ไม่เปลี่ยน {result.summary.unchanged} ·{' '}
                  <span style={{ color: 'var(--theme-warning-600)' }}>
                    ขัดแย้ง {result.summary.conflicts + result.summary.idConflicts} · ซ้ำ {result.summary.duplicates}
                  </span>{' '}
                  · <span style={{ color: 'var(--theme-error-600)' }}>ผิดพลาด {result.summary.errors}</span>
                </p>
                {result.written && (
                  <p style={{ margin: '0.5rem 0 0' }}>
                    บันทึกแล้ว: เพิ่ม {result.written.created} · แก้ไข {result.written.updated} · ไม่สำเร็จ{' '}
                    {result.written.failed.length}
                  </p>
                )}
              </>
            )}
          </div>

          {result.written && (
            <ResultTable title="บันทึกไม่สำเร็จ" rows={result.written.failed as unknown as Rows} columns={issueColumns} />
          )}
          <ResultTable
            title="ชีตที่ข้าม"
            rows={result.skippedSheets as unknown as Rows}
            columns={[
              { key: 'name', label: 'ชีต' },
              { key: 'reason', label: 'เหตุผล' },
            ]}
          />
          <ResultTable
            title="คอลัมน์ที่ระบบยังไม่ได้จับคู่ (เก็บไว้ในข้อมูลดิบ)"
            rows={result.unmappedColumns.map((c) => ({ column: c }))}
            columns={[{ key: 'column', label: 'หัวคอลัมน์' }]}
          />
          <ResultTable
            title="คอลัมน์ที่คาดว่าจะมีแต่ไม่พบ"
            rows={result.missingColumns.map((c) => ({ column: c }))}
            columns={[{ key: 'column', label: 'ข้อมูล' }]}
          />
          <ResultTable title="ผิดพลาด (ไม่บันทึก)" rows={result.errors as unknown as Rows} columns={issueColumns} />
          <ResultTable title="ซ้ำในหลายห้อง / ข้อมูลไม่ตรงกัน (ข้าม)" rows={result.conflicts as unknown as Rows} columns={issueColumns} />
          <ResultTable
            title="เลขประจำตัวนักเรียนซ้ำ / ไม่ตรงกับเลขประจำตัวประชาชน (ข้าม — โปรดแก้ไขใน DLA)"
            rows={result.idConflicts as unknown as Rows}
            columns={issueColumns}
          />
          <ResultTable title="แถวซ้ำทุกช่อง (ใช้แถวแรก)" rows={result.duplicates as unknown as Rows} columns={issueColumns} />
          <ResultTable title={result.dryRun ? 'จะเพิ่มใหม่' : 'เพิ่มใหม่'} rows={withNote(result.creates)} columns={entryColumns} />
          <ResultTable title={result.dryRun ? 'จะแก้ไข' : 'แก้ไข'} rows={withNote(result.updates)} columns={entryColumns} />
          <ResultTable title="ไม่มีการเปลี่ยนแปลง" rows={withNote(result.unchanged)} columns={entryColumns} />
        </>
      )}
    </div>
  )
}
