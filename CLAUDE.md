# CLAUDE.md — Restaurant ERP (Phase 1)

This file is the standing instruction set for Claude Code on this project. Read it fully at the start of every session.

## What we are building

A multi-tenant SaaS restaurant management system (ERP) for restaurants in Pakistan. One deployment serves many restaurants ("tenants"). Each tenant can have one or more branches. Phase 1 is the sellable first version.

Phase 1 covers: POS, kitchen tickets/KDS, menu, **QR table menu**, **own online ordering page**, inventory with recipes, purchasing, basic accounts, staff, customers, reports, security, and **branding/customization** (colors, logo, receipts, storefront look).

## Required reading (in this order)

1. `docs/PRD.md` — what to build, business rules, acceptance criteria
2. `docs/ARCHITECTURE.md` — how it is structured (offline, printing, theming, multi-tenancy)
3. `docs/DATABASE.md` — data model
4. `docs/API.md` — endpoints
5. `docs/BUILD_PLAN.md` — milestone order; always work on the current milestone only
6. `docs/PROGRESS.md` — what is done; update it at the end of every task

If a requirement is unclear or two docs disagree, stop and ask the user. Do not invent business rules.

## Tech stack (fixed — do not change without asking)

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Language | TypeScript everywhere, `strict: true` |
| API | NestJS, Prisma ORM, PostgreSQL 16 |
| Jobs / realtime | Redis, BullMQ (jobs), Socket.IO (realtime) |
| Staff app (POS, KDS, Back Office) | React + Vite, TanStack Router + TanStack Query, Tailwind CSS, shadcn/ui, Dexie (IndexedDB), vite-plugin-pwa |
| Customer storefront (QR menu + online ordering) | Next.js (App Router), Tailwind CSS, server-rendered, minimal client JS |
| Shared logic | `packages/shared`: zod schemas, types, money utils, **pricing engine** |
| Printing | `apps/print-agent`: small Node.js service on the counter PC, ESC/POS via `node-thermal-printer` |
| File storage | S3-compatible (MinIO in dev, Cloudflare R2 or S3 in prod), images converted to WebP with `sharp` |
| Tests | Vitest (unit), Playwright (e2e for critical flows) |
| Deploy | Docker Compose on a VPS, Caddy as reverse proxy (automatic HTTPS, wildcard subdomains) |

## Repository layout

```
/apps
  /api            NestJS backend
  /web            Staff PWA: /pos, /kds, /admin routes
  /store          Next.js customer storefront (QR menu + online ordering)
  /print-agent    Local printing service
/packages
  /shared         zod schemas, types, pricing engine, money utils, permissions list
  /config         eslint, tsconfig, tailwind presets
/docs             Specs (this folder)
/infra            docker-compose, Caddyfile, env templates
```

## Non-negotiable coding rules

1. **Money is stored as integers in paisa** (1 PKR = 100 paisa). Never use floats for money. Use helpers in `packages/shared/money.ts`.
2. **Every tenant-owned table has `tenant_id`**, and every query is scoped by it. Use the Prisma tenant middleware/extension; never query tenant data without it. Branch-scoped tables also have `branch_id`.
3. **The pricing engine lives only in `packages/shared/pricing`** and is used by both the POS (offline) and the API. Never duplicate bill calculation logic anywhere else.
4. **IDs are UUIDv7**, and may be generated on the client (needed for offline POS).
5. **Timestamps are stored in UTC.** Display in the tenant timezone (default `Asia/Karachi`). Reports use the **business day** (see PRD), not the calendar day.
6. **Validate every input with zod** schemas from `packages/shared`. The same schema is used on client and server.
7. **Sensitive actions write to `audit_logs`**: void, refund, discount, price change, bill reopen, stock adjustment, permission change, settings change, cash-up difference.
8. **Permissions are checked on the server** for every endpoint, using the permission keys in `packages/shared/permissions.ts`. The UI hides what a user cannot do, but the server is the authority.
9. **Soft delete** (`deleted_at`) for master data (items, ingredients, suppliers, users, customers). Never hard-delete transactional data (orders, payments, stock movements); reverse it with a new record.
10. **Stock is never edited directly.** Every change is a row in `stock_movements`; current stock is derived/cached from movements.
11. **No hardcoded colors or restaurant names in customer-facing UI.** All storefront, receipt and POS branding comes from tenant branding settings (see PRD §14).
12. **Customer-facing pages must stay light**: storefront first load under ~150 KB JS, images lazy-loaded WebP, works on slow 3G.
13. Keep functions small, name things clearly, no dead code, no `any`.
14. **Do not build Phase 2 features** (listed in PRD §19) even if they look easy.

## Workflow for each task

1. Read the relevant milestone in `docs/BUILD_PLAN.md` and the matching PRD section.
2. Make a short plan and show it before writing large amounts of code.
3. Implement, including Prisma migration, API, UI, and tests.
4. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`. Fix failures before finishing.
5. Update `docs/PROGRESS.md` (what was done, what is left, any decisions made).
6. Commit with a clear message (`feat(pos): split bill by item`).

## Definition of done (every feature)

- Meets the acceptance criteria in the PRD
- Server-side permission check + tenant scoping
- zod validation on inputs
- Audit log for sensitive actions
- Unit tests for any calculation (pricing, stock, costing, cash-up)
- Works on a 10-inch tablet (POS) and a cheap Android phone (storefront)
- No console errors, lint and typecheck pass

## Commands (to be set up in Milestone 0)

```
pnpm install
pnpm dev            # all apps
pnpm dev --filter api
pnpm db:migrate     # prisma migrate dev
pnpm db:seed        # demo tenant "Demo Biryani House" with menu, recipes, stock, users
pnpm test
pnpm lint && pnpm typecheck
docker compose -f infra/docker-compose.dev.yml up -d   # postgres, redis, minio
```

## Demo data

The seed must create a realistic Pakistani restaurant: menu (biryani, karahi, BBQ, naan, drinks, deals), ingredients with recipes, suppliers, users for every role with PIN `1234`, two tables areas, delivery zones in Lahore, and a branded storefront. Demo logins are documented in `README.md`.
