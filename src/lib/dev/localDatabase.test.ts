import assert from 'node:assert/strict'
import { test } from 'node:test'

import { assertLocalDatabase } from './localDatabase.ts'

const dev = { NODE_ENV: 'development' }
const SECRET = 'S3cr3t-pw-XYZ'

/** Asserts the guard throws and its message never leaks the password. */
const refuses = (uri: string | undefined, env: Record<string, string | undefined> = dev) => {
  let message = ''
  assert.throws(
    () => assertLocalDatabase(uri, env),
    (err: Error) => {
      message = err.message
      return true
    },
  )
  assert.ok(!message.includes(SECRET), `message leaks the password: ${message}`)
  assert.ok(!message.includes(`u:${SECRET}`), 'message leaks the userinfo')
  return message
}

test('local hosts pass', () => {
  for (const uri of [
    `postgres://attendance:${SECRET}@localhost:5432/attendance_dev`,
    `postgresql://attendance:${SECRET}@127.0.0.1:5432/attendance_dev`,
    `postgres://attendance:${SECRET}@[::1]:5432/attendance_dev`,
    `postgres://attendance:${SECRET}@LOCALHOST/attendance_dev`,
  ]) {
    assert.doesNotThrow(() => assertLocalDatabase(uri, dev), uri.replace(SECRET, '***'))
  }
  assert.doesNotThrow(() => assertLocalDatabase(`postgres://u:${SECRET}@localhost/db`, {}), 'NODE_ENV unset is fine')
})

test('a Neon host is refused, naming the host but not the password', () => {
  const msg = refuses(`postgres://u:${SECRET}@ep-cool-name-123.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`)
  assert.match(msg, /ep-cool-name-123\.ap-southeast-1\.aws\.neon\.tech/)
})

test('public IPs and look-alike hosts are refused', () => {
  refuses(`postgres://u:${SECRET}@203.0.113.7:5432/db`)
  refuses(`postgres://u:${SECRET}@localhost.example.com/db`)
  refuses(`postgres://u:${SECRET}@127.0.0.2/db`)
  // A compose service name is not local: a production compose stack likely names its
  // DB service `postgres` too, so a script run inside a prod container must not pass.
  refuses(`postgres://u:${SECRET}@postgres:5432/db`)
})

test('a ?host= / ?hostaddr= override is refused', () => {
  refuses(`postgres://u:${SECRET}@localhost/db?host=ep-x.neon.tech`)
  refuses(`postgres://u:${SECRET}@localhost/db?hostaddr=203.0.113.7`)
})

test('missing, garbage and non-postgres URIs are refused', () => {
  refuses(undefined)
  refuses('')
  refuses(`not a url ${SECRET}`)
  refuses(`mysql://u:${SECRET}@localhost/db`)
  refuses(`postgres://u:${SECRET}@/db`)
})

test('NODE_ENV=production is refused even for a local host', () => {
  refuses(`postgres://u:${SECRET}@localhost:5432/db`, { NODE_ENV: 'production' })
})
