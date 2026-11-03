import React from 'react'

import type { RollCallActivity } from '@/lib/attendance/rollCall'

/** URL value of the reports' "every activity" choice; an empty value is the homeroom. */
export const ALL_ACTIVITIES = 'all'

const groups = [
  { label: 'วิชา', type: 'subject' },
  { label: 'กิจกรรม', type: 'activity' },
] as const

/**
 * Subject/activity choice for a GET filter form (`activity` param). The first option
 * (empty value) is the daily homeroom roll-call; `includeAll` adds the reports'
 * "-- ทุกกิจกรรม --". Renders nothing when there are no activities and no "all".
 */
export function ActivitySelect(props: {
  activities: RollCallActivity[]
  includeAll?: boolean
  /** `''` homeroom, `'all'`, or an activity id. */
  selected: string
}) {
  const { activities, includeAll = false, selected } = props
  if (activities.length === 0) return null
  return (
    <label className="block font-medium">
      วิชา/กิจกรรม
      <select
        className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3"
        defaultValue={selected}
        name="activity"
      >
        <option value="">เช็คชื่อประจำวัน (โฮมรูม)</option>
        {includeAll && <option value={ALL_ACTIVITIES}>-- ทุกกิจกรรม --</option>}
        {groups.map((g) => {
          const list = activities.filter((a) => a.type === g.type)
          return list.length === 0 ? null : (
            <optgroup key={g.type} label={g.label}>
              {list.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
    </label>
  )
}
