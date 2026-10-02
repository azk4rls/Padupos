# BACKEND_RULES.md

Backend Guardrails for All Agents

## CORE PRINCIPLES

- Backend is authoritative for all business-critical state
- Frontend must never become a second business logic engine
- Never invent APIs, production data, or fake results
- Preserve invariants: accounting, payments, tenant isolation
- Use exact decimal arithmetic; no floating point for money
- Authorization is enforced server-side only


## API RULES
- All routes validated with Zod schemas
- Consistent error envelope as documented in FRONTEND_HANDOFF.md
- Idempotency keys required for mutating financial transactions
- Never expose internal implementation details in API responses
- Return explicit insufficient-data states (INSUFFICIENT_DATA) rather than fabricating values


## AUTH, TENANT & RLS RULES
- Multi-tenancy via tenant_id/business_id/branch_id on all relevant entities
- All data access scoped to authenticated user's authorized scope
- RLS primitives must be respected; do not bypass RLS
- RBAC enforced via rbac plugin
- Service role usage restricted and never exposed to frontend
- Frontend is NOT authorization authority


## ACCOUNTING RULES
- True double-entry: every transaction produces balanced debits/credits
- Posted journals are immutable; use reversals for corrections
- Preserve accounting invariants and periods
- Trial balance must always balance
- No frontend-side accounting calculations
- Frontend is NOT accounting authority


## PAYMENT RULES
- Provider abstraction only; no provider-specific logic leaking to clients
- Webhook verification mandatory
- Idempotency enforced for all payment operations
- Amount/currency matching on webhooks
- PAID vs SETTLED must remain distinct
- Reconciliation required
- Frontend is NOT payment authority
- Never fabricate payment success states


## MONEY, INVENTORY, TAX, REFUND RULES
- All monetary amounts use exact decimal (NUMERIC) with bignumber.js
- No floating-point arithmetic
- Inventory movements are immutable audit trail; quantities tracked precisely
- Tax calculations are authoritative server-side
- Refunds follow proper state transitions and accounting impact
- Preserve stock integrity


## AI, ML, OFFLINE SYNC, SECURITY
- AI responses must be grounded in actual data; return INSUFFICIENT_DATA if not enough data
- ML forecasts must not invent data; fallback behavior when insufficient data
- Offline sync uses idempotency; server resolves conflicts authoritatively
- Never log or expose secrets
- Never delete tests merely to get green results
- Do not introduce unnecessary infrastructure
- Error handling must not leak sensitive details

