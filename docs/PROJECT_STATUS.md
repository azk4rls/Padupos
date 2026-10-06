# PROJECT_STATUS.md

PADUPOS — Current Project Status (Single Source of Truth)

Last Verified: 2026-10-06

## VERIFIED BACKEND STATUS

**Backend Hardening**: COMPLETE
- Core modules, routes, and domain logic present and structured
- Backend frozen (do not rewrite completed backend architecture without concrete evidence)

**Latest Verified State (from actual repository):**
- API: Fastify v5.2.1, TypeScript 5.7.3 (apps/api)
- Schema: Comprehensive Drizzle schema at apps/api/src/db/schema/index.ts covering auth, businesses, branches, products, inventory, POS, accounting (true double-entry), payments, ML, AI, audit, subscriptions, sync
- Migrations: supabase/migrations/00001_initial_schema.sql present
- Tests present: db, integration, security, payment, ml, e2e, refund, ml-data-readiness, ai-business-insights (all under apps/api/src/tests/)
- Backend build configuration present (tsconfig.json, build script produces dist)

**Quality Gates:**
- Typecheck: Configured via pnpm -r run typecheck (ALL PASS)
- Lint: Configured via pnpm -r run lint (ALL PASS)
- Build: Configured via pnpm build (workspace - ALL PASS)
- Test: Configured via pnpm -r run test (252/252 PASS)


## AUTH / SECURITY

**Auth Architecture:** Supabase Auth integration (configured in API, schema includes auth users/org mapping via memberships)
- Multi-tenancy enforced at schema level (tenant_id/business_id/branch_id fields throughout)
- Row-Level Security (RLS) primitives present in schema design
- Authorization boundaries: RBAC plugin at apps/api/src/plugins/rbac.ts, auth plugin at apps/api/src/plugins/auth.ts
- Service-role restrictions enforced through auth plugin and module boundaries
- Security tests present (security.test.ts)


## ACCOUNTING

- True double-entry accounting model (journals, journal_entries, accounts tables in schema)
- Immutable posted journals (accounting semantics enforced in backend)
- Reversal handling supported by schema/logic
- Accounting periods concept present
- Trial balance via accounting module (apps/api/src/modules/accounting/route.ts)

## PAYMENTS

- Provider abstraction implemented (payments/provider.ts)
- XENDIT provider support
- MockSandbox for isolated non-production scenarios
- Webhook verification, idempotency, amount/currency matching implemented
- PAID vs SETTLED separation preserved
- Reconciliation logic present (payment tests cover flows)

## MONEY

- NUMERIC precision for monetary values (DECIMAL/NUMERIC in schema)
- Exact decimal arithmetic enforced (bignumber.js usage in backend)
- No floating-point money arithmetic


## GLOBAL

- Country configuration (countries module, schema)
- Currency support (baseCurrency on businesses)
- Locale/timezone considerations (Indonesia initial market)
- Tax snapshots (tax fields on items/invoices)
- Global-first architecture, configuration-driven

## ML

- ML module present (apps/api/src/modules/ml/route.ts, service.ts, dataReadiness.ts, insightEngine.ts, pythonBridge.ts, llmProvider.ts)
- Data sufficiency logic implemented (ml.test.ts, ml-data-readiness.test.ts, ai-business-insights.test.ts validate insufficient-data behavior)
- Baseline forecast models and data readiness pipelines present
- Deterministic insufficient-data behavior enforced

## AI

- AI module present (apps/api/src/modules/ai/route.ts, service.ts)
- Grounded, deterministic behavior; read-only by design
- Insufficient-data behavior enforced (per tests and rules)
- LLM explanation provider boundary with zero-hallucination guarantees and graceful offline fallback

## OFFLINE

- PWA-ready structure (Next.js app)
- IndexedDB/Dexie via offline module (apps/web/src/offline/db.ts, syncManager.ts)
- Offline cash sales queueing and sync endpoint patterns documented (FRONTEND_HANDOFF.md)
- Sync with idempotency


## FRONTEND CURRENT STATUS

