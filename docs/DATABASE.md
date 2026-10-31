# Database — Restaurant ERP, Phase 1

PostgreSQL 16 via Prisma. Conventions:

- `id` UUIDv7 (`String @id @db.Uuid`), `created_at`, `updated_at` on every table; `deleted_at` on master data.
- `tenant_id` on every tenant-owned table (indexed, part of most unique constraints). `branch_id` where branch-scoped.
- Money columns are `BigInt`/`Int` in **paisa**, named `*_amount` or `*_paisa`. Quantities `Decimal(14,4)`.
- Enums as Postgres enums. JSON only where the shape is versioned and validated by zod.
- Prisma model names PascalCase singular; table names snake_case plural via `@@map`.

Legend: **PK** primary key · **FK** foreign key · *(u)* unique.

## 1. Platform & tenancy

**plans** — id, name, code *(u)*, max_branches, max_devices, features (json: e.g. `hide_powered_by`), monthly_price_paisa, active

**tenants** — id, name, slug *(u)*, custom_domain *(u, nullable)*, plan_id FK, status (`trial|active|suspended|cancelled`), trial_ends_at, timezone (default `Asia/Karachi`), currency (default `PKR`), owner_user_id FK

**platform_users** — id, email *(u)*, password_hash, name, active (super admins; not tenant-scoped)

**branches** — id, tenant_id, name, code (short, e.g. `GLB`) *(u per tenant)*, address, phone, lat, lng, ntn, strn, day_cutoff_time (default `04:00`), settings (json: rounding, tax rules ref, service charge, qr_mode, inventory_deduct_on, cash_diff_threshold, online_accept_timeout_min, online_auto_reject_min…), active

**devices** — id, tenant_id, branch_id, name, code (e.g. `P1`) *(u per branch)*, type (`pos|waiter|kds|print_agent`), token_hash, last_seen_at, app_version, active

**business_days** — id, tenant_id, branch_id, date, status (`open|closed`), opened_at, closed_at, closed_by FK users, z_report (json snapshot) · *(u)* (branch_id, date)

## 2. Users & security

**users** — id, tenant_id, name, email *(nullable, u per tenant)*, phone, password_hash *(nullable)*, pin_hash *(nullable)*, role_id FK, employee_id FK *(nullable)*, all_branches bool, active, last_login_at, deleted_at

**user_branches** — user_id, branch_id (access list when not all_branches)

**roles** — id, tenant_id, name, is_system bool, max_discount_percent

**role_permissions** — role_id, permission_key

**refresh_tokens** — id, user_id, token_hash, device_id, expires_at, revoked_at

**audit_logs** — id, tenant_id, branch_id, user_id, approver_user_id *(nullable)*, device_id, action (e.g. `order.void`), entity_type, entity_id, reason, before (json), after (json), ip, created_at · index (tenant_id, action, created_at)

**sync_events** — id (client event id) PK, tenant_id, device_id, device_seq, type, status (`applied|rejected|conflict`), error, received_at

## 3. Branding

**tenant_branding** — id, tenant_id *(u)*, version int, config (json — `BrandingSchema`: identity, colors, font, radius, storefront layout & toggles, about/social, announcement, messages, seo, receipt settings, pos settings), updated_by, updated_at

**branding_history** — id, tenant_id, version, config (json), created_by, created_at (allows "restore previous")

**media_assets** — id, tenant_id, kind (`logo|logo_dark|favicon|cover|item|category|receipt_logo|other`), original_key, variants (json: size → key/url), width, height, content_hash, created_by

## 4. Menu

**categories** — id, tenant_id, name, name_ur, image_id FK media, sort_order, channels (array: `pos|qr|online`), available_from, available_to (time, nullable), active, deleted_at

**kitchen_stations** — id, tenant_id, branch_id, name, printer_id FK *(nullable)*, kds_enabled

