# Architecture — Restaurant ERP, Phase 1

## 1. System overview

```
                ┌──────────────────────── Cloud (VPS, Docker Compose) ────────────────────────┐
                │                                                                              │
 Customers ───► │  Caddy (HTTPS, *.ourdomain.pk)                                               │
 (phones)       │     ├── store.*  / {slug}.ourdomain.pk ──► apps/store (Next.js SSR)          │
                │     ├── app.ourdomain.pk ───────────────► apps/web (static PWA build)        │
                │     └── api.ourdomain.pk ───────────────► apps/api (NestJS) ─┬─► PostgreSQL  │
                │                                          │  REST + Socket.IO  ├─► Redis       │
                │                                          │                    └─► S3 / R2     │
                │                                          └── BullMQ workers (sync, OTP,      │
                │                                              notifications, fiscal, reports)  │
                └──────────────────────────────────────────────────────────────────────────────┘
                                         ▲            ▲
                         HTTPS + WS      │            │
 ┌──────────── Restaurant LAN ───────────┴────────────┴───────────┐
 │  POS (PWA, IndexedDB)   Waiter tablets   KDS screens            │
 │        │  http://127.0.0.1:9123 or LAN IP                       │
 │        ▼                                                         │
 │  print-agent (Node) ──► receipt printer, kitchen printers (LAN/USB)
 └──────────────────────────────────────────────────────────────────┘
```

## 2. Apps and responsibilities

| App | Responsibility |
|---|---|
| `apps/api` | Auth, tenancy, all business logic and validation, sync endpoint, realtime events, jobs, file uploads, fiscal/OTP providers |
| `apps/web` | Staff PWA. Route groups: `/pos`, `/kds`, `/admin` (back office), `/platform` (super admin). Offline-first for `/pos` and `/kds` |
| `apps/store` | Public storefront: QR table mode and online ordering. SSR, branded per tenant, tiny client bundle |
| `apps/print-agent` | Runs on the restaurant's counter PC. Receives print jobs over HTTP from POS devices on the LAN, renders ESC/POS, sends to printers. Also prints KOTs for online/QR orders pushed from the cloud |
| `packages/shared` | zod schemas, TS types, `pricing` engine, `money` utils, `permissions`, enums, business-day helpers, branding schema + theme generator |

## 3. Backend module structure (NestJS)

```
apps/api/src/
  core/        prisma (with tenant extension), config, logger, guards (auth, tenant, permission), audit, errors
  auth/        login, PIN login, device registration, refresh tokens, manager override tokens
  platform/    tenants, plans, super admin
  tenants/     tenant settings, branches, devices, business day
  branding/    branding settings, image upload/processing, theme generation
  users/       users, roles, permissions
  menu/        categories, items, variants, modifiers, deals, availability
  tables/      areas, tables, QR tokens
  orders/      orders, lines, KOT, status, split, transfer, merge
  payments/    payments, refunds, payment methods
  shifts/      shifts, cash drops, cash-up, day close
  sync/        offline sync ingest + pull
  kitchen/     stations, KDS events
  storefront/  public menu, cart validation, checkout, OTP, order tracking
  online/      accept/reject, pause, opening hours, delivery zones, blocklist
  inventory/   ingredients, units, recipes, production, stock movements, counts, variance
  purchasing/  suppliers, POs, GRNs, supplier payments, returns
  finance/     expenses, receivables, P&L, tax report
  staff/       employees, attendance, advances, payroll
  customers/   customers, addresses, credit, loyalty
  reports/     report queries (read models), exports
  notifications/ in-app notifications, outbound messages (SMS/WhatsApp providers)
  fiscal/      FiscalProvider interface + "none" provider
  realtime/    Socket.IO gateway, rooms per tenant/branch/station
```

Every module: `controller` (thin) → `service` (logic) → Prisma. DTOs are zod schemas from `packages/shared`.

## 4. Multi-tenancy

- Single PostgreSQL database, shared schema, `tenant_id` column on every tenant-owned table.
- Request context (AsyncLocalStorage) carries `tenantId`, `userId`, `branchIds`, `permissions`.
- Prisma client extension automatically adds `where: { tenantId }` on reads and sets `tenantId` on writes for tenant models; a model allow-list defines which are global (plans, platform users).
- **PostgreSQL Row-Level Security** as a second line of defence: `SET app.tenant_id` per transaction; RLS policies on tenant tables. (Implement in Milestone 1; can be enabled after core flows if it slows development, but must be on before first customer.)
- Automated test: create two tenants, assert no endpoint can read the other tenant's data.
- Storefront resolves tenant from host (`slug.ourdomain.pk` or custom domain lookup) → cached in Redis.