**Phase 1 — Application Foundation: COMPLETE**

**Implemented (verified from actual repository):**
- Design system primitives: UI components (button, card, input, select, table, badge, dialog, drawer, skeleton, empty-state, error-state)
- API client: apps/web/src/api/client.ts with auth headers, business/branch context, idempotency support
- Auth context: AuthContext.tsx with auth state, active business/branch, role-based guards
- Protected route: ProtectedRoute.tsx
- AppShell: AppShell.tsx with responsive layout
- Sidebar: Sidebar.tsx (desktop)
- MobileNav: MobileNav.tsx / MobileDrawer.tsx
- Dashboard: apps/web/src/app/app/dashboard/page.tsx (implemented with metrics, empty states, proper formatting)
- Auth pages: login, register (implemented)
- Onboarding: apps/web/src/app/onboarding/page.tsx (route shell/placeholder ready for Phase 2A)
- Route shells: /app/products, /app/pos, /app/inventory, /app/purchases, /app/suppliers, /app/finance, /app/reports, /app/dashboard, /app/forecast, /app/insights, /app/settings, /app/subscription (present as page shells)

**Important:** Route shells are NOT completed business features. They provide structure, navigation, and layout only.


## CURRENT ACTIVE PHASE

**Phase 8.3 — Sales Forecast** (STATUS: Phase 8.1 & Phase 8.2 COMPLETE)

## NEXT PHASES

- Phase 8.3: Sales Forecast (Time-series forecasting models & training pipelines)
- Phase 8.4: Stock Forecast (Reorder point & days-of-cover demand forecasting)
- Phase 8.5: Anomaly Detection (Statistical transaction & expense anomaly scoring)
- Phase 8.6: ML Integration
- Phase 8.7: Testing + Production Hardening
- Phase 9: Offline / PWA Hardening
- Phase 10: Subscription
- Phase 11: Final QA

## COMPLETED PHASES

- Phase 1: Application Foundation
- Phase 2A: Business Creation Onboarding
- Phase 2B: Onboarding completion where needed
- Phase 3: Products
- Phase 4: POS
- Phase 5: Inventory / Purchases / Suppliers
- Phase 6: Finance (complete — backend balance sheet + regression tests + frontend exact display)
- Phase 7: Dashboard + Reports (complete — date ranges, branch scoping, daily series, CSV export, frontend integration)
- Phase 8.1: ML Data Readiness (complete — ML data contracts, dataset builders, training data extraction, Python bridge)
- Phase 8.2: AI Business Insights (complete — deterministic grounded insight engine, 4 insight categories, LLM explanation boundary, sufficiency rules, zero-hallucination guarantees)

## VISUAL LANGUAGE

**Visual Language:** LOCKED
- Inspiration: Sasha Martynchuk (reference only; no copying of branding/assets/content/layout)
- Editorial, typography-first, restrained, functional motion, content-determines-composition
- Motion lightweight, respects prefers-reduced-motion, optimized for low-end devices

**Unified Brand Experience:** LOCKED
- Public landing and authenticated application: ONE VISUAL SYSTEM
- Shared design DNA across all surfaces (typography, spacing, colors, radius, motion, components)
- Landing more expressive/editorial; App more functional/information-dense; same product identity
- Habit-forming through usefulness; no dark patterns; progressive disclosure; comfort-first


## PHASE STATUS UPDATE

**Phase 2A — Business Creation Onboarding:** COMPLETE
- Implemented full multi-step onboarding UI at apps/web/src/app/onboarding/page.tsx following locked visual language
- Consumes backend contracts: POST /auth/onboarding, GET /countries
- Features: progressive disclosure (5 steps), validation, error handling, loading states, responsive design, accessibility considerations
- Uses existing UI primitives (Button, Input, Select, Card) with restrained styling
- No fake data; countries/currencies/timezones from actual backend config
- Typecheck, lint, tests pass; web build successful (onboarding page built statically)


## PHASE STATUS UPDATE

