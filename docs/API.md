# API — Restaurant ERP, Phase 1

Base URL: `https://api.ourdomain.pk/v1`. JSON. All request bodies validated by zod schemas in `packages/shared/schemas`.

## Conventions

- **Auth**: `Authorization: Bearer <accessToken>`. Tenant comes from the token, never from the request body.
- **Branch**: branch-scoped endpoints take `branchId` in the path or query; server checks the user has access.
- **Permissions**: each endpoint lists its permission key; checked by `PermissionGuard`.
- **Manager override**: restricted actions accept header `X-Override-Token` (from `POST /auth/override`).
- **Idempotency**: create/mutation endpoints from POS accept `Idempotency-Key` header (= client event/entity ID).
- **Pagination**: `?limit=50&cursor=<opaque>` → `{ data, nextCursor }`.
- **Errors**: `{ error: { code, message, details? } }` with codes like `VALIDATION_ERROR`, `FORBIDDEN`, `OVERRIDE_REQUIRED`, `NOT_FOUND`, `CONFLICT`, `BUSINESS_DAY_CLOSED`, `BRANCH_CLOSED`, `OTP_REQUIRED`, `RATE_LIMITED`.
- **Money** in paisa (integers); dates ISO 8601 UTC; `businessDate` as `YYYY-MM-DD`.

Notation: `METHOD path — description [permission]`

## Auth
- `POST /auth/login` — email/phone + password → tokens
- `POST /auth/refresh` — rotate refresh token
- `POST /auth/logout`
- `POST /auth/pin` — device token + PIN → staff session
- `POST /auth/override` — manager PIN + actionKey (+ entity) → override token (60 s)
- `GET /auth/me` — user, permissions, branches

## Platform (super admin)
- `GET/POST /platform/tenants`, `PATCH /platform/tenants/:id` (plan, status)
- `POST /platform/tenants/:id/impersonate` (audited)
- `GET/POST/PATCH /platform/plans`

## Tenant, branches, devices
- `GET/PATCH /tenant` [settings.manage]
- `GET/POST/PATCH /branches`, `GET /branches/:id` [settings.manage]
- `PATCH /branches/:id/settings` [settings.manage]
- `POST /devices/register` [settings.manage] → device token
- `GET/PATCH/DELETE /devices` [settings.manage]
- `GET /branches/:id/business-day` · `POST /branches/:id/business-day/close` [pos.shift.open_close + manager]

## Branding
- `GET /branding` — current config + version
- `PUT /branding` — full config (validated, contrast-checked) [branding.manage] → bumps version, triggers storefront revalidation, emits `branding.updated`
- `GET /branding/history` · `POST /branding/restore/:version` [branding.manage]
- `POST /branding/preview-theme` — config → generated CSS variables + contrast warnings (no save)
- `POST /media` (multipart; `kind`) → processed asset with variant URLs [branding.manage or menu.manage]
- `GET /branding/receipt-logo.bmp?width=384` — monochrome receipt logo
- `GET /branches/:id/tables/qr-cards.pdf` — printable QR table cards [settings.manage]

## Users & roles
- `GET/POST/PATCH/DELETE /users` [staff.manage] · `POST /users/:id/reset-pin`
- `GET/POST/PATCH/DELETE /roles` [staff.manage]
- `GET /permissions` — list of permission keys with labels

## Menu
- `GET/POST/PATCH/DELETE /categories` [menu.manage] · `POST /categories/reorder`
- `GET/POST/PATCH/DELETE /items` [menu.manage] · `GET /items/:id`
- `POST/PATCH/DELETE /items/:id/variants`
- `PUT /items/:id/price-overrides`
- `GET/POST/PATCH/DELETE /modifier-groups` (with modifiers)
- `PUT /items/:id/modifier-groups`
- `PUT /items/:id/deal-groups`
- `POST /branches/:id/availability` — `{ itemId, available, until? }` [pos.order.create] (one-tap out of stock)
- `POST /menu/import` (CSV/XLSX) · `GET /menu/import-template`
- `GET /stations`, `POST/PATCH /stations` [settings.manage]

## Tables & QR
- `GET/POST/PATCH /branches/:id/areas`, `/branches/:id/tables` [settings.manage]
- `POST /tables/:id/rotate-qr` [settings.manage]
- `GET /branches/:id/table-requests?status=open` · `POST /table-requests/:id/ack`

