# Product Requirements — Restaurant ERP, Phase 1

## 1. Product summary

A cloud-based restaurant system, sold as a monthly subscription, that gives restaurant owners:

- Fast billing and kitchen orders that keep working without internet
- Control over cash, voids and discounts
- Recipe-based stock tracking that shows where stock is lost
- Their own QR table menu and online ordering page (no aggregator commission)
- Owner reports on the phone
- Their own branding on the storefront, receipts and POS

**Target customers:** single-outlet to 3-branch restaurants, cafés, fast food, BBQ/desi restaurants in Pakistan.

**Defaults:** currency PKR, timezone Asia/Karachi, language English (customer menu supports an optional Urdu name per item).

## 2. Tenancy and structure

- **Platform** (us) → **Tenant** (a restaurant business) → **Branch** (an outlet) → **Device** (a POS terminal, KDS screen).
- Menu, recipes, suppliers, customers, branding are tenant-level. Prices, availability, tables, stock, shifts, cash are branch-level (a branch may override item price and availability).
- Each tenant has a **storefront slug**: `slug.ourdomain.pk`. Custom domain support is a stored field in Phase 1 (connect manually via Caddy); self-service custom domain is Phase 2.
- **Platform admin** (super admin) panel: create tenants, set plan/limits, suspend tenant, impersonate for support (logged).

## 3. Users, roles and permissions

### Roles (default, tenant can create custom roles)

| Role | Typical use |
|---|---|
| Owner | Everything, all branches |
| Manager | Branch operations, approvals, reports for their branch |
| Cashier | Billing, payments, own shift |
| Waiter | Take orders on tablet/phone, cannot take payment by default |
| Kitchen | KDS only |
| Storekeeper | Inventory, purchasing, receiving |
| Accountant | Expenses, supplier payments, financial reports |

### Login

- Back office: email/phone + password.
- POS/KDS: device is registered once by a manager; staff then log in with a **4–6 digit PIN** on that device. Auto-lock after configurable idle time.
- **Manager override**: a restricted action prompts for a manager PIN at that moment; the approver is recorded.

### Key permissions (full list in `packages/shared/permissions.ts`)

`pos.order.create`, `pos.order.edit_after_kot`, `pos.order.void`, `pos.order.reopen`, `pos.discount.apply` (with max % per role), `pos.payment.take`, `pos.refund`, `pos.shift.open_close`, `pos.cash.drop`, `pos.price.override`, `kds.view`, `menu.manage`, `inventory.view`, `inventory.adjust`, `inventory.count`, `purchase.create`, `purchase.approve`, `purchase.receive`, `supplier.pay`, `expense.manage`, `reports.sales`, `reports.cost` (see cost prices/profit), `reports.financial`, `staff.manage`, `settings.manage`, `branding.manage`, `online.manage`, `customers.view`, `audit.view`.

**Acceptance:** a cashier without `pos.order.void` is asked for a manager PIN when voiding; the void is saved with both user IDs and a reason; the server rejects a void request without valid approval.

## 4. Business day

- Each branch has a **day cutoff time** (default 04:00). Sales between 00:00 and 03:59 belong to the previous business day.
- **Day close** (manager): requires all shifts closed and no open orders (or open orders carried forward with a warning). Generates the Z-report and locks the business day. A locked day cannot be edited, only corrected via new records in the open day (refund/adjustment).

## 5. POS

### 5.1 Order types
Dine-in, Takeaway, Delivery (phone order), plus orders arriving from QR and Online (see §8, §9). Each order records its **channel**: `pos`, `qr`, `online`.

### 5.2 Order lifecycle
`draft → sent (KOT printed) → preparing → ready → served/dispatched → billed → paid → closed`
Side states: `voided`, `refunded` (full/partial).

### 5.3 Features
- Item grid by category, search, quick-items bar, barcode not required.
- Modifiers: groups with min/max selections (e.g. "Choose spice level: 1 required"), each modifier with optional price and optional recipe impact.
- Deals/combos: fixed-price bundle with choice groups (e.g. "Any 2 pizzas + 1.5L drink").
- Item notes ("no onions") printed on KOT.
- Seat/guest count for dine-in.
- Hold order, recall order.
- **Send to kitchen** creates a KOT for new/changed lines only.
- Edit after KOT: needs `pos.order.edit_after_kot` or manager PIN; produces a **cancel KOT** to the kitchen with "CANCELLED" clearly printed.
- Table actions: transfer table, merge tables, transfer item between tables.
- Waiter assignment per order.
- Delivery (phone) order: customer phone lookup → saved addresses → delivery zone → delivery charge.
- **Bill print** (pre-payment check) and **final receipt** (after payment).
- Reprint receipt/KOT marked "REPRINT / DUPLICATE".