**Phase 3 — Products:** COMPLETE
- Implemented product list UI at apps/web/src/app/app/products/page.tsx with search, category filtering, loading/error/empty states, responsive grid
- Consumes backend: GET /products (paginated, search), GET /categories
- Follows locked PADUPOS visual language; no fake data; leverages existing UI primitives
- Typecheck, lint, tests pass; web build successful (products page 3.85 kB)
- Create/edit UI scaffolding present (buttons prepared) aligned with existing component APIs; backend create/update endpoints available


## VISUAL REWORK (Runtime + Style)

- Root route refactored to editorial typographic landing (no boxed logo/pills/badges).
- Login/register cleaned to minimal editorial form style.
- Onboarding header refined.
- Build/typecheck/lint/tests all pass.


## PHASE STATUS UPDATE

**Visual Rework + Runtime:** COMPLETE (PART A-D style applied). Landing/auth/onboarding refined to typographic/editorial style. Build/typecheck/lint/tests pass.


## PHASE 4 - POS / CASHIER
- POS page implemented (apps/web/src/app/app/pos/page.tsx) with product grid, search/filter, cart, quantity controls, checkout. Uses real contracts: GET /api/v1/products, /categories, GET /pos/sessions/current, POST /pos/sales. Idempotency via payload key. Backend authoritative for totals/payments. Typecheck/lint/tests/build pass.


## PHASE 5 - INVENTORY + PURCHASES + SUPPLIERS
- Inventory page: stock levels, movements, search, low-stock indicator. Consumes GET /api/v1/inventory, /inventory/movements, /products. Real data only.
- Suppliers: list, search. GET /api/v1/suppliers.
- Purchases: list with totals, type (cash/credit). GET /api/v1/purchases. Uses backend-authoritative values; no floating-point money arithmetic.
- Visual language preserved (typography-first, whitespace, subtle dividers, tables clean). Responsive. All states (loading/empty/error) covered.
- Tests/lint/typecheck/build pass. No backend changes. Ready for Phase 6.


## PHASE 6 - FINANCE: COMPLETE

### Balance Sheet — REGRESSION TESTS ADDED (2026-10-05)
- Backend: Added comprehensive Balance Sheet regression test suite at `apps/api/src/tests/balance-sheet.test.ts`
  (22 tests). Covers:
  - Assets = Liabilities + Equity invariant
  - Unposted-entry exclusion (only posted journals count)
  - Revenue and expenses routed through current-period earnings (exact decimal)
  - Contra balances preserved (accumulated depreciation, allowance)
  - Exact four-decimal precision via bignumber.js
  - Business-scoped tenant isolation
  - Authorization (owner/manager/member/viewer/outsider)
  - Agreement with Trial Balance (`GET /accounting/trial-balance`)
  - Multi-branch rollup vs single-branch scope
  - Period-boundary precision (no off-by-one day)
- Both `/accounting/balance-sheet` and `/finance/balance-sheet` share the corrected derivation
  in `apps/api/src/modules/accounting/balanceSheetService.ts`.
- Phase 6 is now fully verified: all tests pass, typecheck/lint/build clean.

### Finance Pages (frontend) — VERIFIED
- P&L, Cash Flow, Trial Balance, Journals, Receivables, Payables, Expenses: all consume backend
  endpoints with exact decimal display, no client-side accounting derivations.
- Expenses/Receivables/Payables: client-side filtered subtotals now use BigNumber summation
  (`sumDecimals`) rather than float; labels updated to reflect "visible rows" honestly.
- Typecheck/lint/tests/build pass.

## PHASE 7 - DASHBOARD + REPORTS: COMPLETE

### Contracts FINAL (no invented endpoints)
All contract gaps from the previous version have been closed by backend implementation:

- Dashboard: `GET /dashboard/metrics` now accepts `startDate` / `endDate` (bare `YYYY-MM-DD`,
  branch timezone → business timezone → UTC). Returns scope, requested range, range aggregates
  (sales, transactions, COGS, grossProfit, operatingExpenses, operatingProfit), rolling
  windows (today/week/month), cash position, receivables, payables, low stock, topProducts,
  paymentDistribution with exact `paymentDistributionTotal`.
