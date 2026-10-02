# PADUPOS — API Reference & Contracts Specification

## 1. Global Standard Protocol

- **Base URL**: `/api/v1`
- **Content-Type**: `application/json`
- **Standard Request Headers**:
  - `Authorization`: `Bearer <jwt_token>` (Required for protected endpoints)
  - `x-business-id`: `<business_uuid>` (Mandatory tenant scoping header)
  - `x-branch-id`: `<branch_uuid>` (Required for branch-specific operations)
  - `idempotency-key`: `<unique_string>` (Mandatory for mutating financial/payment actions)

---

## 2. Standard Error Envelope

All API errors return a uniform, sanitized JSON payload without leaking internal stack traces or database errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | INTERNAL_SERVER_ERROR",
    "message": "Human-readable message explaining the error.",
    "requestId": "req-1727756123-abc",
    "details": [
      {
        "field": "amount",
        "message": "Amount must be a positive numeric string"
      }
    ]
  }
}
```

---

## 3. Endpoints Catalog

### A. Health & Countries
- `GET /health` — API health check and uptime.
- `GET /api/v1/countries` — List supported country configurations (`ID`, `SG`, `MY`, `US`, `GB`, `AU`).
- `GET /api/v1/countries/:code` — Retrieve single country config (currency, tax rules, formats).

### B. Authentication & Onboarding
- `POST /api/v1/auth/register` — Register owner profile.
- `POST /api/v1/auth/login` — Sign in and issue JWT.
- `POST /api/v1/businesses` — Create business and initialize default Chart of Accounts and main branch.
- `GET /api/v1/businesses/my` — List businesses where authenticated user is an active member.
- `POST /api/v1/businesses/:id/members` — Invite user with role (`MANAGER`, `CASHIER`, `STAFF`).

### C. Catalog & Inventory
- `GET /api/v1/products` — List catalog products with current stock.
- `POST /api/v1/products` — Create new product with price and cost.
- `GET /api/v1/inventory` — Query branch-level inventory with low-stock alerts.
- `POST /api/v1/inventory/adjustments` — Record manual stock adjustment with audit reason.

### D. POS Register & Cashier Shifts
- `POST /api/v1/pos/sessions/open` — Open cash shift drawer with opening float.
- `POST /api/v1/pos/sessions/:id/movements` — Record Cash In / Cash Out drawer movement.
- `POST /api/v1/pos/sessions/:id/close` — Count drawer cash, calculate discrepancy, and close shift.
- `POST /api/v1/pos/sales` — Finalize sale with items, taxes, discounts, and payments.
- `POST /api/v1/pos/sales/:id/returns` — Process return and restock eligible items.
- `POST /api/v1/pos/sync` — Offline mutation batch synchronization.

### E. Payments Gateway (Non-Custodial)
- `POST /api/v1/payments/create-intent` — Initiate payment invoice with sandbox gateway.
- `POST /api/v1/payments/webhook` — Process provider webhook with HMAC-SHA256 signature verification.

### F. Procurement & Supplier Relations
- `GET /api/v1/suppliers` — Directory of active suppliers.
- `POST /api/v1/suppliers` — Register supplier.
- `POST /api/v1/purchases` — Record inventory purchase, recalculate WAC cost, and post double-entry journal.

### G. Finance, Debts & Double-Entry Accounting
- `GET /api/v1/accounting/accounts` — Chart of Accounts balances.
- `GET /api/v1/accounting/trial-balance` — Verifies total debit equals total credit.
- `GET /api/v1/finance/profit-loss` — Real data Profit & Loss statement.
- `GET /api/v1/finance/cash-flow` — Direct cash flow statement.
- `GET /api/v1/finance/receivables` — Customer credit balances.
- `POST /api/v1/finance/receivables/:id/payments` — Record customer debt payment.
- `GET /api/v1/finance/payables` — Supplier payable liabilities.
- `POST /api/v1/finance/payables/:id/payments` — Disburse supplier payment.

### H. Grounded AI Insights & Machine Learning
- `GET /api/v1/dashboard/metrics` — Honest dashboard KPIs (no fake numbers).
- `POST /api/v1/ai/insights` — Grounded business intelligence derived strictly from SQL facts.
- `GET /api/v1/ml/sales-forecast` — 7-day predictive sales (requires 30 days minimum history).
- `GET /api/v1/ml/stock-depletion` — Run rate velocity and stockout horizon.
- `GET /api/v1/ml/anomalies` — Fraud and outlier detection events.
