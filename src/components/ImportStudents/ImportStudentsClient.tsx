'use client'

/**
 * Admin importer UI: pick a CSV/XLSX roster, preview (dry run), then confirm.
 * Posts to POST /api/students/import. Colors come from Payload theme CSS
 * variables only (no hardcoded brand/action colors).
 */
import { Button } from '@payloadcms/ui'
import React, { useCallback, useRef, useState } from 'react'

import type { ImportResult } from '@/lib/import/types'

import { DlaImportPanel } from './DlaImportPanel'
import { ResultTable, cardStyle } from './importUi'

const TEMPLATE_HEADERS = [
  'เลขประจำตัว',
  'คำนำหน้า',
  'ชื่อ',
  'นามสกุล',
  'เลขที่',
  'ห้องเรียน',
  'สถานะ',
]
const TEMPLATE_SAMPLE = ['10001', 'ด.ช.', 'สมชาย', 'ใจดี', '1', 'ม.1/1', 'กำลังศึกษา']

/** Download a UTF-8 (with BOM) CSV template so Excel opens Thai text correctly. */
const downloadTemplate = () => {
  const rows = [TEMPLATE_HEADERS, TEMPLATE_SAMPLE]
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'student-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const RosterImportPanel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const run = useCallback(
    async (dryRun: boolean) => {
      if (!file) {
        setError('กรุณาเลือกไฟล์ก่อน')
        return
      }
      setLoading(true)
      setError(null)
      try {
        const form = new FormData()
        form.append('file', file)
        form.append('dryRun', dryRun ? 'true' : 'false')
        const res = await fetch('/api/students/import', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok) {
          setError(data?.error ?? 'เกิดข้อผิดพลาด')
          setResult(null)
          return
        }
        setResult(data as ImportResult)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [file],
  )

  return (
    <div>
      <p style={{ color: 'var(--theme-elevation-600)' }}>
        รองรับไฟล์ CSV (UTF-8) และ Excel (.xlsx) หัวคอลัมน์ภาษาไทย เช่น เลขประจำตัว, คำนำหน้า, ชื่อ,
        นามสกุล, เลขที่, ห้องเรียน (เช่น &quot;ม.4/2&quot;), สถานะ ระบบจะตรวจซ้ำด้วยเลขประจำตัว
      </p>

      <div style={cardStyle}>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null)
            setResult(null)
            setError(null)
          }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <Button buttonStyle="secondary" disabled={loading || !file} onClick={() => run(true)}>
            ตรวจสอบ (ดูตัวอย่าง)
          </Button>
          <Button buttonStyle="primary" disabled={loading || !file} onClick={() => run(false)}>
            ยืนยันนำเข้า
          </Button>
          <Button buttonStyle="transparent" disabled={loading} onClick={downloadTemplate}>
            ดาวน์โหลดเทมเพลต
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
            <strong>{result.dryRun ? 'ผลการตรวจสอบ (ยังไม่บันทึก)' : 'ผลการนำเข้า'}</strong>
            {result.fatal ? (
              <p style={{ color: 'var(--theme-error-600)' }}>{result.fatal}</p>
            ) : (
              <p style={{ margin: '0.5rem 0 0' }}>
                ทั้งหมด {result.totalRows} แถว ·{' '}
                <span style={{ color: 'var(--theme-success-600)' }}>
                  {result.dryRun ? 'จะเพิ่ม' : 'เพิ่มแล้ว'} {result.summary.created}
                </span>{' '}
                · <span style={{ color: 'var(--theme-warning-600)' }}>ซ้ำ {result.summary.duplicates}</span>{' '}
                · <span style={{ color: 'var(--theme-error-600)' }}>ผิดพลาด {result.summary.errors}</span>
              </p>
            )}
          </div>

          <ResultTable
            title={result.dryRun ? 'รายการที่จะเพิ่ม' : 'เพิ่มสำเร็จ'}
            rows={result.created as unknown as Array<Record<string, unknown>>}
            columns={[
              { key: 'row', label: 'แถว' },
              { key: 'studentId', label: 'เลขประจำตัว' },
              { key: 'name', label: 'ชื่อ-นามสกุล' },
              { key: 'classroom', label: 'ห้องเรียน' },
            ]}
          />
          <ResultTable
            title="รายการซ้ำ (ข้าม)"
            rows={result.duplicates as unknown as Array<Record<string, unknown>>}
            columns={[
              { key: 'row', label: 'แถว' },
              { key: 'studentId', label: 'เลขประจำตัว' },
              { key: 'message', label: 'หมายเหตุ' },
            ]}
          />
          <ResultTable
            title="รายการผิดพลาด"
            rows={result.errors as unknown as Array<Record<string, unknown>>}
            columns={[
              { key: 'row', label: 'แถว' },
              { key: 'studentId', label: 'เลขประจำตัว' },
              { key: 'message', label: 'ปัญหา' },
            ]}
          />
        </>
      )}
    </div>
  )
}

/** Admin import screen: the phase-1b roster import, or the DLA student-master export. */
export const ImportStudentsClient: React.FC = () => {
  const [format, setFormat] = useState<'roster' | 'dla'>('roster')
  return (
    <div>
      <h1>นำเข้ารายชื่อนักเรียน</h1>
      <div role="radiogroup" aria-label="ชนิดไฟล์" style={{ display: 'flex', gap: '0.5rem', margin: '0.75rem 0' }}>
        <Button buttonStyle={format === 'roster' ? 'primary' : 'secondary'} onClick={() => setFormat('roster')}>
          รายชื่อทั่วไป (CSV/Excel)
        </Button>
        <Button buttonStyle={format === 'dla' ? 'primary' : 'secondary'} onClick={() => setFormat('dla')}>
          ไฟล์ DLA (ข้อมูลนักเรียนครบชุด)
        </Button>
      </div>
      {format === 'roster' ? <RosterImportPanel /> : <DlaImportPanel />}
    </div>
  )
}