## Orders (POS)
- `POST /orders` — create (client ID allowed) [pos.order.create]
- `GET /orders?branchId&status&businessDate&channel` · `GET /orders/:id`
- `POST /orders/:id/lines` — add lines
- `PATCH /orders/:id/lines/:lineId` — qty/notes (after KOT needs [pos.order.edit_after_kot] or override)
- `POST /orders/:id/lines/:lineId/void` — `{ reason, voidType }` [pos.order.void] or override
- `POST /orders/:id/send-kot` — creates KOTs for unsent lines, returns print jobs
- `POST /orders/:id/discount` — `{ discountId | type, value, reason }` (limit by role, else override)
- `POST /orders/:id/transfer-table` · `POST /orders/:id/merge` · `POST /orders/:id/move-lines`
- `POST /orders/:id/split` — `{ mode: 'items'|'equal'|'amount', ... }` → child orders
- `POST /orders/:id/print-bill`
- `POST /orders/:id/payments` — `[{ methodId, amountPaisa, tenderedPaisa?, reference? }]` [pos.payment.take]
- `POST /orders/:id/refund` — `{ paymentId, amountPaisa, reason }` [pos.refund]
- `POST /orders/:id/void` — whole order [pos.order.void]
- `POST /orders/:id/reopen` [pos.order.reopen]
- `POST /orders/:id/status` — served / dispatched / completed
- `POST /orders/:id/reprint` — `{ type: 'receipt'|'kot' }` (marked REPRINT)
- `POST /pricing/quote` — cart → priced breakdown (same engine; used by back office/storefront)

## Online & QR order handling (staff side)
- `GET /branches/:id/online/pending` — pending online + QR orders
- `POST /orders/:id/accept` — `{ estimatedMinutes }` [online.manage or pos.order.create]
- `POST /orders/:id/reject` — `{ reason, note? }`
- `POST /branches/:id/online/pause` — `{ minutes | indefinite }` · `POST /branches/:id/online/resume`
- `GET/PUT /branches/:id/opening-hours` · `GET/POST/DELETE /branches/:id/closures`
- `GET/POST/PATCH/DELETE /branches/:id/delivery-zones`
- `GET/PUT /branches/:id/online-settings`
- `GET/POST/DELETE /customers/blocklist`

## Payments config, discounts, tax
- `GET/POST/PATCH /payment-methods` [settings.manage]
- `GET/POST/PATCH /discounts` [settings.manage]
- `GET/POST/PATCH /tax-rules` [settings.manage]

## Shifts & cash
- `POST /shifts/open` — `{ branchId, deviceId, openingFloatPaisa }`
- `GET /shifts/current?deviceId`
- `POST /shifts/:id/cash-movements` — drop / payout `{ type, amountPaisa, reason, expenseCategoryId? }`
- `POST /shifts/:id/close` — `{ countedCashPaisa, note }` → expected, difference (blind count: expected returned only after submit)
- `GET /shifts/:id/report`

## Sync (offline POS)
- `POST /sync/push` — `{ deviceId, events: [{ id, seq, type, entityId, payload, createdAt }] }` → `{ results: [{ id, status, error?, serverEntity? }] }`
- `GET /sync/pull?since=<cursor>&scopes=menu,tables,users,settings,branding,orders` → `{ changes, cursor }`
- `GET /sync/bootstrap` — full master data snapshot for first install

## Kitchen
- `GET /kds/tickets?stationId&status` [kds.view]
- `POST /kds/lines/:lineId/status` — preparing / ready
- `POST /kds/tickets/:kotId/bump` · `POST /kds/tickets/:kotId/recall`

## Inventory
- `GET/POST/PATCH/DELETE /ingredients` [inventory.view / inventory.adjust] · `PUT /ingredients/:id/purchase-units`
- `GET /units` · `POST /units` (custom)
- `GET/PUT /recipes?targetType&targetId` [menu.manage] · `GET /recipes/:id/cost`
- `POST /productions` — prepared items batch [inventory.adjust]
- `POST /wastage` [inventory.adjust]
- `POST /stock/adjustments` — `{ ingredientId, qty, reason }` [inventory.adjust]
- `GET /stock?branchId` — levels + value · `GET /stock/movements?ingredientId&from&to`
- `POST /stock-counts` · `PUT /stock-counts/:id/lines` · `POST /stock-counts/:id/submit` · `POST /stock-counts/:id/approve` [inventory.count]
- `GET /stock/low?branchId` · `GET /stock/purchase-suggestions?branchId`

