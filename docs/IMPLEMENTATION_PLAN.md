# IMPLEMENTATION_PLAN.md

Phased Roadmap

## PHASE 0 — Backend Foundation/Hardening
**STATUS:** COMPLETE / FROZEN
- Core schema, modules, auth/RBAC, accounting, payments, ML/AI, sync infrastructure established
- Tests present; backend is authoritative and frozen

## PHASE 1 — Application Foundation
**STATUS:** COMPLETE
- Frontend shell, layout, auth, API client, design system, dashboard structure
- Route shells established

## PHASE 2A — Business Creation Onboarding
**STATUS:** NEXT (Active)
**Scope:** Implement business creation onboarding flow per API contracts and product requirements
**Non-scope:** Other business features
**Acceptance:** Valid onboarding flow, no fake data, proper error handling, typecheck/lint/tests pass
**Verification:** Integration with backend APIs, validation via Zod, proper state management

## PHASE 2B — Onboarding Completion
**STATUS:** PENDING
Only if actual requirements necessitate completion beyond 2A.

## PHASE 3 — Products
**STATUS:** PENDING
**Scope:** Product catalog CRUD, pricing, variants
**Acceptance:** Backend contracts honored, no fake data

## PHASE 4 — POS
**STATUS:** PENDING
**Scope:** Register shifts, sales, payments, receipts
**Acceptance:** Exact money arithmetic, idempotency, reconciliation

## PHASE 5 — Inventory / Purchases / Suppliers
**STATUS:** PENDING
**Scope:** Stock movements, procurement, vendors
**Acceptance:** Inventory invariants preserved

## PHASE 6 — Finance
**STATUS:** PENDING
**Scope:** Accounting UI, journals, trial balance, reports
**Acceptance:** Read-only respect for posted journals; backend authority

## PHASE 7 — Dashboard / Reports
**STATUS:** PENDING
**Scope:** Metrics, charts with honest empty states
**Acceptance:** INSUFFICIENT_DATA handling, no fabricated data

## PHASE 8 — AI / ML
**STATUS:** PENDING
**Scope:** Grounded insights, forecasts with data sufficiency
**Acceptance:** Deterministic, read-only, honest states

## PHASE 9 — Offline / PWA Hardening
**STATUS:** PENDING
**Scope:** Sync robustness, queue management, PWA
**Acceptance:** Idempotency, conflict resolution via backend authority

## PHASE 10 — Subscription
**STATUS:** PENDING
**Scope:** Plans, entitlements
**Acceptance:** Server-side enforcement, no frontend security logic

## PHASE 11 — Final QA
**STATUS:** PENDING
**Scope:** Full regression, staging readiness

**Rule:** ONLY ONE PHASE ACTIVE AT A TIME.

