# Build Plan — Phase 1

Goal: a sellable Phase 1 as fast as possible, without cutting corners on money, stock, offline and security.

**Strategy:** build in vertical slices. After Milestone 6 you have a demo-able product (POS + kitchen + printing + branding + QR + online ordering). Milestones 7–11 make it a complete Phase 1. Start pilot installs with 1–2 friendly restaurants after Milestone 8.

Each milestone lists: scope, acceptance checks, and a **starter prompt** to paste into Claude Code. Always start a session with:

> Read CLAUDE.md and docs/PROGRESS.md. We are on Milestone N. Read the relevant sections of docs/PRD.md, ARCHITECTURE.md, DATABASE.md and API.md, then propose a plan before coding.

Keep sessions focused: one milestone may take several sessions. Commit after each working piece.

---

## M0 — Foundation (repo, tooling, infra)

**Scope**
- pnpm + Turborepo monorepo with `apps/api`, `apps/web`, `apps/store`, `apps/print-agent`, `packages/shared`, `packages/config`
- TypeScript strict, ESLint, Prettier, Vitest, shared tsconfig/tailwind preset
- `infra/docker-compose.dev.yml` (postgres 16, redis, minio), `.env.example`
- NestJS skeleton with health endpoint, pino logging, zod validation pipe, error format from API.md
- Prisma set up, UUIDv7 helper, base models: plans, tenants, branches, users, roles, role_permissions, devices, audit_logs
- `packages/shared`: `money.ts` (paisa helpers, formatting `Rs 1,250`), `permissions.ts`, business-day helper, enums
- Vite React app with router + Tailwind + shadcn/ui shell; Next.js store skeleton
- GitHub Actions: lint, typecheck, test, build
- `docs/PROGRESS.md` updated; `README.md` with setup steps

**Acceptance:** `docker compose up`, `pnpm dev` starts all apps; `/health` OK; CI green; money and business-day unit tests pass.

**Prompt**
> Set up Milestone 0 exactly as described in docs/BUILD_PLAN.md and the stack in CLAUDE.md. Create the monorepo, tooling, docker compose, NestJS/Vite/Next skeletons, Prisma with the base models listed, and the shared money/permissions/business-day utilities with tests. Show me the folder tree and plan first.

---

## M1 — Auth, tenancy, roles, devices, audit

**Scope**
- Tenant context (AsyncLocalStorage) + Prisma tenant extension + tenant isolation test suite
- Login, refresh rotation, logout; PIN login with device token; manager override tokens
- Roles & permissions CRUD; default system roles seeded per tenant with defaults from PRD §3
- Permission guard; audit service (`audit.log(action, entity, before, after, reason, approver)`)
- Device registration
- Platform admin: create tenant (creates owner user, default roles, first branch, default payment methods, default branding)
- Back office: login page, user & role management screens, device list
- Postgres RLS policies (can be added at end of milestone)

**Acceptance:** two tenants cannot see each other's data (automated test); cashier can't void without override; override recorded with approver in audit log.

**Prompt**
> Implement Milestone 1 (auth, tenancy, roles, devices, audit) per PRD §2–3, ARCHITECTURE §4 and §10, DATABASE §1–2, API "Auth", "Platform", "Users & roles". Include the tenant isolation test suite.

---

## M2 — Menu, tables, branding & settings

**Scope**
- Categories, items, variants, modifier groups, deals, price overrides, channel visibility, branch availability, stations, import from CSV
- Table areas, tables, floor layout editor (drag positions), QR token generation
- **Branding module (PRD §14)**: `BrandingSchema`, `generateTheme`, contrast checker (shared, tested), media upload + `sharp` processing to S3, branding settings UI with **live preview** (storefront preview, receipt preview, POS header preview), history & restore
- Branch settings UI: tax rules, service charge, rounding, payment methods, discounts, day cutoff
- Seed script for demo tenant with full menu and branding

**Acceptance:** owner builds a menu with variants/modifiers/deals; uploads logo, sets colours/font, sees live preview, low-contrast button colours are blocked; history restore works.

**Prompt**
> Implement Milestone 2: menu management, tables/QR tokens, branch settings, and the full branding & customization module from PRD §14 with live preview, contrast checks, image processing and history. Put BrandingSchema, generateTheme and the contrast checker in packages/shared with unit tests.

