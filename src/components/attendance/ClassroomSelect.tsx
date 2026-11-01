import React from 'react'

import type { RollCallClassroom } from '@/lib/attendance/rollCall'

/** Classroom choice for the GET filter form; a fixed label when there is only one. */
export function ClassroomSelect(props: { classrooms: RollCallClassroom[]; selectedId: number }) {
  const { classrooms, selectedId } = props
  if (classrooms.length === 1) {
    return <input name="classroom" type="hidden" value={selectedId} />
  }
  return (
    <label className="block font-medium">
      ห้องเรียน
      <select
        className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3"
        defaultValue={selectedId}
        name="classroom"
      >
        {classrooms.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  )
}
