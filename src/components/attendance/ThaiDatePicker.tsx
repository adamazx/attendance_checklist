'use client'

import React, { useState } from 'react'

import { BE_OFFSET, THAI_MONTHS } from '@/lib/date/thaiDay'

const selectClass = 'mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-2'

const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate()

/**
 * Day / month / พ.ศ. year selects. A native date input shows the browser's locale,
 * usually ค.ศ., so it cannot honour the Buddhist-era rule. Submits `YYYY-MM-DD` in a
 * hidden field; the page validates the range on the server.
 */
export function ThaiDatePicker(props: { name: string; today: string; value: string }) {
  const [initialY, initialM, initialD] = props.value.split('-').map(Number) as [number, number, number]
  const currentYear = Number(props.today.slice(0, 4))
  const [year, setYear] = useState(initialY)
  const [month, setMonth] = useState(initialM)
  const [day, setDay] = useState(initialD)

  const lastDay = daysInMonth(year, month)
  const safeDay = Math.min(day, lastDay)
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`

  return (
    <div className="grid grid-cols-[4.5rem_1fr_5.5rem] gap-2">
      <input name={props.name} type="hidden" value={iso} />
      <label className="block font-medium">
        วันที่
        <select className={selectClass} onChange={(e) => setDay(Number(e.target.value))} value={safeDay}>
          {Array.from({ length: lastDay }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label className="block font-medium">
        เดือน
        <select className={selectClass} onChange={(e) => setMonth(Number(e.target.value))} value={month}>
          {THAI_MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="block font-medium">
        พ.ศ.
        <select className={selectClass} onChange={(e) => setYear(Number(e.target.value))} value={year}>
          {[currentYear - 1, currentYear].map((y) => (
            <option key={y} value={y}>
              {y + BE_OFFSET}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
