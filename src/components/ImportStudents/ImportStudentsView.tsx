/**
 * Payload admin custom view at `/admin/import-students`.
 *
 * Custom admin views bypass Payload's `canAccessAdmin` redirect (Users.access.admin),
 * so this view gates itself before rendering the admin shell:
 *  - unauthenticated              → admin login (with `redirect` back here)
 *  - not admin/discipline         → admin unauthorized page (no shell, no nav)
 *  - discipline                   → admin shell + an admin-only notice
 *  - admin                        → the importer
 * The API routes enforce admin-only too; this is the UI gate.
 */
import type { AdminViewServerProps } from 'payload'

import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import { formatAdminURL } from 'payload/shared'
import React from 'react'

import { isAdmin, isAdminOrDiscipline } from '@/access'

import { ImportStudentsClient } from './ImportStudentsClient'

const ImportStudentsView: React.FC<AdminViewServerProps> = ({
  initPageResult,
  params,
  searchParams,
}) => {
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user || !isAdminOrDiscipline(req.user)) {
    const { admin, routes } = req.payload.config
    const adminRoute = routes.admin
    if (!req.user) {
      const viewPath = admin.components?.views?.importStudents?.path ?? '/import-students'
      const back = formatAdminURL({ adminRoute, path: viewPath as `/${string}` })
      redirect(`${formatAdminURL({ adminRoute, path: admin.routes.login })}?redirect=${encodeURIComponent(back)}`)
    }
    redirect(formatAdminURL({ adminRoute, path: admin.routes.unauthorized }))
  }

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