## Purchasing
- `GET/POST/PATCH/DELETE /suppliers` · `GET /suppliers/:id/ledger`
- `GET/POST/PATCH /purchase-orders` · `POST /purchase-orders/:id/send` (PDF / WhatsApp text) · `POST /purchase-orders/:id/cancel` [purchase.create]
- `POST /grns` [purchase.receive] · `GET /grns/:id` · `POST /grns/:id/cancel` (reverses movements)
- `POST /supplier-payments` [supplier.pay]
- `POST /supplier-returns` [purchase.receive]

## Finance
- `GET/POST/PATCH/DELETE /expense-categories`, `/expenses` [expense.manage]
- `GET /customers/:id/ledger` · `POST /customers/:id/payments` (credit settlement)

## Staff
- `GET/POST/PATCH/DELETE /employees` [staff.manage]
- `POST /attendance/clock` — PIN on POS `{ employeeId|userId, action: 'in'|'out' }`
- `GET /attendance?branchId&month` · `PATCH /attendance/:id` (manual edit, audited)
- `POST /employees/:id/advances`
- `POST /payroll-runs` · `GET /payroll-runs/:id` · `PATCH /payroll-runs/:id/lines/:lineId` · `POST /payroll-runs/:id/finalize` · `POST /payroll-runs/:id/mark-paid`

## Customers
- `GET /customers?search=` [customers.view] · `GET /customers/lookup?phone=` (POS) · `GET/PATCH /customers/:id` · `POST /customers/:id/addresses`
- `POST /customers/:id/loyalty/redeem` (on order)

## Reports (all accept `branchIds[]`, `from`, `to` business dates, `format=json|xlsx|pdf`)
- `GET /reports/dashboard` [reports.sales]
- `GET /reports/z-report?branchId&date`
- `GET /reports/sales/items`, `/sales/categories`, `/sales/hourly`, `/sales/weekday`, `/sales/channels`, `/sales/staff`, `/sales/payment-methods`
- `GET /reports/exceptions` (voids, refunds, discounts, comps) [audit.view]
- `GET /reports/shifts`
- `GET /reports/online-orders`
- `GET /reports/inventory/stock`, `/inventory/movements`, `/inventory/wastage`, `/inventory/variance?countFrom&countTo` [inventory.view]
- `GET /reports/food-cost` [reports.cost]
- `GET /reports/purchases`, `/reports/supplier-balances`
- `GET /reports/expenses`, `/reports/pnl`, `/reports/tax` [reports.financial]
- `GET /reports/customers`
- `GET /audit-logs` [audit.view]

## Notifications
- `GET /notifications` · `POST /notifications/:id/read` · `POST /notifications/read-all`

## Public storefront API (no staff auth; tenant from host header; rate-limited)
- `GET /public/store` — tenant name, branding (theme vars, logo URLs), branches, open/closed/paused status
- `GET /public/menu?branchId&mode=online|table` — categories, items, variants, modifiers, deals, availability
- `GET /public/table/:qrToken` — branch, table, QR mode, open status
- `POST /public/table/:qrToken/request` — `{ type: 'call_waiter'|'request_bill', dailyCode? }`
- `GET /public/delivery-zones?branchId` · `POST /public/delivery-check` — `{ branchId, area | lat,lng }` → zone, charge, min order
- `POST /public/cart/quote` — server-priced cart
- `POST /public/otp/send` — `{ phone, channel }` · `POST /public/otp/verify` — `{ phone, code }` → `trustedDeviceToken`
- `POST /public/orders` — `{ branchId, mode, type, cart, customer, address?, notes, trustedDeviceToken | otpToken, qrToken?, dailyCode? }` → `{ publicToken, number, status }` (rejects with `BRANCH_CLOSED`, `OTP_REQUIRED`, `MIN_ORDER_NOT_MET`, `OUT_OF_AREA`, `ITEM_UNAVAILABLE`, blocked number)
- `GET /public/orders/:publicToken` — status timeline, ETA, items, totals
- `GET /public/customer/addresses` (with trusted device token) — saved addresses

## Print agent
- `GET /print-agent/jobs?since` — cloud-originated jobs for this branch (device token of type print_agent)
- `POST /print-agent/jobs/:id/status` — printed / failed
- Socket room `device:{agentId}` receives `print.job` events.

## Realtime events (Socket.IO `/rt`)
`order.created`, `order.updated`, `kot.created`, `kds.item_ready`, `online.order_pending`, `qr.order_pending`, `qr.call_waiter`, `qr.request_bill`, `menu.availability_changed`, `online.paused_changed`, `branding.updated`, `notification.created`, `sync.pull_hint`, `print.job`.