**menu_items** — id, tenant_id, category_id, name, name_ur, description, image_id, base_price_paisa, tax_category (`standard|exempt|custom`), station_key (logical station name mapped per branch), tags (array), channels (array), calories *(nullable)*, sort_order, is_deal bool, active, deleted_at

**item_variants** — id, tenant_id, item_id, name (e.g. Half/Full), price_paisa, sort_order, active

**item_price_overrides** — id, tenant_id, item_id, variant_id *(nullable)*, branch_id *(nullable)*, order_type *(nullable)*, price_paisa · *(u)* combination

**branch_item_availability** — tenant_id, branch_id, item_id, available bool, until (timestamp, nullable: "out of stock today" resets at business day end), updated_by

**modifier_groups** — id, tenant_id, name, min_select, max_select, sort_order

**modifiers** — id, tenant_id, group_id, name, name_ur, price_paisa, sort_order, active

**item_modifier_groups** — item_id, group_id, sort_order

**deal_groups** — id, tenant_id, deal_item_id FK menu_items, name (e.g. "Choose 2 pizzas"), min_select, max_select

**deal_group_options** — id, deal_group_id, item_id, variant_id *(nullable)*, extra_price_paisa

## 5. Tables & QR

**table_areas** — id, tenant_id, branch_id, name (e.g. Hall, Rooftop), sort_order

**tables** — id, tenant_id, branch_id, area_id, name/number, seats, pos_x, pos_y, shape, qr_token *(u)*, qr_token_rotated_at, daily_code *(nullable)*, active

**table_requests** — id, tenant_id, branch_id, table_id, type (`call_waiter|request_bill`), status (`open|acknowledged`), acknowledged_by, created_at

## 6. Orders & payments

**orders** — id (client-generated allowed), tenant_id, branch_id, business_date, device_id, number (e.g. `GLB-P1-0042`) *(u per branch)*, channel (`pos|qr|online`), type (`dine_in|takeaway|delivery|pickup`), status (enum per PRD §5.2 + `pending_confirmation|rejected`), table_id, guest_count, waiter_id, cashier_id, customer_id, customer_address_id, delivery_zone_id, notes,
subtotal_paisa, line_discount_paisa, bill_discount_paisa, service_charge_paisa, delivery_charge_paisa, tax_paisa, rounding_paisa, total_paisa, paid_paisa,
discount_id *(nullable)*, discount_reason, parent_order_id *(split bills)*, merged_into_order_id, public_token *(u, for tracking)*, estimated_ready_at, accepted_at, accepted_by, rejected_reason, fiscal_number, fiscal_qr, fiscal_status (`none|pending|reported|failed`), opened_at, closed_at · indexes (branch_id, business_date), (tenant_id, customer_id)

**order_lines** — id, tenant_id, order_id, item_id, variant_id, name_snapshot, unit_price_paisa, qty Decimal, modifiers (json snapshot: [{modifierId,name,pricePaisa}]), deal_selections (json snapshot), notes, line_discount_paisa, line_total_paisa, tax_rate_bp (basis points), station_key, kot_status (`new|sent|preparing|ready|served`), voided bool, void_reason, void_type (`wasted|not_prepared`), voided_by, void_approved_by, comp bool, added_by, created_at

**kots** — id, tenant_id, branch_id, order_id, station_id, number, kind (`new|addition|cancel|reprint`), lines (json snapshot), printed_at, print_status, created_by

**payment_methods** — id, tenant_id, name, type (`cash|card|bank|jazzcash|easypaisa|credit|other`), sort_order, active

**payments** — id, tenant_id, branch_id, order_id, shift_id, method_id, amount_paisa, tendered_paisa, change_paisa, reference, status (`completed|refunded|partially_refunded`), received_by, created_at

**refunds** — id, tenant_id, payment_id, order_id, amount_paisa, reason, refunded_by, approved_by, created_at

**discounts** — id, tenant_id, name, type (`percent|fixed`), value (bp or paisa), scope (`line|bill`), is_comp bool, requires_reason bool, active