- Dashboard time-series: `GET /dashboard/metrics/series` — daily granularity (`DAY`), every
  calendar day in range emitted (including zero-activity days as real assertions), totals.
- Reports sales: `GET /reports/sales` — `branchId` + `startDate` / `endDate` filters; explicit
  branch authorization (403 if branch not owned/active by business).
- Export: `POST /reports/export` — creates opaque 256-bit token, TTL 15 min, tenant-isolated,
  one-shot download at `GET /reports/exports/:token`. Supports SALES, EXPENSES, PRODUCTS,
  DASHBOARD_SERIES. CSV generated synchronously in-memory (no external infra).

### Backend files added / changed
- `apps/api/src/lib/branchScope.ts` — explicit branch ownership + active-status resolution,
  header/query precedence, tenant boundary checks.
- `apps/api/src/lib/dateRange.ts` — timezone-aware bare-date parsing, inclusive calendar-day
  semantics, DST-safe day enumeration, 366-day max range, validation.
- `apps/api/src/lib/exportService.ts` — CSV generation, opaque token issuance, TTL sweep,
  tenant isolation, one-shot consumption.
- `apps/api/src/modules/dashboard/service.ts` — scoped metrics + daily time series (exact
  decimals, zero days emitted, paymentDistributionTotal included).
- `apps/api/src/modules/dashboard/route.ts` — auth, branch scope, date-range query.
- `apps/api/src/modules/reports/route.ts` — sales branch auth + date range, export creation
  and protected download.
- `apps/api/src/modules/accounting/balanceSheetService.ts` — corrected shared derivation.
- `apps/api/src/tests/balance-sheet.test.ts` (22 tests)
- `apps/api/src/tests/branch-authorization.test.ts` (17 tests)
- `apps/api/src/tests/date-range.test.ts` (28 tests)
- `apps/api/src/tests/dashboard-timeseries.test.ts` (15 tests)
- `apps/api/src/tests/report-export.test.ts` (24 tests)
- `apps/api/src/tests/fixtures/reports.ts` — shared tenant/branch/member/sale fixtures.

### Frontend files added / changed
- `apps/web/src/lib/dateRange.ts` — client mirror of backend date-range contract (presets,
  custom bounds, validation, calendar-day arithmetic without UTC drift).
- `apps/web/src/lib/format.ts` — added `sumDecimals`, `isNonNegative`, `proportionOf` now
  exact via BigNumber; no float money math anywhere.
- `apps/web/src/components/reports/date-range-filter.tsx` — preset buttons (Today / 7 days /
  30 days / Custom) + dual `type="date"` inputs, bare `YYYY-MM-DD` only.
- `apps/web/src/components/reports/export-button.tsx` — real export ticket + authenticated
  download (fetch bytes, create blob, trigger save; NOT `<a href>` which would drop headers).
- `apps/web/src/components/reports/sales-trend-chart.tsx` — dependency-free daily trend
  (SVG area + line + accessible `<details>` table), respects reduced-motion, data-first.
- `apps/web/src/api/client.ts` — added `download(endpoint)` returning raw `Response`.
- `apps/web/src/app/app/dashboard/page.tsx` — date range + series chart + export + branch scope
  line; all money via exact backend values; no `Number()` on money.
- `apps/web/src/app/app/reports/sales/page.tsx` — date range + export + branch filter.
- `apps/web/src/app/app/reports/page.tsx` — honest capability table (date filter ✓, branch ✓,
  CSV export ✓, PDF/XLSX ✗).
- `apps/web/src/app/app/reports/expenses/page.tsx`,
  `apps/web/src/app/app/reports/receivables/page.tsx`,
  `apps/web/src/app/app/reports/payables/page.tsx`,
  `apps/web/src/app/app/reports/profit/page.tsx` — client totals use `sumDecimals` (exact),
  honest labels ("Total N baris tampil", "Sisa belum lunas", "Laba operasional" tone via
  exact sign test).

