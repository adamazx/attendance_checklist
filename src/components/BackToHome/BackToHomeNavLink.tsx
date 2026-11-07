/**
 * Nav link (admin.components.beforeNavLinks) back to the app home page.
 * Shown to every user who can reach /admin — no role check.
 * Plain <a>, not next/link: "/" lives under the frontend root layout, so this
 * must be a full navigation out of the Payload root layout.
 */
import type { ServerProps } from 'payload'

import React from 'react'

const BackToHomeNavLink: React.FC<ServerProps> = () => (
  // Full navigation is intentional: "/" is in a different root layout than /admin.
  // eslint-disable-next-line @next/next/no-html-link-for-pages
  <a
    className="nav__link"
    href="/"
    style={{
      display: 'block',
      padding: '0.5rem 0',
      marginBottom: '0.5rem',
      color: 'var(--theme-elevation-800)',
      fontWeight: 600,
      textDecoration: 'none',
    }}
  >
    ← กลับหน้าหลัก
  </a>
)

export default BackToHomeNavLink