### 5.4 Pricing rules (implemented once in `packages/shared/pricing`)
Calculation order:
1. Line amount = (item price + modifier prices) × qty
2. Line discounts
3. Subtotal = sum of lines after line discounts
4. Bill discount (fixed or %) applied to subtotal
5. Service charge (% of discounted subtotal; configurable per order type; on/off)
6. Delivery charge (delivery orders)
7. Tax: rate configurable per branch, **per order type and per payment method** (provincial rates can differ for card vs cash — rates are settings, never hardcoded). Setting: whether prices are tax-inclusive or tax-exclusive; whether service charge is taxable.
8. Rounding: final total rounded per branch setting (none / nearest 1 / nearest 5 / nearest 10 PKR); rounding difference stored on the order.

All amounts integer paisa; rounding of % calculations uses half-up at each line and the engine documents where rounding happens. 100% unit-test coverage on this module.

### 5.5 Discounts
- Types: % or fixed, line or bill level, predefined (e.g. "Staff 20%", "Owner friend") or open amount.
- Max discount % per role; above that needs manager PIN.
- Reason required for open discounts.
- Complimentary (100% off) items/orders are a separate type `comp`, reported separately.

### 5.6 Payments
- Methods (configurable): Cash, Card, Bank transfer, JazzCash, Easypaisa, Credit (on account, for known customers), Other.
- Split payment across methods; split bill by item, by equal share, by custom amount (creates child bills).
- Cash: amount tendered → change shown.
- Refund: full or partial, by original method, needs `pos.refund`, reason required.

### 5.7 Shifts and cash
- Open shift with opening float.
- Cash drop / cash out (petty payouts) during shift with reason.
- Close shift: **blind count** (cashier enters counted cash before seeing expected), system shows expected vs counted and difference; difference > threshold flagged to owner.
- Shift report printable.

### 5.8 Offline mode
- POS keeps taking orders, printing KOTs (via print agent on LAN) and taking cash payments with no internet.
- Data saved locally (IndexedDB) and synced automatically when online. Clear "Offline — X orders waiting to sync" indicator.
- Not available offline: online/QR orders, OTP, card payment integrations, reports.
- Detail in ARCHITECTURE §5.

**Acceptance:** with network disconnected, a cashier can create 20 orders, print KOTs and receipts, take cash, and after reconnecting all 20 appear in reports with correct stock deduction and no duplicates.

## 6. Kitchen (KOT / KDS)

- Kitchen stations (e.g. Main, BBQ/Tandoor, Bar, Desserts). Each menu item maps to one station.
- KOT routing: each station gets only its items, on its own printer and/or KDS screen.
- KOT content: order no., table/type, waiter, time, items with modifiers and notes, "NEW / ADDITION / CANCELLED / REPRINT" banner, channel badge (QR/ONLINE).
- **KDS screen**: tickets as cards, oldest first, timer colour (green → amber → red by configurable minutes), tap item/ticket to mark ready, "recall" last bumped ticket, sound on new ticket.
- Status updates from KDS flow back to POS and to the customer's online order status.

## 7. Menu management

- Categories (ordered, with image, visibility per channel).
- Items: name, optional Urdu name, description, image, base price, branch price override, order-type price override (e.g. delivery price), station, tax category, tags/badges (Spicy, New, Bestseller, Veg), visibility per channel (POS / QR / Online), active flag.
- Variants (e.g. Half / Full, Small / Medium / Large) each with own price and own recipe.
- Modifier groups and modifiers (see §5.3).
- Deals/combos (see §5.3).
- **Availability**: per branch "out of stock today" toggle from POS (one tap); auto-hidden on QR/online.
- Time-based availability (e.g. Breakfast menu 08:00–12:00) per category.
- Bulk import from CSV/Excel template.

## 8. QR table menu

