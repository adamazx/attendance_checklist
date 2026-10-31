/**
 * Generic AuditLog writer. Writes one `audit-logs` row through the Local API with
 * the current `req` so the write shares the triggering operation's transaction
 * (atomic: if the log write fails, the attendance change rolls back too).
 *
 * `overrideAccess: true` is intentional — AuditLog has no public create access
 * (it is append-only, system-written); this helper is the only writer.
 */
import type { PayloadRequest } from 'payload'

export type AuditAction = 'create' | 'edit' | 'backdate' | 'delete'

/** The value shape Payload accepts for a `json` field. */
type JSONValue = string | number | boolean | { [k: string]: unknown } | unknown[] | null

interface WriteAuditLogArgs {
  req: PayloadRequest
  collectionSlug: string
  documentId: string | number
  action: AuditAction
  before?: unknown
  after?: unknown
}

export const writeAuditLog = async ({
  req,
  collectionSlug,
  documentId,
  action,
  before = null,
  after = null,
}: WriteAuditLogArgs): Promise<void> => {
  await req.payload.create({
    collection: 'audit-logs',
    data: {
      collectionSlug,
      documentId: String(documentId),
      action,
      actor: req.user?.id ?? null,
      timestamp: new Date().toISOString(),
      before: (before ?? null) as JSONValue,
      after: (after ?? null) as JSONValue,
    },
    overrideAccess: true,
    req,
  })
}
