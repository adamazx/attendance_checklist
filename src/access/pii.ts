/**
 * Field-level access bundles for the student master record (PDPA).
 *
 * Row scope is decided by the collection's `studentRead` (an advisor only ever gets
 * rows from their own classrooms). These bundles decide *which fields* of a readable
 * row come back:
 *  - (no access)       basic + contact — everyone who can read the row
 *  - `piiNoDiscipline` admin + advisor (advisor = own room only, via row scope)
 *  - `piiAdmin`        admin only (full national ID, raw import leftovers)
 *
 * Writes are admin-only on every bundle (the collection is admin-write anyway; this
 * keeps it true even if collection access is ever widened).
 *
 * Note: `overrideAccess: true` skips field access too, so internal reads that
 * override access must `select` only the fields they need.
 */
import type { FieldAccess } from 'payload'

import { adminFieldAccess, isAdmin, isDiscipline } from './roles'

const adminOrAdvisor: FieldAccess = ({ req: { user } }) =>
  Boolean(user) && (isAdmin(user) || !isDiscipline(user))

export const adminWrite = { create: adminFieldAccess, update: adminFieldAccess }

/** Readable by admin only. */
export const piiAdmin = { read: adminFieldAccess, ...adminWrite }

/** Readable by admin and advisor (own room); hidden from discipline. */
export const piiNoDiscipline = { read: adminOrAdvisor, ...adminWrite }
