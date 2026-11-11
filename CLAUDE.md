# CLAUDE.md

Project memory for Claude Code. Keep concise. Modular rules live in `.claude/rules/`.

## Project

**Advisor Attendance System** (ระบบครูที่ปรึกษา) — a Thai-language web app for homeroom advisors (ครูที่ปรึกษา) at **โรงเรียนมัธยมหนองเขียด**, **อบจ.ขอนแก่น** to take and manage daily student attendance, with reports, statistics, and charts.

- UI is **Thai-language** throughout.
- Dates always render in **Buddhist-era (พ.ศ.)** with Thai month names.
- Aligned to the Thai academic calendar (2 terms / ภาคเรียน).

## Stack

- **Framework:** Next.js (App Router) + TypeScript
- **Backend/CMS:** Payload 3, running in-app (same Next.js app) — admin UI, auth, RBAC, Local/REST/GraphQL APIs
- **Database:** Postgres via Neon (Payload Postgres adapter)
- **Charts:** Recharts or Chart.js
- **Deploy:** Vercel (Next + Payload co-hosted)

## Repo layout

- `app/` — Next.js routes (App Router)
- `payload/` or `collections/` — Payload config & collection definitions
- `components/` — shared React components
- `lib/` — utilities (dates, export, access helpers)
- `docs/` — project plan & specs — start at [`docs/README.md`](docs/README.md)

## Commands

Package manager is **pnpm**. Start the local Postgres container **before** `pnpm dev`.

- `docker compose up -d` — start local Docker Postgres (dev DB) only; run this first
- `docker compose --profile s3 up -d` — also start local SeaweedFS (dev S3 for student-photo storage; set the `S3_*` vars from `.env.example`). Stop it with `docker compose --profile s3 stop`
- `pnpm dev` — start Next.js + Payload dev server (http://localhost:3000, admin at `/admin`)
- `pnpm build` — production build
- `pnpm start` — run the production build
- `pnpm lint` — ESLint
- `pnpm generate:types` — regenerate `src/payload-types.ts` (run after collection changes)
- `pnpm generate:importmap` — regenerate the admin import map
- `pnpm payload` — Payload CLI (migrations, etc.)

## Conventions

- **TypeScript strict** mode.
- **Functional components** only.
- Dates **always rendered in พ.ศ.** with Thai month names (store ISO internally; convert at the UI layer).
- **All data access is role-scoped** — advisors see only their own classroom(s); Admin/Discipline may be broader.
- Write a row to **`AuditLog`** on any attendance **edit or backdate** (actor, action, before→after, timestamp).

## Theme

Red–gold brand chrome with functional action-button colors (มา/สาย/ลา/ขาด). Full tokens live in [`docs/04-design/design-system.md`](docs/04-design/design-system.md). Use **CSS variables / Tailwind theme** — **never hardcode colors**.

## Do not

- Edit files under `docs/` without being asked (another workstream owns it; read for reference only).
- Commit secrets. `DATABASE_URI` and `PAYLOAD_SECRET` belong in `.env` (gitignored); see `.env.example`.
