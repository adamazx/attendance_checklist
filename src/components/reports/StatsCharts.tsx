'use client'

import React from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/** One status bar: its Thai label, count, and a CSS color token (`var(--action-green)`). */
export interface StatusBarDatum {
  color: string
  count: number
  label: string
}

/** One day of the %มา trend; both labels are formatted (พ.ศ.) on the server. */
export interface DailyRateDatum {
  fullLabel: string
  label: string
  rate: number | null
  total: number
}

const cardClass = 'rounded-xl bg-surface p-4 shadow-card print:shadow-none'
const axisTick = { fill: 'var(--muted)', fontSize: 12 }
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--brand-gold)', borderRadius: 8 }

/**
 * The charts island: a status breakdown bar chart and a daily %มา line. It only
 * draws what the server page aggregated — it never loads records itself.
 */
export function StatsCharts(props: { daily: DailyRateDatum[]; statuses: StatusBarDatum[] }) {
  const { daily, statuses } = props

  return (
    <div className="grid gap-4 min-[820px]:grid-cols-2">
      <section aria-label="สัดส่วนสถานะการมาเรียน" className={cardClass}>
        <h2 className="mb-3 font-semibold text-brand-red-dark">จำนวนแต่ละสถานะ (วัน)</h2>
        <div className="h-72">
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={statuses} margin={{ bottom: 0, left: 0, right: 8, top: 8 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} />
              <YAxis allowDecimals={false} tick={axisTick} width={40} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: 'var(--gold-pale)' }}
                formatter={(value) => [`${value} วัน`, 'จำนวน']}
              />
              <Bar dataKey="count" isAnimationActive={false} radius={[6, 6, 0, 0]}>
                {statuses.map((s) => (
                  <Cell fill={s.color} key={s.label} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section aria-label="แนวโน้มร้อยละการมาเรียนรายวัน" className={cardClass}>
        <h2 className="mb-3 font-semibold text-brand-red-dark">%มา รายวัน</h2>
        <div className="h-72">
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={daily} margin={{ bottom: 0, left: 0, right: 8, top: 8 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" minTickGap={16} tick={axisTick} />
              <YAxis domain={[0, 100]} tick={axisTick} tickFormatter={(v: number) => `${v}%`} width={48} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, _name, item) => [
                  `${typeof value === 'number' ? value.toFixed(1) : '—'}% (บันทึก ${(item.payload as DailyRateDatum).total} คน)`,
                  '%มา',
                ]}
                labelFormatter={(_label, payload) => (payload[0]?.payload as DailyRateDatum | undefined)?.fullLabel ?? ''}
              />
              <Line
                dataKey="rate"
                dot={{ fill: 'var(--brand-red)', r: 3 }}
                isAnimationActive={false}
                stroke="var(--brand-red)"
                strokeWidth={2}
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}
