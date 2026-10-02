# PADUPOS — Automated Testing Strategy & Acceptance Criteria

## 1. Test Pyramid & Coverage Hierarchy

PADUPOS adopts a rigorous multi-layered testing strategy across pure TypeScript engines, API endpoints, security guards, and Python ML pipelines:

```
                  ┌───────────────────────────────┐
                  │    Section 216 Real-World     │
                  │   End-to-End Acceptance Test  │
                  └───────────────┬───────────────┘
                                  │
                  ┌───────────────▼───────────────┐
                  │ Security & Multi-Tenant Tests │
                  │ Payment Webhook Integrity     │
                  └───────────────┬───────────────┘
                                  │
                  ┌───────────────▼───────────────┐
                  │ Pure Mathematical Unit Tests  │
                  │ (WAC, Order, Balancing, Zod)  │
                  │ Python ML Unit Tests          │
                  └───────────────────────────────┘
```

---

## 2. Test Execution Commands

```bash
# Run all workspace TypeScript tests (shared, validation, API)
pnpm -r test

# Run API test suites specifically
pnpm --filter padupos-api run test

# Run Section 216 Real-World Integration Acceptance test
pnpm --filter padupos-api run test:integration

# Run Multi-Tenant Isolation & RBAC security test
pnpm --filter padupos-api run test:security

# Run Payment Webhook & Amount Mismatch tests
pnpm --filter padupos-api run test:payment

# Run Python ML Worker Unit Tests (8 tests)
python -m unittest workers/ml/tests/test_ml.py
```

---

## 3. Section 216 End-to-End Operating Loop Acceptance Test

The `apps/api/src/tests/integration.test.ts` suite executes the complete business operating loop:
1. Register user & create tenant business (with default Chart of Accounts).
2. Open register drawer shift with 100,000 cash float.
3. Create supplier & record cash inventory purchase of 10 units at 6,000 (WAC calculated).
4. Execute cash sale of 4 units at 10,000 (Subtotal 40,000, 10% discount = 4,000, Net 36,000, COGS 24,000).
5. Verify inventory decremented to exactly 6 units.
6. Record operational electricity expense of 10,000.
7. Close cash drawer shift and balance cash.
8. Verify balanced trial balance ($\sum \text{Debit} = \sum \text{Credit}$).
9. Verify Profit & Loss: Revenue 36,000, COGS 12,000, Gross Profit 24,000, Expenses 10,000, Operating Profit 14,000.
10. Query Grounded AI Insights and verify honest data reflections without hallucinations.
