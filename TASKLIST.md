# RecycList Change Task List

Purpose: Persistent implementation list to continue across chat/session limits.

## Phase 0 - PDF Update (2026-03-23)
- [x] Inventory: make status strictly stock-based in exports/UI and remove Created At from export output
- [x] Inventory: improve mobile action button layout and restore `(pcs)` wording on stock/count labels
- [x] Coupon Records: auto-refresh balance/history on waste insert without manual page refresh
- [x] Coupon Records: remove redundant search UI noted in the PDF
- [x] Waste Management: fix same-day custom date filtering bug caused by local date -> UTC conversion
- [x] Waste Management: auto-refresh records on live waste inserts and remove redundant refresh/search controls
- [x] Analytics Dashboard: remove redundant header refresh button and rewrite insights/activity wording
- [x] Account/Email: allow profile email updates and keep auth/header state synced after save
- [x] Forgot Password: align destination email fallback and on-screen copy with the requested address
- [x] Run focused regression checks after changes because related screens have been moving together

## Phase 1 - Core Fixes (Do First)
- [ ] Fix notifications tab functionality (open/read/update flow)
- [ ] Add low stock alert notifications for coupons
- [ ] Restore DRY WASTE on dashboard
- [ ] Mobile label: change Profit to Rewards
- [ ] Inventory status rename: Active -> Available
- [ ] Add inventory statuses:
  - [ ] Low on stock (below 20 items)
  - [ ] No stock
- [ ] Status colors:
  - [ ] Available = green
  - [ ] Low stock = orange
  - [ ] No stock = gray
- [ ] Fix Inventory NaN display issues
- [ ] Inventory stock controls:
  - [ ] Replace redundant controls with one control group
  - [ ] Add Add/Subtract buttons

## Phase 2 - Data/Validation/Export
- [ ] Coupon input validation: numbers only (block dash and dot)
- [ ] Coupon consumed display should be integer only (no decimals)
- [ ] Current balance label -> Coupon Balance
- [ ] Coupon Balance display should be integer only (no decimals)
- [ ] Rewards calendar custom range:
  - [ ] Disable future dates
  - [ ] Allow only recent/past dates
- [ ] Rewards export:
  - [ ] Ensure summary per day (1 row/day)
  - [ ] Rename export field Amount -> Count

## Phase 3 - Auth + Dev Tools
- [x] Add Forgot Password flow
- [x] Forgot Password destination email: wasteed277@gmail.com
- [ ] Forgot Password input validation:
  - [x] Exactly 4 digits
  - [x] No dash
  - [x] No dot
- [x] Add Developer Option: Clear Data
- [x] Clear Data scope:
  - [x] Waste records
  - [x] Coupon total consumed
  - [x] Coupon total earned
  - [x] Coupon total transactions

## Phase 4 - UX Cleanup
- [ ] Remove redundant inventory fields:
  - [ ] Total earned
  - [ ] Total transactions
- [ ] Icon consistency pass:
  - [ ] Replace emoji style icons
  - [ ] Use flat, consistent icon set
- [ ] Reduce redundant UI sections
- [ ] Improve wording clarity across labels

## Phase 5 - Performance + Realtime + Batch Scaling
- [ ] Baseline profiling + budgets
  - [ ] Capture p50/p95 API timings for `/api/waste/records`, `/api/bin/records`, `/api/coupon/balance`
  - [ ] Add frontend performance marks for app boot, auth validation, dashboard first paint, dashboard data-ready
  - [ ] Define performance budgets (initial JS, first contentful paint, time-to-data)
- [ ] Frontend load optimization
  - [x] Route-level code splitting for dashboard pages (`AnalyticsDashboard`, `WasteTable`, `CouponRecords`, `ProfitRewards`, `InventoryManagement`, `Settings`)
  - [x] Lazy-load export-heavy libraries (`xlsx`, `jspdf`, `jspdf-autotable`) only when export modal/action is opened
  - [x] Introduce manual chunking in Vite for chart/export/vendor bundles
  - [x] Remove duplicate `/dashboard` route declaration
- [ ] Data fetching optimization
  - [ ] Replace full-history pagination loops on initial dashboard load with summary endpoints (server-side aggregate by day/range)
  - [ ] Keep TanStack Query cache warm with incremental realtime patching instead of full `refetch` on each event
  - [ ] De-duplicate fetch calls triggered by dev-mode StrictMode effects where applicable
- [ ] Backend query optimization
  - [ ] Add DB indexes for common sort/filter columns (`waste_items.date`, `waste_items.recordedAt`, `bin_records.fullAt`, `waste_notifications.createdAt`)
  - [ ] Push search/total filter and aggregation work to SQL/Prisma query layer (avoid large post-query JS filtering)
  - [ ] Add lightweight aggregate endpoints for dashboard cards/charts to avoid transferring raw rows on boot
- [ ] Realtime architecture hardening (resource-intensive safe mode)
  - [ ] Keep SSE for low-latency updates, but throttle/coalesce high-frequency events into 250-1000ms windows client-side
  - [ ] Use event versioning / cursor IDs to avoid duplicate UI updates and redundant refetches
  - [ ] Add reconnect backoff + heartbeat monitoring for stable long-lived SSE connections
- [ ] Batch processing improvements
  - [ ] Move heavy batch jobs (daily rollups, exports, reconciliation) to background workers/queues
  - [ ] Persist precomputed hourly/daily aggregates for dashboard and reporting endpoints
  - [ ] Add idempotent batch job keys and retry policy with dead-letter handling
- [ ] Verification + rollback safety
  - [ ] Add load test script for concurrent realtime events + dashboard users
  - [ ] Track before/after metrics in this task list for each optimization batch
  - [ ] Add feature flags for risky performance changes (aggregate endpoint switch, query strategy)

## Notes
- Keep behavior changes backward-compatible where possible.
- Run client build after each completed feature group.
- If API changes are required, include matching server updates and basic verification.
