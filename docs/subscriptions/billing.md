# PADUPOS — Subscriptions & Entitlements Specification

## 1. Subscription Tiers & Feature Matrix

PADUPOS offers four subscription tiers designed to support businesses from single-stall micro-merchants to multi-branch enterprises:

| Capability / Resource | FREE | PRO | BUSINESS | ENTERPRISE |
| :--- | :---: | :---: | :---: | :---: |
| **Max Outlets / Branches** | 1 | 3 | 10 | Unlimited |
| **Max Staff / Users** | 2 | 10 | 50 | Unlimited |
| **POS Register & Offline** | ✅ | ✅ | ✅ | ✅ |
| **Inventory & WAC Costing** | ✅ | ✅ | ✅ | ✅ |
| **Double-Entry Accounting** | ✅ | ✅ | ✅ | ✅ |
| **Grounded AI Insights** | Basic | Advanced | Full Access | Full Access |
| **ML Predictive Forecasts** | ❌ | ✅ | ✅ | ✅ |
| **Multi-Branch Consolidation**| ❌ | ❌ | ✅ | ✅ |
| **Dedicated Account Manager**| ❌ | ❌ | ❌ | ✅ |

---

## 2. Server-Side Entitlement Enforcement

Feature gates and limits are strictly enforced server-side via business subscription metadata:

```typescript
export function checkBranchLimit(currentBranches: number, plan: SubscriptionPlan): boolean {
  const limits: Record<SubscriptionPlan, number> = {
    FREE: 1,
    PRO: 3,
    BUSINESS: 10,
    ENTERPRISE: Infinity,
  };
  return currentBranches < limits[plan];
}
```

Attempts to create resources beyond the subscription quota return HTTP `403 FORBIDDEN` with code `PLAN_LIMIT_EXCEEDED` and a direct upgrade link.