- Each table has a unique QR (printable sheet of QR cards generated by the system, with restaurant logo).
- Scanning opens the storefront in **table mode**: branch + table pre-selected.
- Customer can: browse menu with photos, see prices, **call waiter**, **request bill**, and (if enabled) **place an order**.
- **Staff confirmation (default ON):** QR orders appear on POS as "Pending confirmation"; staff accept → becomes normal order with KOT; or reject with reason. Setting can be turned off per branch.
- Additional protection: QR token per table that can be **regenerated**; optional daily rotating code shown on table card; ordering disabled when branch closed or table marked inactive.
- Call waiter / request bill: real-time alert on POS (and waiter devices) with table number, sound, must be acknowledged.
- Customer sees their table's current order status.
- Settings per branch: QR mode = `view_only` | `order_with_confirmation` | `order_direct`.

**Acceptance:** scanning a table QR on a cheap Android phone over slow 3G shows the menu in under 3 seconds; a QR order does not reach the kitchen until accepted when confirmation is ON.

## 9. Online ordering page (own storefront)

- Public URL `slug.ourdomain.pk` (plus optional per-branch path). Shareable link + "Order online" QR for posters.
- Branch selection (if several), or auto by delivery area.
- Order types: Delivery, Pickup (per branch toggles).
- Delivery zones per branch: name/area list (and optional radius from branch location), delivery charge, minimum order, estimated time.
- Cart with modifiers/deals, special instructions.
- Checkout: name, phone, address (saved for returning customers), area, landmark, notes.
- **Phone verification by OTP** (SMS or WhatsApp provider, pluggable). OTP required on first order from a phone number; afterwards the device is remembered (signed token, 90 days). OTP rate limits: max 3 sends per number per 15 min, max 5 attempts per code, code valid 5 minutes.
- Payment in Phase 1: **Cash on delivery / pay at pickup**. (Online payment gateway = Phase 2.)
- **Restaurant accepts or rejects** each online order:
  - New order alert on POS: popup + repeating sound until acknowledged.
  - Accept → choose estimated time (preset buttons: 20/30/45/60 min) → becomes POS order + KOT.
  - Reject → reason (closed, item unavailable, out of area, suspected fake, other) → customer notified.
  - Auto-escalation: no response in N minutes (default 3) → alert manager; after M minutes (default 10) → auto-reject with apology message.
- **Pause online ordering** — one tap on POS: pause for 15 / 30 / 60 min / until reopened. Storefront shows "Not accepting orders right now".
- **Opening hours** per branch per weekday, with multiple slots per day and holiday closures; outside hours storefront shows next opening time and allows browsing only.
- Customer order tracking page: Received → Accepted → Preparing → Ready / Out for delivery → Completed (or Rejected), via link sent after ordering (and by SMS/WhatsApp if provider configured).
- Blocklist: block phone numbers (fake orders).
- Each online order creates/updates the **customer record** (phone, name, addresses, order history).

**Acceptance:** a first-time customer cannot place an order without a verified OTP; a paused branch receives no orders; a rejected order notifies the customer with the reason.

## 10. Inventory

- Ingredients (raw materials): name, category, **stock unit**, **purchase units with conversion** (e.g. bag 50 kg → 50,000 g), **recipe unit**, reorder level, par level, cost (weighted average), storage location, active.
- **Recipes**: per item / variant / modifier: list of ingredients with qty in recipe unit, plus **yield %** on ingredients (e.g. chicken 70%).
- **Sub-recipes (prepared items)**: e.g. "Biryani masala", "Garlic mayo": made in batches from ingredients via a **production entry**; consumed by recipes like an ingredient.
- **Automatic deduction**: when an order is paid (configurable: on KOT or on payment; default on KOT for kitchen accuracy), stock movements are created per branch.
- Voided items after KOT: choose "wasted" (stays deducted, logged as wastage) or "not prepared" (returned to stock).
- Stock movement types: `purchase`, `sale`, `production_in`, `production_out`, `wastage`, `staff_meal`, `comp`, `adjustment`, `count_variance`, `return_to_supplier`, `opening`.
- Wastage entry with reason (expired, spoiled, burnt, dropped, other).
- **Stock count**: full or partial count sheet (by category/location), counted qty entry (mobile-friendly), system computes variance and posts `count_variance` movements on approval.
- **Variance report**: theoretical consumption (sales × recipes) vs actual (opening + purchases + production − closing − recorded wastage) per ingredient, in qty and PKR, for a date range between two counts.
- Low stock alerts (dashboard + daily summary).
- Costing method: **weighted average cost**, recalculated on each purchase receipt.
- Food cost per item = sum(recipe qty / yield × ingredient avg cost); shown with food cost % vs selling price.

**Acceptance:** selling 10 Chicken Biryani reduces rice, chicken, oil, masala (sub-recipe) by the recipe amounts; variance report after a count shows the difference correctly in qty and PKR.

