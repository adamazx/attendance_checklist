/**
 * Unit tests for role predicates and the PII field-access bundles — run with `pnpm test`.
 * Field access functions are called with a minimal `{ req: { user } }`; no Payload boot.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { piiAdmin, piiNoDiscipline } from './pii.ts'
import { isAdmin, isAdminOrDiscipline, isAdvisor, isDiscipline } from './roles.ts'

type Read = (args: never) => unknown

const users = {
  admin: { id: 1, role: 'admin' },
  advisor: { id: 2, role: 'advisor' },
  discipline: { id: 3, role: 'discipline' },
  // A hypothetical future role must get nothing it isn't explicitly granted.
  unknown: { id: 4, role: 'principal' },
  noUser: null,
} as const

const call = (fn: Read, user: unknown) => fn({ req: { user } } as never)

test('piiNoDiscipline.read: allow-list — admin and advisor only', () => {
  const read = piiNoDiscipline.read as Read
  assert.equal(call(read, users.admin), true)
  assert.equal(call(read, users.advisor), true)
  assert.equal(call(read, users.discipline), false)
  assert.equal(call(read, users.noUser), false)
  assert.equal(call(read, undefined), false)
  assert.equal(call(read, users.unknown), false)
})

test('piiAdmin.read: admin only', () => {
  const read = piiAdmin.read as Read
  assert.equal(call(read, users.admin), true)
  assert.equal(call(read, users.advisor), false)
  assert.equal(call(read, users.discipline), false)
  assert.equal(call(read, users.noUser), false)
  assert.equal(call(read, users.unknown), false)
})

test('PII bundles: writes are admin-only', () => {
  for (const bundle of [piiAdmin, piiNoDiscipline]) {
    for (const op of [bundle.create, bundle.update] as Read[]) {
      assert.equal(call(op, users.admin), true)
      assert.equal(call(op, users.advisor), false)
      assert.equal(call(op, users.discipline), false)
      assert.equal(call(op, users.unknown), false)
    }
  }
})

test('role predicates: truth table', () => {
  const table: Array<[keyof typeof users, boolean, boolean, boolean, boolean]> = [
    // user        isAdmin isAdvisor isDiscipline isAdminOrDiscipline
    ['admin', true, false, false, true],
    ['advisor', false, true, false, false],
    ['discipline', false, false, true, true],
    ['unknown', false, false, false, false],
    ['noUser', false, false, false, false],
  ]
  for (const [key, admin, advisor, discipline, adminOrDiscipline] of table) {
    const u = users[key] as never
    assert.equal(isAdmin(u), admin, `isAdmin(${key})`)
    assert.equal(isAdvisor(u), advisor, `isAdvisor(${key})`)
    assert.equal(isDiscipline(u), discipline, `isDiscipline(${key})`)
    assert.equal(isAdminOrDiscipline(u), adminOrDiscipline, `isAdminOrDiscipline(${key})`)
  }
  assert.equal(isAdvisor(undefined), false)
})