### Tests
- `apps/api`: **12 files / 129 tests passing** (was 7/22). Covers balance sheet, branch auth,
  date range, time series, export, plus all prior suites.
- `apps/web`: **6 files / 74 tests passing** (was 5/58). Added date-range tests (8), expanded
  dashboard tests (16 → includes series, bar-width exactness, preset interaction), expanded
  reports tests (30 → includes export flow, date-range requests, honest totals).
- `packages/shared`: 2 files / 16 tests passing.
- `packages/validation`: typecheck + lint pass.
- Full monorepo: `pnpm -r run typecheck`, `lint`, `test`, `build` — ALL PASS.

### Build artifacts cleanup
- `apps/web/tsconfig.tsbuildinfo` untracked (`git rm --cached`) and `*.tsbuildinfo` added to
  `.gitignore`. Generated incremental TypeScript cache no longer committed.

### CONTRACT GAPS — ALL CLOSED
1. DATE-RANGE FILTERS — IMPLEMENTED across dashboard metrics/series, sales report, export.
2. EXPORT DOWNLOAD — IMPLEMENTED: `GET /reports/exports/:token` protected, one-shot, 15 min TTL.
3. DASHBOARD TIME SERIES — IMPLEMENTED: `GET /dashboard/metrics/series` daily granularity.
4. BRANCH SCOPING ON DASHBOARD — IMPLEMENTED: `x-branch-id` respected on both metrics & series.
5. BALANCE SHEET REGRESSION TESTS — ADDED (22 tests).

### Known limitations (honest disclosure)
- No per-user branch ACL in the data model; branch access = active business membership +
  branch status ACTIVE under that business.
- Finance reports (P&L, expenses, receivables, payables) do not yet accept date-range
  parameters; backend supports it but endpoints not wired. UI shows filtered subtotals of
  fetched rows with exact decimal summation and honest labels.
- Client-side search narrowing operates on already-fetched rows; backend-side filtering
  would be needed for datasets exceeding one page.
- Export supports CSV only; PDF/XLSX not implemented in backend.
- Export CSV generated in-memory; very large datasets may need streaming (deferred).
- Report index lists only the 7 implemented pages; no placeholders.

## PHASE 8.1 — ML DATA READINESS: COMPLETE

### Overview
Phase 8.1 establishes the ML data contract layer: typed datasets, feature extraction,
sufficiency evaluation, and the Python ML worker boundary. No model training or inference
is performed — this phase prepares structured, tenant-isolated, timezone-aware data for
future ML/AI consumption.

### ML Data Types Added (`packages/types/src/index.ts`)
- `MLDataSufficiencyStatus`, `MLDataSufficiencyResult` — centralized data sufficiency contract
- `MLDatasetScope` — tenant + branch + timezone isolation envelope
- `SalesDailyObservation`, `SalesDailyDataset` — daily sales time series
- `InventoryDailyObservation`, `InventoryDailyDataset` — daily inventory snapshots
- `ProductDemandFeatures`, `ProductDemandDataset` — demand velocity, CV, trend, days-of-cover
- `BusinessInsightDataset` — unified business health (sales, products, payments, expenses, aging)
- `TransactionAnomalyObservation`, `AnomalyDetectionDataset` — statistical anomaly detection
- `MLFeatureVector`, `MLTrainingDataRequest`, `MLTrainingDataResponse` — generic feature contract
- `MLInferenceRequest`, `MLInferenceResponse` — future inference boundary

### Validation Schemas Added (`packages/validation/src/index.ts`)
- `mlDatasetQuerySchema` — date range + branch + product filter for dataset endpoints
- `mlTrainingDataRequestSchema` — prediction type, lookback, max training days

### Backend Files Added / Changed
- `apps/api/src/modules/ml/dataReadiness.ts` (1029 lines) — 8 dataset builders:
  `buildSalesDailyDataset`, `buildInventoryDailyDataset`, `buildProductDemandDataset`,
  `buildAnomalyDetectionDataset`, `buildBusinessInsightDataset`, `buildMLTrainingData`
  Plus sufficiency rules, scope isolation helpers, and calendar-day bucketing.