**tax_rules** — id, tenant_id, branch_id, name, rate_bp, applies_to_order_types (array), applies_to_payment_types (array), tax_category, prices_include_tax bool, service_charge_taxable bool, active, effective_from

## 7. Shifts & cash

**shifts** — id, tenant_id, branch_id, device_id, business_date, user_id, opened_at, opening_float_paisa, closed_at, counted_cash_paisa, expected_cash_paisa, difference_paisa, status (`open|closed`), closing_note

**cash_movements** — id, tenant_id, shift_id, type (`drop|payout|float_in`), amount_paisa, reason, expense_id *(nullable)*, user_id, approved_by, created_at

## 8. Online ordering & customers

**delivery_zones** — id, tenant_id, branch_id, name, areas (array of area names), radius_m *(nullable)*, charge_paisa, min_order_paisa, est_minutes, active

**opening_hours** — id, tenant_id, branch_id, weekday (0–6), open_time, close_time (close past midnight allowed)

**closures** — id, tenant_id, branch_id, date, reason

**online_settings** — branch_id PK, tenant_id, delivery_enabled, pickup_enabled, paused_until *(nullable)*, paused_indefinitely bool, max_order_without_call_paisa, auto_reject_minutes, escalate_minutes

**customers** — id, tenant_id, phone *(u per tenant, normalised +92…)*, name, email, notes, tags (array), blocked bool, blocked_reason, credit_enabled, credit_limit_paisa, loyalty_points int, total_spent_paisa, order_count, last_order_at, deleted_at

**customer_addresses** — id, tenant_id, customer_id, label, area, address, landmark, lat, lng, delivery_zone_id

**otp_requests** — id, tenant_id, phone, code_hash, channel (`sms|whatsapp`), attempts, expires_at, verified_at, ip

**trusted_devices** — id, tenant_id, phone, token_hash, expires_at (90 days)

**loyalty_transactions** — id, tenant_id, customer_id, order_id, points (+/−), type (`earn|redeem|adjust`), created_at

**customer_ledger** — id, tenant_id, customer_id, type (`credit_sale|payment|adjustment`), amount_paisa, order_id, reference, created_by, created_at

## 9. Inventory

**units** — id, tenant_id *(nullable = system unit)*, name, code (`g|kg|ml|l|pc|dozen|…`), base_unit_code, factor_to_base

**ingredients** — id, tenant_id, name, category, stock_unit_code, recipe_unit_code, reorder_level, par_level, avg_cost_paisa_per_stock_unit (Decimal for precision), is_prepared bool (sub-recipe output), storage_location, active, deleted_at

**ingredient_purchase_units** — id, ingredient_id, name (e.g. "Bag 50kg"), factor_to_stock_unit

**recipes** — id, tenant_id, target_type (`item|variant|modifier|prepared_ingredient`), target_id, yield_qty (for prepared batch), yield_unit_code, notes, active

**recipe_lines** — id, recipe_id, ingredient_id, qty, unit_code, yield_percent (default 100)

**stock_levels** — tenant_id, branch_id, ingredient_id, qty (stock unit), value_paisa, updated_at · PK (branch_id, ingredient_id) — cache, rebuilt from movements

**stock_movements** — id, tenant_id, branch_id, business_date, ingredient_id, type (enum per PRD §10), qty (+/−, stock unit), unit_cost_paisa, total_cost_paisa, ref_type (`order|order_line|grn|production|wastage|count|return|adjustment`), ref_id, reason, created_by, created_at · index (branch_id, ingredient_id, created_at)

**productions** — id, tenant_id, branch_id, recipe_id, batches, output_qty, created_by, created_at

**wastage_entries** — id, tenant_id, branch_id, ingredient_id *(or item_id)*, qty, unit_code, reason, note, created_by

**stock_counts** — id, tenant_id, branch_id, business_date, scope (`full|partial`), status (`draft|submitted|approved`), created_by, approved_by