---

## M3 — Pricing engine + POS core (online first)

**Scope**
- `packages/shared/pricing`: full calculation per PRD §5.4 with exhaustive unit tests (discount types, service charge, tax inclusive/exclusive, tax by payment method, rounding, split bills)
- POS UI (tablet-first): category/item grid, modifiers dialog, deals builder, cart, notes, guest count, order types, table map with status colours, hold/recall, waiter assignment
- Orders API: create, add lines, edit, void line (with override), discounts (role limits), transfer/merge/move lines
- Payments: methods, split payment, cash tender/change, split bill (items/equal/amount), refunds
- Shifts: open, cash drops/payouts, blind close, shift report
- Phone delivery orders: customer lookup by phone, addresses, delivery zone charge
- One-tap "out of stock" toggle from POS

**Acceptance:** full dine-in flow from table to paid & closed; totals match the pricing engine tests; voids/discounts audited; shift close shows correct expected cash.

**Prompt**
> Implement Milestone 3. Start with the pricing engine in packages/shared/pricing and write all unit tests from PRD §5.4 before building the POS UI. Then build the POS screens, orders, payments, split bills, refunds and shifts per PRD §5 and API "Orders", "Shifts".

---

## M4 — Kitchen, printing, realtime

**Scope**
- Kitchen stations routing; KOT creation (new/addition/cancel/reprint)
- KDS screen: tickets, timers, bump/recall, sound, line status → POS
- Socket.IO gateway with rooms and events (ARCHITECTURE §7)
- `apps/print-agent`: HTTP API, pairing token, ESC/POS templates for KOT, bill, receipt, shift report, Z-report (58/80 mm), logo bitmap, QR, cut, drawer kick; retry; cloud socket for remote jobs; Windows service packaging
- Printer settings in POS, test print; browser-print fallback
- Receipt rendering uses branding receipt settings (PRD §14.3)

**Acceptance:** sending an order prints separate KOTs per station; editing after KOT prints a CANCELLED ticket; receipt shows tenant logo/header/footer; KDS updates POS in real time.

**Prompt**
> Implement Milestone 4: kitchen stations, KOTs, KDS screen, realtime gateway, and the print-agent app with ESC/POS templates driven by branding receipt settings. Follow ARCHITECTURE §6–7.

---

## M5 — Offline mode & sync

**Scope**
- Dexie schema for master data + local transactions + outbox
- Bootstrap, pull, push with idempotency (`sync_events`), server-side recalculation & conflict logging
- Offline PIN login, offline overrides, local order numbering (`GLB-P1-0042`)
- Service worker (vite-plugin-pwa) caching app shell; installable PWA
- Sync status indicator and "waiting to sync" queue view
- Server generates stock movements from synced orders (prepares for M7)

**Acceptance:** PRD §5.8 acceptance test (20 offline orders) passes as a Playwright e2e test with network throttled off; no duplicates after repeated pushes.

**Prompt**
> Implement Milestone 5: offline-first POS per ARCHITECTURE §5. Refactor POS data access to go through the local Dexie store and outbox. Build /sync/bootstrap, /sync/push (idempotent) and /sync/pull. Write the offline e2e test from PRD §5.8.

---

## M6 — Storefront: QR table menu + online ordering

**Scope**
- `apps/store` Next.js: tenant from host, branded theme injected server-side, menu (3 layouts), item dialog with modifiers/deals, cart, checkout, order tracking page
- Table mode `/t/{qrToken}`: view menu, call waiter, request bill, order with confirmation (per QR mode), daily code option
- Online: branch select, delivery/pickup, delivery zone check, min order, opening hours, closures, paused state
- OTP via `MessagingProvider` (console provider in dev), trusted device token, rate limits, blocklist, honeypot
- Staff side: pending orders panel with **repeating sound alert**, accept with ETA / reject with reason, escalation and auto-reject jobs, one-tap pause/resume, opening hours & delivery zones settings, online settings
- Accepted orders → normal orders + KOT (printed via agent cloud socket)
- Customer records auto-created/updated
- QR table cards PDF using branding
- Performance budget check (Lighthouse CI on storefront, mobile, slow 4G)

