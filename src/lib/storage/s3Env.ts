/**
 * Selects where student photos are stored, from env vars only.
 *
 * - All required S3_* vars set → private S3-compatible bucket (R2, AWS S3, SeaweedFS in dev).
 * - None set → `null` = local disk (dev only; Vercel's disk is ephemeral).
 * - Some set → throws at startup, so a half-configured deploy never silently
 *   falls back to the ephemeral disk. The error names the missing vars, never values.
 */
import type { S3StorageOptions } from '@payloadcms/storage-s3'

type S3ClientConfig = S3StorageOptions['config']

export const S3_REQUIRED_VARS = ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const

export type S3Settings = { bucket: string; config: S3ClientConfig } | null

type Env = Record<string, string | undefined>

export function readS3Env(env: Env): S3Settings {
  const value = (name: string) => env[name]?.trim() || undefined
  const missing = S3_REQUIRED_VARS.filter((name) => !value(name))
  if (missing.length === S3_REQUIRED_VARS.length) return null
  if (missing.length > 0) {
    throw new Error(
      `S3 photo storage is partially configured — also set ${missing.join(', ')} (or unset all S3_* vars to use local disk in dev)`,
    )
  }

  const endpoint = value('S3_ENDPOINT')
  return {
    bucket: value('S3_BUCKET')!,
    config: {
      region: value('S3_REGION')!,
      ...(endpoint ? { endpoint } : {}),
      // Local SeaweedFS (and MinIO) need path-style (http://host/bucket/key); R2 and AWS use virtual-hosted style.
      forcePathStyle: value('S3_FORCE_PATH_STYLE')?.toLowerCase() === 'true',
      credentials: {
        accessKeyId: value('S3_ACCESS_KEY_ID')!,
        secretAccessKey: value('S3_SECRET_ACCESS_KEY')!,
      },
    },
  }
}