## 5. Offline-first POS and sync

### 5.1 Local data (Dexie / IndexedDB)
- **Pulled master data** (read-only locally): menu, prices, modifiers, deals, tables, stations, payment methods, discounts, users (with PIN hashes for offline PIN login), branch settings, branding, tax rules.
- **Local transactions** (created locally): orders, order lines, payments, KOTs, shift events, cash drops, wastage entries, attendance punches.
- **Outbox** table: every local change is appended as an event `{id, type, entityId, payload, createdAt, deviceSeq}`.

### 5.2 Sync protocol
- `POST /sync/push` with a batch of outbox events (max 200). Server processes each **idempotently** by event `id` (stored in `sync_events` table); already-processed IDs return OK without re-applying.
- Server applies events in `deviceSeq` order per device, validates with the same zod schemas and the shared pricing engine (recalculates totals; if mismatch, server value wins and a `sync_conflict` audit entry is written).
- `GET /sync/pull?since=<cursor>` returns changed master data and orders changed by other devices of the same branch (e.g. a waiter tablet order now visible on the cashier POS).
- Sync runs: on reconnect, every 15 s while online, and immediately after important actions (payment, close order).
- Realtime (Socket.IO) is only a "something changed, pull now" signal; data always comes through sync/REST.

### 5.3 Conflict rules
- Orders are **owned by the device that created them** until synced; after that, edits from other devices go through the server.
- Two devices editing the same open table offline: both changes are kept as separate lines (append-only line model); voids reference line IDs. Never silently drop a line.
- Master data conflicts: server always wins.
- Stock movements are generated **on the server** from synced order events (POS never writes stock directly).

### 5.4 Numbering offline
- Order number shown to staff/customer: `{branchCode}-{deviceCode}-{dailySeq}` e.g. `GLB-P1-0042`, generated locally, unique per device per business day.
- Invoice/receipt number: same scheme; fiscal number (if enabled) assigned on sync and printed on reprint.

### 5.5 Multi-device on LAN while internet is down
Phase 1 approach (simple and reliable): **one primary POS per branch** holds the source of truth while offline. Waiter tablets and KDS connect to the cloud when online. While offline:
- KOT printing still works from each device directly through the print agent.
- KDS shows only online-synced tickets; when offline, kitchen relies on printed KOTs (document this to clients).
- Waiter tablets queue their orders locally and sync on reconnect.
(LAN peer sync via the print agent as a local relay is a later enhancement; leave an interface for it.)

## 6. Printing

- `apps/print-agent`: Node.js service installed on the counter PC (Windows installer via `pkg` + NSSM or `node-windows`; runs as a service, starts on boot).
- Exposes `http://<pc-lan-ip>:9123` with a pairing token (shown in agent tray/console, entered once in POS settings).
- Endpoints: `GET /health`, `GET /printers`, `POST /print` (job JSON), `POST /test`.
- Job JSON is **structured** (not raw bytes): `{type: 'kot'|'receipt'|'bill'|'shift_report'|'z_report', printerId, data, branding}`; the agent renders ESC/POS templates (58/80 mm), including logo (pre-rasterised monochrome bitmap cached by branding version), QR codes, bold/large text, cut command, cash drawer kick.
- Printers configured in POS settings: name, connection (network IP:port or USB/Windows printer name), paper width, role (receipt / station KOT).
- Agent also keeps a **socket connection to the cloud** so KOTs for **accepted online/QR orders** print even if no POS screen is open.
- Failed print → retry 3×, then POS shows "Print failed — reprint" with the job kept.
- Fallback when no agent: browser print (`window.print`) of an 80 mm HTML receipt.

## 7. Realtime

- Socket.IO namespace `/rt`, authenticated by JWT.
- Rooms: `tenant:{id}`, `branch:{id}`, `station:{id}`, `device:{id}`, `order:{publicToken}` (customer tracking page).
- Events: `order.created`, `order.updated`, `kot.created`, `kds.item_ready`, `online.order_pending`, `qr.order_pending`, `qr.call_waiter`, `qr.request_bill`, `menu.availability_changed`, `online.paused_changed`, `branding.updated`, `sync.pull_hint`.
- Redis adapter for horizontal scaling.

## 8. Storefront (apps/store)

- Next.js App Router, server components; client components only for cart and checkout.
- Routes:
  - `/` — branch picker / home
  - `/menu` — menu (online mode)
  - `/t/{qrToken}` — table mode (QR)
  - `/cart`, `/checkout`, `/verify` (OTP)
  - `/order/{publicToken}` — tracking (polls every 10 s or uses socket if available)
