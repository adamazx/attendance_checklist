/**
 * Unit tests for the env-gated photo storage selection — run with `pnpm test`.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readS3Env } from './s3Env.ts'

const full = {
  S3_BUCKET: 'photos',
  S3_REGION: 'auto',
  S3_ACCESS_KEY_ID: 'key-id',
  S3_SECRET_ACCESS_KEY: 'secret-value',
}

test('no S3 vars → null (local disk)', () => {
  assert.equal(readS3Env({}), null)
  assert.equal(readS3Env({ S3_BUCKET: '', S3_REGION: '  ' }), null)
})

test('all required vars → settings; endpoint omitted when unset', () => {
  const s = readS3Env(full)
  assert.ok(s)
  assert.equal(s.bucket, 'photos')
  assert.equal(s.config.region, 'auto')
  assert.equal('endpoint' in s.config, false)
  assert.equal(s.config.forcePathStyle, false)
  assert.deepEqual(s.config.credentials, { accessKeyId: 'key-id', secretAccessKey: 'secret-value' })
})

test('endpoint and force-path-style are passed through', () => {
  const s = readS3Env({ ...full, S3_ENDPOINT: 'http://localhost:9000', S3_FORCE_PATH_STYLE: 'TRUE' })
  assert.ok(s)
  assert.equal(s.config.endpoint, 'http://localhost:9000')
  assert.equal(s.config.forcePathStyle, true)
  const off = readS3Env({ ...full, S3_FORCE_PATH_STYLE: 'false' })
  assert.equal(off?.config.forcePathStyle, false)
})

test('partial config throws, naming missing vars but never values', () => {
  assert.throws(
    () => readS3Env({ S3_BUCKET: 'photos', S3_SECRET_ACCESS_KEY: 'secret-value' }),
    (err: Error) =>
      err.message.includes('S3_REGION') &&
      err.message.includes('S3_ACCESS_KEY_ID') &&
      !err.message.includes('secret-value') &&
      !err.message.includes('photos'),
  )
})