**Acceptance:** PRD §8 and §9 acceptance checks; storefront JS < 150 KB; branding changes appear on storefront within 1 minute.

**Prompt**
> Implement Milestone 6: the customer storefront (QR table mode and online ordering) and the staff-side accept/reject/pause flow per PRD §8–9, ARCHITECTURE §8, API "Public storefront" and "Online & QR order handling". Keep the storefront bundle under 150 KB and theme it entirely from tenant branding.

**→ Demo-ready checkpoint.** Record a demo video; start sales conversations.

---

## M7 — Inventory & recipes

**Scope**
- Units and conversions, ingredients, purchase units
- Recipes for items/variants/modifiers, yield %, sub-recipes (prepared ingredients) and production entries
- Stock movements from orders (on KOT or on payment per branch setting), void handling (wasted / not prepared)
- Weighted average cost; food cost per item & food cost %
- Wastage, adjustments, stock counts (mobile-friendly count screen), approval → variance movements
- Variance report, low stock alerts, purchase suggestions

**Acceptance:** PRD §10 acceptance checks; unit tests for unit conversion, yield, weighted average, variance.

**Prompt**
> Implement Milestone 7: inventory and recipes per PRD §10 and DATABASE §9. Write unit tests for conversions, yield, weighted average cost and variance before the UI.

---

## M8 — Purchasing

**Scope:** suppliers, POs (PDF/WhatsApp share text), GRNs (partial, rejected qty, invoice photo), avg cost update, supplier ledger, payments with allocation, returns, GRN cancel (reversal).

**Acceptance:** GRN increases stock and updates average cost; supplier ledger balance correct after GRN, payment and return.

**Prompt**
> Implement Milestone 8: purchasing per PRD §11 and API "Purchasing".

**→ Pilot checkpoint.** Install at 1–2 friendly restaurants; collect feedback while building M9–M11.

---

## M9 — Accounts, staff, customers

**Scope**
- Expenses & categories (POS payouts flow in), daily cash-up summary, customer credit ledger, monthly P&L, tax report
- `FiscalProvider` interface + `None` provider, fiscal fields on receipts, queue for offline invoices
- Employees, attendance (POS clock in/out), advances, payroll runs → expenses
- Customer list/profile/history, addresses, simple loyalty (optional per tenant)

**Prompt**
> Implement Milestone 9: finance (PRD §12), staff (§13) and customers (§15). Add the FiscalProvider interface with a no-op default provider.

---

## M10 — Reports, dashboard, notifications

**Scope:** all reports in PRD §16 with filters and Excel/PDF export; owner dashboard (mobile-first); Z-report print; day close flow; notifications centre and owner alerts (PRD §17); daily summary job.

**Prompt**
> Implement Milestone 10: reports and owner dashboard per PRD §16, day close and Z-report, and notifications per PRD §17. Make the dashboard work well on a phone.

---

## M11 — Hardening & launch

**Scope**
- Security review: rate limits, RLS enabled, secrets, headers, dependency audit
- Full e2e suite from ARCHITECTURE §14
- Performance pass (POS on low-end Android tablet, storefront on 3G)
- Production compose, Caddy wildcard + on-demand TLS, backups + restore test, monitoring/error tracking
- Onboarding wizard for new tenants: branch, tax, menu import, branding, tables & QR cards, printers, staff PINs
- Platform admin billing basics (plan, trial, suspend)
- User guide (short help pages) and demo tenant reset script

**Acceptance:** fresh tenant onboarded in under 30 minutes by following the wizard; restore from backup verified.

**Prompt**
> Implement Milestone 11: hardening, production deployment, backups, onboarding wizard and the remaining e2e tests. Produce a launch checklist in docs/LAUNCH.md.

---

## Tips for working fast with Claude Code

- One milestone per branch; small commits; ask for a plan first on anything big.
- When something is wrong, paste the exact error and say which acceptance check failed.
- Ask Claude Code to "write the tests first" for money, stock and sync logic.
- Keep `docs/PROGRESS.md` honest; it is how a new session knows where you are.
- If you change a business rule, update `docs/PRD.md` first, then ask Claude Code to implement the change.
- Don't let scope creep in: anything not in PRD goes to a "Phase 2 ideas" list in PROGRESS.md.