## 11. Purchasing

- Suppliers: name, contact, phone, address, NTN, payment terms (days), opening balance, active.
- Purchase order (optional step): items, qty, unit, expected price → status draft/sent/partially received/received/cancelled. Share PO as PDF/WhatsApp text.
- **Goods received (GRN)**: against a PO or direct; actual qty, unit, price; partial receipt allowed; rejected qty with reason; supplier invoice no. and date; attach photo of bill.
- GRN posts `purchase` stock movements and updates weighted average cost.
- Supplier ledger: GRNs (payable), payments, returns, opening balance → running balance.
- Supplier payment: amount, method, reference, allocate to GRNs (or on account).
- Return to supplier.
- Purchase suggestions: ingredients below reorder level with suggested qty = par − current.

## 12. Basic accounts

Not full double-entry in Phase 1. Simple, accurate operational finance:

- **Expenses**: category (rent, salaries, electricity, gas, internet, repairs, marketing, misc — editable), amount, method, date, branch, note, attachment. Petty cash payouts from POS appear here.
- **Daily cash-up summary**: per business day per branch — sales by method, refunds, cash drops/payouts, expected cash, counted cash, difference.
- **Payables**: supplier balances (from §11).
- **Receivables**: customer credit accounts (credit sales and their payments).
- **Monthly P&L** per branch and combined: Sales (net of discounts, excl. tax) − COGS (from stock consumption at cost) − Expenses = Profit. Tax collected shown separately.
- **Tax report**: taxable sales, tax collected, by rate and payment method, per day/month.
- Export to Excel/CSV for the accountant.
- **Tax authority integration** (PRA / FBR POS): build as a pluggable `FiscalProvider` interface with a "none" provider active by default. When enabled, each paid invoice is reported and the fiscal invoice number/QR is printed on the receipt; offline invoices are queued and reported on sync. Exact API spec to be confirmed from the authority's official integration documents before implementing the real provider.

## 13. Staff

- Employee profiles (can exist without system login): name, CNIC, phone, role, branch, joining date, salary type (monthly/daily), salary amount, active.
- Attendance: clock in/out on POS with PIN (and optional selfie later), manual correction by manager (logged).
- Advances and deductions.
- Monthly salary sheet: base, days present/absent, advances deducted, other deductions/additions, net payable → mark paid (posts to expenses).

## 14. Branding & customization (tenant self-service)

Owners and managers with `branding.manage` customise their restaurant's look without our help. All changes show a **live preview** before saving and can be **reset to default**.

### 14.1 Brand identity
- Restaurant display name, tagline.
- **Logo** (upload PNG/JPG/SVG; auto-generated square and wide versions; separate optional logo for dark backgrounds).
- Favicon / app icon (auto from logo if not uploaded).
- Cover/banner image(s) for storefront (up to 5, slider).
- **Colors**: primary, secondary, accent, background, text. Pick from preset palettes or custom hex/colour picker. System auto-generates hover/light/dark shades and **warns if text contrast is too low** (WCAG AA check) and blocks unreadable combinations on buttons.
- **Font**: choose from a curated list (e.g. Inter, Poppins, Nunito, Playfair Display, Lora, plus an Urdu-capable font such as Noto Nastaliq Urdu for Urdu names).
- Corner style: rounded / slightly rounded / square. Light or dark storefront theme.

### 14.2 Storefront (QR menu + online ordering)
- Layout: grid with photos / list with photos / compact list without photos.
- Category order, featured items section ("Bestsellers"), item badges.
- Show/hide: Urdu names, item descriptions, calories (optional field), "Powered by" footer (hideable only on higher plan).
- About section, address, Google Maps link, phone, WhatsApp number, social links (Instagram, Facebook, TikTok).
- Announcement bar (e.g. "Free delivery above Rs 2,000"), with start/end date.
- Custom messages: order confirmation text, closed message, rejection apology text.
- SEO: page title, description, share image (for WhatsApp/Facebook link previews).

### 14.3 Receipts and KOT
- Receipt header: logo on/off (printed monochrome), name, address, phone, NTN/STRN, custom header lines.
- Receipt footer: custom lines (e.g. "Thank you! Follow us @..."), Wi-Fi password line, return policy.
- Show/hide fields: waiter name, table, customer name, order type, itemised tax, QR code linking to storefront/feedback.
- Paper width: 58 mm / 80 mm. Font size: normal / large (KOT large by default).
- Receipt language labels: English (Urdu labels later).
- **Printed preview** in settings with a "Test print" button.

