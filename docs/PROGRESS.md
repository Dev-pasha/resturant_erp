# Progress Log

Claude Code updates this file at the end of every task.

## Current milestone
M0 — Foundation (complete except confirming CI on GitHub)

## Milestone status

| Milestone | Status | Notes |
|---|---|---|
| M0 Foundation | Done, CI pending | Push to GitHub to confirm CI green |
| M1 Auth, tenancy, roles, devices, audit | Not started | |
| M2 Menu, tables, branding & settings | Not started | |
| M3 Pricing engine + POS core | Not started | |
| M4 Kitchen, printing, realtime | Not started | |
| M5 Offline mode & sync | Not started | |
| M6 Storefront: QR + online ordering | Not started | Demo-ready checkpoint |
| M7 Inventory & recipes | Not started | |
| M8 Purchasing | Not started | Pilot checkpoint |
| M9 Accounts, staff, customers | Not started | |
| M10 Reports, dashboard, notifications | Not started | |
| M11 Hardening & launch | Not started | |

## Log
### 2026-11-02 — Milestone 0 — Foundation
- Done: monorepo (pnpm + Turborepo), shared money/business-day/permissions/ids/errors, dev docker compose (postgres, redis), CI workflow, NestJS API (health, pino, zod pipe, error format), Prisma base models + init migration, Vite web shell, Next.js store skeleton, print-agent skeleton. Lint, typecheck, test, build pass; `pnpm dev` starts all apps.
- Decisions: see Decisions record.
- Left / next: confirm CI on GitHub; then M1.

## Decisions record
- Dev ports: postgres 5433, redis 6380 (avoid clashing with local installs).
- MinIO removed from dev compose until M2 (image not pullable here); re-add for media upload.
- API runs via `tsx` (no decorator metadata): Nest constructor injection must use explicit `@Inject(Token)`. API `build` is typecheck-only for now.
- Web uses React 19 to match the store.
- PWA/Dexie deferred to M5; node-thermal-printer deferred to M4.

## Phase 2 ideas (parking lot)
<!-- Anything requested that is out of Phase 1 scope. -->
