/**
 * Unit tests for the roll-call upsert planner — run with `pnpm test`.
 * Live route behaviour (auth, access, transaction) needs a running Payload and is
 * verified against the dev server, not here.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { planSave } from './planSave.ts'

const CLASSROOM = 1
const record = { classroomId: CLASSROOM, id: 100, note: null, status: 'present', studentId: 7 } as const

test('planSave: a student with no record is a create', () => {
  const plan = planSave({
    classroomId: CLASSROOM,
    entries: [{ note: '', status: 'present', studentId: 7 }],
    existing: [],
    rosterIds: new Set([7]),
  })
  assert.equal(plan.creates.length, 1)
  assert.deepEqual(plan.updates, [])
  assert.equal(plan.unchanged, 0)
})

test('planSave: a changed status or note is an update of the existing record', () => {
  const plan = planSave({
    classroomId: CLASSROOM,
    entries: [{ note: 'ป่วย', status: 'leave', studentId: 7 }],
    existing: [record],
    rosterIds: new Set([7]),
  })
  assert.deepEqual(plan.updates, [{ id: 100, note: 'ป่วย', status: 'leave' }])
  assert.deepEqual(plan.creates, [])
})

test('planSave: an unchanged row is skipped, treating null note as empty', () => {
  const plan = planSave({
    classroomId: CLASSROOM,
    entries: [{ note: '', status: 'present', studentId: 7 }],
    existing: [record],
    rosterIds: new Set([7]),
  })
  assert.equal(plan.unchanged, 1)
  assert.deepEqual(plan.updates, [])
})

test('planSave: a student off the roster with no record here is an outsider', () => {
  const plan = planSave({
    classroomId: CLASSROOM,
    entries: [{ note: '', status: 'present', studentId: 99 }],
    existing: [],
    rosterIds: new Set([7]),
  })
  assert.deepEqual(plan.outsiders, [99])
  assert.deepEqual(plan.creates, [])
})

test('planSave: a record in another classroom does not admit an off-roster student', () => {
  const plan = planSave({
    classroomId: CLASSROOM,
    entries: [{ note: '', status: 'late', studentId: 7 }],
    existing: [{ ...record, classroomId: 2 }],
    rosterIds: new Set(),
  })
  assert.deepEqual(plan.outsiders, [7])
  assert.deepEqual(plan.updates, [])
})

test('planSave: a roster student recorded under another classroom that day is a conflict', () => {
  const plan = planSave({
    classroomId: CLASSROOM,
    entries: [
      { note: '', status: 'present', studentId: 7 },
      { note: '', status: 'present', studentId: 8 },
    ],
    existing: [{ ...record, classroomId: 2 }],
    rosterIds: new Set([7, 8]),
  })
  assert.deepEqual(plan.conflicts, [7])
  assert.deepEqual(plan.updates, [])
  assert.deepEqual(plan.outsiders, [])
  assert.deepEqual(
    plan.creates.map((e) => e.studentId),
    [8],
  )
})

test('planSave: a departed student with a record in this classroom can still be edited', () => {
  const plan = planSave({
    classroomId: CLASSROOM,
    entries: [{ note: '', status: 'absent', studentId: 7 }],
    existing: [record],
    rosterIds: new Set(),
  })
  assert.deepEqual(plan.outsiders, [])
  assert.deepEqual(plan.updates, [{ id: 100, note: '', status: 'absent' }])
})