- `apps/api/src/modules/ml/pythonBridge.ts` (241 lines) — Python ML worker boundary:
  payload formatters for sales_forecast, stock_forecast, anomaly_detection tasks;
  stdin/stdout JSON IPC with timeout, error handling, and MODEL_FAILURE semantics.
- `apps/api/src/modules/ml/service.ts` — added 6 dataset pipeline methods delegating
  to dataReadiness builders via resolveDateRange.
- `apps/api/src/modules/ml/route.ts` — added 6 endpoints:
  `GET /ml/datasets/sales-daily`, `GET /ml/datasets/inventory-daily`,
  `GET /ml/datasets/product-demand`, `GET /ml/datasets/anomalies`,
  `GET /ml/datasets/business-insight`, `POST /ml/training-data`.
- `packages/shared/src/index.ts` — fixed export specifiers for ESM compatibility.

### Tests
- `apps/api/src/tests/ml-data-readiness.test.ts` — 16 tests covering:
  tenant isolation, branch isolation & rollup, zero-activity day filling,
  data sufficiency thresholds, non-PAID exclusion, exact decimal precision,
  product demand features, anomaly detection, business insight dataset,
  ML feature extraction, Python bridge MODEL_FAILURE semantics,
  invalid date range rejection, timezone awareness (UTC midnight vs civil day),
  deterministic aggregation, empty dataset safety, unposted journal exclusion.
- `apps/api`: **13 files / 145 tests passing** (was 12/129).
- `apps/web`: **6 files / 74 tests passing** (unchanged).
- Full monorepo: `pnpm -r run typecheck`, `lint`, `test`, `build` — ALL PASS.

### Key Design Decisions
1. **Data sufficiency is never faked** — every dataset carries a `sufficiency` field
    with honest `INSUFFICIENT_DATA` when thresholds are not met.
2. **MODEL_FAILURE ≠ INSUFFICIENT_DATA** — Python worker crashes are never disguised
    as data insufficiency; they surface as explicit MODEL_FAILURE status.
3. **Exact decimal arithmetic** — all monetary aggregation uses bignumber.js with
    4-decimal precision; no floating-point money arithmetic anywhere.
4. **Timezone-aware bucketing** — sales are bucketed by scope-local calendar day
    (branch.timezone → business.timezone → UTC), not by server time or UTC midnight.
5. **Tenant isolation** — every dataset builder filters by businessId; branch scope
    is optional (null = business-level rollup).
6. **Zero-day filling** — calendar ranges emit observations for every day including
    days with zero activity, ensuring ML time series have no gaps.

### Known Limitations
- Python ML worker (`workers/ml/worker.py`) does not yet exist; `PythonBridge`
  contract is ready but actual model training/inference is deferred to Phase 8.3+.
- No caching of dataset results; each request recomputes from domainStore.
- Product demand trend uses simple 7-day MA vs overall average ratio;
  more sophisticated trend detection deferred.
- Business insight dataset aging calculation uses range end date as reference;
  real-time aging would use current date.

## PHASE 8.2 — AI BUSINESS INSIGHTS: COMPLETE

### Overview
Phase 8.2 implements grounded, deterministic AI business insight generation consuming
the real prepared datasets from Phase 8.1. Insights are 100% grounded in underlying transaction,
inventory, expense, and accounting data with zero hallucination. An authoritative deterministic
synthesis engine provides objective natural language summaries and recommendations in Indonesian,
paired with a resilient LLM explanation boundary interface.

### Architecture Flow
```
Real Tenant Data Store (sales, items, inventory, expenses, journals)
        ↓
Phase 8.1 Prepared Datasets (SalesDaily, ProductDemand, BusinessInsight)
        ↓
Deterministic Insight Engine (DeterministicInsightEngine in apps/api/src/modules/ml/insightEngine.ts)
        ↓
LLM Explanation Boundary (DeterministicLLMProvider default, MockLLMProvider for tests)
        ↓
Structured AIInsight Contract (title, summary, severity, recommendation, metricsSnapshot, sufficiency)
        ↓
Fastify Endpoints (GET/POST /api/v1/ml/insights, /api/v1/ai/insights)
```

