/**
 * Replaces Payload's /admin/forgot view (admin.components.views.forgot). Payload's
 * login form always links here; the built-in view would send a reset email, which
 * this app cannot do (no email adapter — see Users.ts `forgotPasswordDisabled`).
 * So the link leads to instructions instead of a form that cannot work.
 * Rendered inside Payload's minimal (logged-out) template.
 */
import type { AdminViewServerProps } from 'payload'

import React from 'react'

import { PASSWORD_RESET_HELP } from '@/lib/auth/passwordReset'

const ForgotPasswordView: React.FC<AdminViewServerProps> = ({ initPageResult }) => {
  const adminRoute = initPageResult.req.payload.config.routes.admin
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>ลืมรหัสผ่าน</h1>
      <p style={{ margin: 0, color: 'var(--theme-elevation-800)' }}>{PASSWORD_RESET_HELP}</p>
      {/* Plain <a>: a full navigation back to Payload's login view. */}
      <a href={`${adminRoute}/login`} style={{ color: 'var(--theme-success-500)', fontWeight: 600 }}>
        ← กลับไปหน้าเข้าสู่ระบบ
      </a>
    </div>
  )
}

export default ForgotPasswordView
