# PADUPOS — Offline-First POS & Synchronization Architecture

## 1. Offline Architectural Philosophy

POS registers must remain operational during internet disruptions. Cash sales, receipt generation, and drawer sessions must never be blocked by network downtime.

```
┌────────────────────────────────────────────────────────┐
│             Web POS Client (Offline Mode)              │
│  - Catalog Cache (IndexedDB 'products')                │
│  - Current Cash Session (IndexedDB 'activeSession')    │
│  - Outbound Sync Queue (IndexedDB 'syncQueue')         │
└───────────────────────────┬────────────────────────────┘
                            │ Network Reconnects (window.onLine)
                            ▼
┌────────────────────────────────────────────────────────┐
│             POST /api/v1/pos/sync                      │
│  1. Batch Deduplication (unique clientMutationId)      │
│  2. Idempotency Check (cached completed keys)          │
│  3. Offline Sale Schema & Math Validation              │
│  4. Atomic Stock Ledger Decrement                      │
│  5. Double-Entry Journal Entry Generation              │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    Sync Response                       │
│  - successful: [ { id, idempotencyKey, serverId } ]    │
│  - conflicts:  [ { id, idempotencyKey, reason } ]      │
│  - failed:     [ { id, idempotencyKey, error } ]       │
└────────────────────────────────────────────────────────┘
```

---

## 2. Client IndexedDB Storage Design

The client maintains an IndexedDB instance (`padupos_offline_db`) with object stores:
1. `products`: Full branch catalog with prices, costs, barcodes, and current stock snapshots.
2. `syncQueue`: Pending mutations (`FINALIZE_SALE`, `OPEN_CASH_SESSION`, `CLOSE_CASH_SESSION`).
3. `activeSession`: Cached current drawer session float and opening timestamp.

---

## 3. Conflict Resolution Strategy

- **Idempotency Protection**: Every offline transaction generates a unique `idempotencyKey` UUID upon creation. If the client retries the batch upload, previously processed sales return success without duplicating journal entries or stock decrements.
- **Stock Negative Balance Handling**: If offline sales exceed physical stock recorded on the server, the server allows the deduction and marks the inventory with a discrepancy flag, notifying the manager for an inventory cycle count rather than rejecting the customer's completed sale.
- **Cash Only Offline Constraint**: Digital payments (QRIS/Card/Transfer) require live gateway validation and cannot be authorized offline. Only cash transactions are permissible in offline mode.