### 14.4 POS and staff app
- Accent colour and logo in POS header (from brand).
- Item button style: with image / colour tiles / text only; tile colour per category.
- Grid size (number of columns) and quick-items bar contents.
- Order of payment methods; which are enabled.

### 14.5 QR table cards
- Printable A4 sheet of table cards using brand colours, logo, table number, QR, and short instruction text (editable). Download as PDF.

### 14.6 Technical rules
- Branding stored as a versioned JSON (`tenant_branding`) validated by a zod schema.
- Storefront applies branding via CSS variables injected server-side (no flash of default colours).
- Images resized server-side to standard sizes, WebP, served via CDN with cache-busting version.
- Branding changes take effect on the storefront within 1 minute (cache revalidation).

**Acceptance:** an owner uploads a logo, picks two colours and a font, sees the live preview, saves, and the storefront, QR cards, POS header and receipt preview all reflect the change; a light-yellow text on white combination is warned and blocked for buttons.

## 15. Customers

- Customer record keyed by phone number (normalised to +92 format): name, phone, addresses (label, area/zone, full address, landmark), notes, tags, blocked flag.
- Auto-created from POS phone orders and online orders.
- Order history, total spent, visit count, last order date.
- Credit account (optional per customer) with limit.
- Simple loyalty (optional, can be disabled): earn X points per Rs Y, redeem at checkout on POS. (Advanced loyalty = Phase 2.)

## 16. Reports (web + mobile-friendly owner view)

All reports filter by branch(es), business date range, and export to Excel/PDF.

1. **Owner dashboard** (home): today's sales, orders, average bill, by channel, by payment method, open orders, online orders pending, low stock count, cash difference alerts; compare with same day last week.
2. Daily sales summary / **Z-report** (printable).
3. Sales by item, category, variant, modifier (qty, gross, discount, net).
4. Sales by hour and by day of week.
5. Sales by channel (POS / QR / Online) and order type.
6. Sales by waiter / cashier.
7. Payment methods.
8. **Voids, refunds, discounts and comps** by user, with reasons and approvers.
9. Shift reports and cash differences.
10. Online orders: received, accepted, rejected (with reasons), average accept time.
11. Inventory: current stock & value, movements, wastage, **variance**, low stock.
12. Food cost: per item cost, selling price, food cost %, margin.
13. Purchases by supplier / ingredient; supplier balances.
14. Expenses by category.
15. Monthly P&L.
16. Tax report.
17. Customers: top customers, new vs returning.
18. Audit log viewer (filter by user, action, date).

## 17. Notifications

- In-app notification centre (POS and back office).
- Real-time POS alerts: new online order, QR order pending, call waiter, request bill.
- Owner alerts (in-app; WhatsApp/SMS if provider configured): large cash difference, void above threshold, low stock summary (daily), day close summary.

## 18. Non-functional requirements

- **Performance:** POS action response < 200 ms locally; storefront first contentful paint < 2.5 s on slow 4G / < 3 s on 3G; API p95 < 300 ms.
- **Offline:** POS works fully for dine-in/takeaway/phone orders and cash for at least 24 hours offline.
- **Devices:** POS on Windows PC, Android tablet (Chrome), iPad (Safari) as installable PWA; KDS on any browser/TV stick; storefront on any phone.
- **Security:** HTTPS everywhere, bcrypt/argon2 password hashing, PIN hashed, JWT short-lived access + refresh tokens, rate limiting on auth/OTP/public endpoints, tenant isolation tests, audit log, no secrets in client code.
- **Backups:** automated daily PostgreSQL backups retained 30 days, off-server copy; restore procedure documented and tested.
- **Availability:** target 99.5% for cloud; POS unaffected by cloud downtime (offline mode).
- **Localisation:** PKR formatting `Rs 1,250`; dates `31 Oct 2026`; phone `+92 3xx xxxxxxx`.
- **Accessibility:** colour contrast AA on storefront; large touch targets (min 44 px) on POS.

## 19. Out of scope for Phase 1 (Phase 2+)

Online payment gateways (cards/wallets online), Foodpanda/aggregator integration, rider management app and tracking, multi-branch stock transfers and central kitchen production across branches, advanced loyalty/gift cards/vouchers, marketing campaigns, reservations and waitlist, biometric attendance, rostering, tip pooling, menu engineering, auto purchase approval workflows, full double-entry accounting, franchise management, custom domain self-service, native mobile apps, public API.