- Tenant resolved from host in middleware. Menu and branding cached (ISR, `revalidateTag('tenant:{id}:menu')` / `branding` triggered by API on change).
- Cart stored in localStorage (try/catch; works without it). Server re-prices the cart with the shared pricing engine at checkout; client never decides the price.
- Anti-abuse: OTP, rate limiting by IP and phone, honeypot field, blocklist, maximum order value without call confirmation (setting).
- Performance budget: < 150 KB JS first load, images via `next/image` with remote loader to our CDN sizes, no heavy UI libraries.

## 9. Theming / branding implementation

- `tenant_branding.config` JSON validated by `BrandingSchema` (in `packages/shared/branding`).
- `generateTheme(config)` (shared) produces CSS variables: `--brand-primary`, `--brand-primary-hover`, `--brand-primary-fg` (auto black/white by contrast), `--brand-secondary`, `--brand-accent`, `--surface`, `--text`, `--muted`, `--radius`, `--font-body`, `--font-heading`, plus dark-mode values.
- Contrast checker (WCAG relative luminance) in shared, used by the settings UI (live warnings) and by the API (rejects button colour pairs below 4.5:1).
- Storefront: theme `<style>` injected in the root layout server-side; fonts loaded from Google Fonts with `display=swap`, only the selected font.
- Staff app: header accent and logo from branding; staff UI otherwise uses our neutral design system (readability first).
- Receipts: branding object passed in print jobs; logo bitmap generated by API (`/branding/logo-receipt.bmp`) and cached by agent.
- QR table cards: PDF generated server-side (`pdfkit`) from branding + table list.
- Images: upload → `sharp` → sizes (logo 512/256/128, cover 1600/800, item 800/400/200) → WebP (+ PNG for logos) → S3 key with content hash → CDN URL.
- Live preview in settings: the settings page renders a preview component using the unsaved config through the same `generateTheme`.

## 10. Auth details

- Back office login → access JWT (15 min) + refresh token (30 days, rotating, stored hashed in DB, httpOnly cookie for web).
- Device registration: manager logs in on device → `POST /devices/register` → long-lived device token stored on device.
- PIN login: `POST /auth/pin` with device token + PIN → staff session JWT. Offline PIN check uses locally cached PIN hashes (argon2id, low-cost params acceptable since device-bound) and creates a local session; actions are tagged with userId and verified again on sync.
- Manager override: `POST /auth/override` with manager PIN + action key → one-time override token (60 s) attached to the restricted request. Offline: verified locally against cached hash and recorded; server re-checks the approver had the permission at sync.

## 11. Background jobs (BullMQ)

`otp.send`, `notify.whatsapp/sms`, `online.order_timeout` (escalate/auto-reject), `stock.apply_order` (create stock movements from order events), `cost.recalculate`, `fiscal.report_invoice`, `reports.daily_summary`, `images.process`, `backup.verify`.

## 12. External providers (pluggable interfaces)

- `MessagingProvider` (SMS / WhatsApp): `send(to, template, vars)`. Dev provider logs messages to console and stores in DB. Real providers chosen later (local SMS gateway, WhatsApp Business API provider).
- `FiscalProvider`: `reportInvoice(invoice) → {fiscalNo, qrPayload}`. Default `NoneFiscalProvider`.
- `StorageProvider`: S3-compatible.

## 13. Environments and deployment

- `infra/docker-compose.dev.yml`: postgres, redis, minio, mailhog (optional).
- `infra/docker-compose.prod.yml`: api, worker, store, web (static via Caddy), postgres, redis, caddy; volumes for db and backups.
- Caddy: wildcard certificate for `*.ourdomain.pk` via DNS challenge; on-demand TLS for custom domains (allow-list endpoint in API).
- Env vars documented in `infra/.env.example` (DB URL, Redis URL, JWT secrets, S3 keys, domain, messaging provider keys).
- Backups: nightly `pg_dump` → compressed → uploaded to object storage; 30-day retention; monthly restore test.
- CI (GitHub Actions): lint, typecheck, unit tests, build; e2e on main.
- Logging: pino JSON logs; error tracking (Sentry or self-hosted GlitchTip).

## 14. Testing strategy

- **Unit (Vitest)**: pricing engine, money utils, stock deduction & yield, weighted average cost, variance, cash-up, business day, contrast checker, permissions.
- **Integration (API)**: each module's main endpoints against a test DB; tenant isolation suite.
- **E2E (Playwright)**: (1) dine-in order → KOT → split payment → close; (2) offline 20 orders → reconnect → reports; (3) online order with OTP → accept → KDS ready → tracking page; (4) QR order with confirmation; (5) GRN → stock up → sale → count → variance; (6) branding change reflects on storefront.
