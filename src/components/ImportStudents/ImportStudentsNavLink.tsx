/**
 * Nav link (admin.components.afterNavLinks) pointing to the student importer.
 * Shown only to admins — advisors/discipline cannot import.
 */
import type { ServerProps } from 'payload'

import React from 'react'

import { isAdmin } from '@/access'

import { ImportStudentsNavLinkClient } from './ImportStudentsNavLinkClient'

const ImportStudentsNavLink: React.FC<ServerProps> = ({ user }) => {
  if (!isAdmin(user)) return null
  return <ImportStudentsNavLinkClient />
}

export default ImportStudentsNavLink