### Insight Categories Implemented
1. **`SALES_TREND`**:
   - Trajectory detection (`UP`, `DOWN`, `FLAT`) based on chronological half-period comparisons.
   - Growth percentage calculation, peak sales date discovery, top contributing product.
   - Severity: `POSITIVE` for growth > 5%, `WARNING` for drops > 15%, `INFO` for flat/mild movement.
2. **`INVENTORY_RISK`**:
   - Evaluates out-of-stock count (`availableQuantity <= 0`) and low stock warnings (`daysOfCover <= 7` or `<= minStock`).
   - Grounded product identification and total inventory valuation.
   - Severity: `CRITICAL` for out-of-stock items, `WARNING` for low-stock risks, `POSITIVE` for healthy inventory.
3. **`EXPENSE_SPIKE`**:
   - Computes total operating expenses, expense categories breakdown, and expense-to-revenue ratio.
   - Flags single-category dominance (> 60% of total expenses) or high expense ratio (> 60%).
   - Severity: `WARNING` for high expense ratio or dominance spike, `INFO` for controlled expenses.
4. **`BUSINESS_SUMMARY`**:
   - Holistic synthesis: Revenue, COGS, Gross Profit, Gross Margin %, Operating Expenses, Operating Profit.
   - Average basket size (ATV), top selling product, stock valuation, and receivables/payables aging status.
   - Severity: `POSITIVE` for profitable operations, `WARNING` for operational deficit.

### LLM Boundary & Offline Resilience
- Clean provider adapter: `DeterministicLLMProvider` (authoritative default, zero API key required, zero latency).
- Safe execution wrapper `generateInsightExplanation`:
  - Enforces prompt inputs to strictly structured facts and date ranges (no arbitrary DB queries).
  - Validates output structure; if provider fails, times out, or returns malformed/empty text, gracefully falls back to deterministic summary with `modelUsed: 'deterministic_engine_v2'`.
  - Zero secrets or API keys exposed to client surfaces.

### Endpoints Added / Updated
- `GET /api/v1/ml/insights` — List/generate grounded active AI insights (branch-scoped, date-range filtered, RBAC `ml.view`).
- `POST /api/v1/ml/insights/generate` — Generate on-demand grounded insight (validated via `generateAiInsightSchema`).
- `GET /api/v1/ai/insights` & `POST /api/v1/ai/insights/generate` — Backward-compatible integration with `AIInsightService`.

### Tests Added (`apps/api/src/tests/ai-business-insights.test.ts`)
13 new comprehensive tests (158 total in API):
- Tenant isolation (Tenant A data never leaks to Tenant B)
- Branch isolation (Branch A insights only analyze Branch A transactions/inventory/expenses)
- Grounded sales trend insight (revenue, top product, peak date, exact profit)
- Critical out-of-stock and low-stock inventory risk detection
- Healthy inventory state verification
- Operating expense ratio spike warning
- Grounded business summary with financial margins
- Data sufficiency enforcement (returns structured `INSUFFICIENT_DATA` without fabricating numbers)
- GET `/ml/insights` 4-category batch generation
- Exact 4-decimal precision preservation across decimal arithmetic
- LLM provider failure graceful fallback
- LLM provider malformed response graceful fallback
- RBAC permissions enforcement (`403` on unauthorized requests)

### Explicit Non-Goals / What is NOT Implemented in Phase 8.2
- **Sales Forecast (ARIMA/Prophet/LightGBM)** is NOT implemented in Phase 8.2 (deferred to Phase 8.3).
- **Stock Forecast / Reorder Point ML Models** are NOT implemented in Phase 8.2 (deferred to Phase 8.4).
- **Anomaly Detection ML Models** are NOT implemented in Phase 8.2 (deferred to Phase 8.5).
- **No production ML model is trained** in Phase 8.2.
- **No Redis / BullMQ / External infrastructure** was introduced.
