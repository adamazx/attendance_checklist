'use client'

/** Shared bits of the admin import screens. Theme CSS variables only (no hardcoded colors). */
import React from 'react'

export const cardStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 'var(--style-radius-m, 6px)',
  padding: 'var(--base, 1rem)',
  marginBottom: '1rem',
  background: 'var(--theme-elevation-50)',
}

export const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.85rem',
}
export const cellStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150)',
  padding: '0.35rem 0.5rem',
  textAlign: 'left',
  verticalAlign: 'top',
}

export const ResultTable = ({
  title,
  rows,
  columns,
}: {
  title: string
  rows: ReadonlyArray<Record<string, unknown>>
  columns: Array<{ key: string; label: string }>
}) => {
  if (rows.length === 0) return null
  return (
    <div style={cardStyle}>
      <h4 style={{ marginTop: 0 }}>
        {title} ({rows.length})
      </h4>
      <table style={tableStyle}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ ...cellStyle, fontWeight: 600 }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} style={cellStyle}>
                  {r[c.key] == null ? '' : String(r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

