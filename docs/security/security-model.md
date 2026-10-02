# PADUPOS — Security Architecture & Threat Model

## 1. Zero Trust Multi-Tenant Isolation

Multi-tenancy isolation in PADUPOS is enforced at two independent layers:

### A. Database-Level Row Level Security (RLS)
Every tenant table features an RLS policy checking the PostgreSQL session parameter:
```sql
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_tenant_isolation ON sales
    USING (business_id = NULLIF(current_setting('app.current_business_id', true), '')::uuid);
```
No tenant query can inspect or mutate rows belonging to another `business_id`.

### B. Application-Level Fastify Middleware
1. **JWT Verification**: Decodes user claim and attaches `request.user`.
2. **Tenant Membership Resolution**: Inspects `x-business-id` header. Validates whether `request.user.id` is the business owner or an active member in `business_members`. If not, immediately terminates with `403 FORBIDDEN`.
3. **RBAC Guard (`requirePermission`)**: Checks if the user's assigned role possesses the required permission string.

---

## 2. Role-Based Access Control (RBAC) Matrix

| Permission | OWNER | MANAGER | CASHIER | STAFF |
| :--- | :---: | :---: | :---: | :---: |
| `pos.use` | ✅ | ✅ | ✅ | ❌ |
| `sales.create` | ✅ | ✅ | ✅ | ❌ |
| `sales.return` | ✅ | ✅ | ❌ | ❌ |
| `inventory.view` | ✅ | ✅ | ✅ | ✅ |
| `inventory.manage` | ✅ | ✅ | ❌ | ❌ |
| `finance.view` | ✅ | ✅ | ❌ | ❌ |
| `finance.create` | ✅ | ✅ | ❌ | ❌ |
| `accounting.view` | ✅ | ❌ | ❌ | ❌ |
| `members.manage` | ✅ | ❌ | ❌ | ❌ |
| `reports.view` | ✅ | ✅ | ❌ | ❌ |
| `ai.insights` | ✅ | ✅ | ❌ | ❌ |

---

## 3. Idempotency & Defense Against Financial Double-Spend

All financial mutations (sale finalization, payment callbacks, cash session closings, sync submissions) require an `idempotency-key` header.
- Keys are scoped per tenant: `scope:businessId:key`.
- In-flight requests lock the key. Completed requests store the final response payload and HTTP status.
- Replayed requests return the cached response immediately with identical HTTP status without re-executing stock deductions or ledger credits.

---

## 4. Immutable Audit Trail

High-risk actions (role modification, inventory adjustments, returns, cash discrepancies, supplier payouts) write immutable records to the `audit_logs` table capturing `user_id`, `ip_address`, `action`, `entity_type`, and before/after metadata snapshots.
