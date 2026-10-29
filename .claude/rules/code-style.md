# Code Style Rules

Loaded alongside `CLAUDE.md`. Keep these in mind on every change.

- **Dates in พ.ศ.** — render all dates in Buddhist-era with Thai month names. Store ISO internally; convert only at the UI layer.
- **Role-scoped queries** — every data access is scoped to the current user's classroom. Advisors see only their own classroom(s); only Admin/Discipline may read broader. Never write a query that can leak cross-classroom data.
- **AuditLog on edits** — any create/edit/backdate of an `AttendanceRecord` must write a row to `AuditLog` (actor, action, before→after, timestamp).
- **No hardcoded theme colors** — use CSS variables / Tailwind theme tokens for the red–gold brand and action-button colors. Tokens live in `docs/04-design/design-system.md`.
- **TypeScript strict** — typed fields and props; functional components only.
