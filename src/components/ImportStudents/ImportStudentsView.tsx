/**
 * Payload admin custom view at `/admin/import-students`.
 *
 * Renders inside the admin shell (DefaultTemplate) and gates on an admin user —
 * the API route enforces admin-only too, so this is only a UI courtesy.
 */
import type { AdminViewServerProps } from 'payload'

import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import React from 'react'

import { isAdmin } from '@/access'

import { ImportStudentsClient } from './ImportStudentsClient'

const ImportStudentsView: React.FC<AdminViewServerProps> = ({
  initPageResult,
  params,
  searchParams,
}) => {
  const { req, visibleEntities, permissions, locale } = initPageResult

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      req={req}
      searchParams={searchParams}
      user={req.user ?? undefined}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        {isAdmin(req.user) ? (
          <ImportStudentsClient />
        ) : (
          <p>เฉพาะผู้ดูแลระบบเท่านั้นที่เข้าถึงการนำเข้ารายชื่อได้</p>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}

export default ImportStudentsView