**stock_count_lines** — id, count_id, ingredient_id, system_qty, counted_qty, variance_qty, variance_value_paisa

## 10. Purchasing

**suppliers** — id, tenant_id, name, contact_person, phone, address, ntn, payment_terms_days, opening_balance_paisa, active, deleted_at

**purchase_orders** — id, tenant_id, branch_id, supplier_id, number, status, expected_date, notes, total_paisa, created_by

**purchase_order_lines** — id, po_id, ingredient_id, purchase_unit_id, qty, unit_price_paisa

**grns** — id, tenant_id, branch_id, supplier_id, po_id *(nullable)*, number, supplier_invoice_no, invoice_date, total_paisa, attachment_id, status (`posted|cancelled`), received_by, created_at

**grn_lines** — id, grn_id, ingredient_id, purchase_unit_id, qty_received, qty_rejected, reject_reason, unit_price_paisa, line_total_paisa

**supplier_payments** — id, tenant_id, supplier_id, branch_id, amount_paisa, method, reference, paid_at, created_by

**supplier_payment_allocations** — payment_id, grn_id, amount_paisa

**supplier_returns** — id, tenant_id, branch_id, supplier_id, grn_id, lines (json), total_paisa, reason, created_by

## 11. Finance

**expense_categories** — id, tenant_id, name, active

**expenses** — id, tenant_id, branch_id, category_id, amount_paisa, method, paid_at, business_date, note, attachment_id, source (`manual|pos_payout|payroll`), source_id, created_by

## 12. Staff

**employees** — id, tenant_id, branch_id, name, cnic, phone, designation, joining_date, salary_type (`monthly|daily`), salary_paisa, active, deleted_at

**attendance** — id, tenant_id, branch_id, employee_id, business_date, clock_in, clock_out, source (`pos|manual`), edited_by, note

**employee_advances** — id, tenant_id, employee_id, amount_paisa, date, note, recovered_in_payroll_id *(nullable)*

**payroll_runs** — id, tenant_id, branch_id, month (YYYY-MM), status (`draft|finalized|paid`), created_by

**payroll_lines** — id, run_id, employee_id, days_present, days_absent, base_paisa, advances_deducted_paisa, other_deductions_paisa, additions_paisa, net_paisa, paid_at

## 13. Printing & notifications

**printers** — id, tenant_id, branch_id, name, connection (`network|usb|windows`), address, paper_width_mm (58|80), role (`receipt|kot`), station_id *(nullable)*, active

**print_jobs** — id, tenant_id, branch_id, printer_id, type, payload (json), status (`queued|sent|printed|failed`), attempts, error, created_at (for cloud-originated jobs: online/QR KOTs)

**notifications** — id, tenant_id, branch_id *(nullable)*, user_id *(nullable)*, type, title, body, data (json), read_at, created_at

**outbound_messages** — id, tenant_id, channel (`sms|whatsapp`), to, template, vars (json), status, provider_ref, error, created_at

## 14. Key relationships (summary)

```
tenants 1─* branches 1─* devices
tenants 1─1 tenant_branding
menu_items 1─* item_variants; menu_items *─* modifier_groups
recipes → (item | variant | modifier | prepared ingredient) 1─* recipe_lines → ingredients
orders 1─* order_lines; orders 1─* payments; orders 1─* kots
order events → stock_movements (server-side) → stock_levels (cache)
grns 1─* grn_lines → stock_movements (purchase) → avg cost update
customers 1─* customer_addresses; customers 1─* orders
shifts 1─* payments, cash_movements
```

## 15. Seed data (Milestone 0+)
Demo tenant "Demo Biryani House", slug `demo`, branches "Gulberg" (`GLB`) and "DHA" (`DHA`), full menu with variants/modifiers/deals, ~40 ingredients with recipes and sub-recipes, 5 suppliers, users per role (PIN `1234`), 2 table areas × 8 tables, Lahore delivery zones, sample branding, 30 days of historical orders for reports.
