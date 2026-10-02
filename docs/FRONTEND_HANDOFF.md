# PADUPOS — Frontend Developer Handoff & API Contracts

> **CRITICAL DIRECTIVE**:
> Do NOT redesign the visual interface or create hypothetical layouts.
> Implement frontend views strictly against the typed contracts, state envelopes, and validation boundaries documented herein.

---

## 1. Global Request & Response Standard

### Base Configuration
- **API Base URL**: `http://localhost:4000/api/v1` (development) or production domain.
- **Content-Type**: `application/json`

### Mandatory Request Headers
Every authenticated request MUST provide:
```http
Authorization: Bearer <jwt_access_token>
x-business-id: <business_id_uuid>
x-branch-id: <branch_id_uuid>
```

For mutating financial transactions (`/pos/sales`, `/pos/sessions/close`, `/pos/sync`), include:
```http
idempotency-key: <unique_v4_uuid_or_prefixed_id>
```

---

## 2. Standard Error Envelope & Handling

The backend NEVER returns raw database or unhandled server traces. All errors conform to:

```json
{
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | INSUFFICIENT_DATA",
    "message": "Human-readable explanation of error",
    "requestId": "req-1727756123-abc",
    "details": [
      {
        "field": "amount",
        "message": "Required and must be a valid numeric string"
      }
    ]
  }
}
```

### Frontend Error Action Guide:
- `UNAUTHORIZED` (401): Clear local auth token and redirect to `/login`.
- `FORBIDDEN` (403): User lacks permission (e.g. cashier trying to access `/finance`). Render `"Akses Ditolak: Anda tidak memiliki izin untuk fitur ini."`.
- `INSUFFICIENT_DATA` (200/422): Render honest empty state banner without dummy fallback numbers.
- `CONFLICT` (409): Resource already exists or idempotency conflict.

---

## 3. Empty State & Honesty Mandate (Zero Fake Data)

The frontend MUST NEVER display dummy, synthetic, or fake placeholders for sales metrics, charts, or AI forecasts.

### Required Empty State Visual Contracts:
1. **New Store / Zero Sales**:
   - Total Sales Today: `Rp 0` (or local currency symbol).
   - Graph: Flat baseline with caption: *"Belum ada transaksi hari ini."*
2. **Sales Forecasting (< 30 days history)**:
   - When API returns `{ status: "INSUFFICIENT_DATA" }`:
   - Render banner:
     > **Data Belum Cukup**
     > *"Belum cukup data untuk membuat prediksi. Minimal 30 hari data transaksi diperlukan (Tersedia: {data_points_count} hari)."*
3. **AI Business Insights (No data)**:
   - Render:
     > *"Belum ada data transaksi yang tercatat. Catat transaksi penjualan pertama Anda untuk mengaktifkan analisis performa bisnis."*

---

## 4. Complete API Endpoint Reference

### A. Cashier Register Shift Flow

#### 1. Open Shift
`POST /api/v1/pos/sessions/open`
- **Request Body**:
  ```json
  {
    "branchId": "branch_123",
    "openingCash": "100000.0000"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "session": {
      "id": "cs_abc123",
      "branchId": "branch_123",
      "cashierUserId": "usr_456",
      "openingCash": "100000.0000",
      "status": "OPEN",
      "openedAt": "2026-10-01T08:00:00.000Z"
    }
  }
  ```

#### 2. Cash In / Cash Out Movement
`POST /api/v1/pos/sessions/:id/movements`
- **Request Body**:
  ```json
  {
    "movementType": "CASH_IN", // or "CASH_OUT"
    "amount": "50000.0000",
    "reason": "Tambahan modal kembalian dari brankas"
  }
  ```

#### 3. Close Shift & Reconcile
`POST /api/v1/pos/sessions/:id/close`
- **Request Body**:
  ```json
  {
    "closingCashCounted": "250000.0000",
    "closingNotes": "Selesai shift siang"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "session": {
      "id": "cs_abc123",
      "openingCash": "100000.0000",
      "totalCashSales": "100000.0000",
      "totalCashIn": "50000.0000",
      "totalCashOut": "0.0000",
      "expectedCash": "250000.0000",
      "closingCashCounted": "250000.0000",
      "difference": "0.0000",
      "status": "CLOSED"
    }
  }
  ```

---

### B. POS Finalize Sale

`POST /api/v1/pos/sales`
- **Headers**: `idempotency-key: <uuid>`
- **Request Body**:
  ```json
  {
    "branchId": "branch_123",
    "cashSessionId": "cs_abc123",
    "customerId": "cust_optional",
    "items": [
      {
        "productId": "prod_coffee",
        "quantity": "2",
        "unitPrice": "20000.0000",
        "discountAmount": "0.0000",
        "taxAmount": "0.0000",
        "notes": "Less sugar"
      }
    ],
    "discountAmount": "0.0000",
    "taxAmount": "0.0000",
    "payments": [
      {
        "paymentMethod": "CASH",
        "amount": "40000.0000"
      }
    ]
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "sale": {
      "id": "sale_789",
      "invoiceNumber": "INV-20261001-0001",
      "subtotal": "40000.0000",
      "discountAmount": "0.0000",
      "taxAmount": "0.0000",
      "totalAmount": "40000.0000",
      "cogsAmount": "12000.0000",
      "status": "PAID"
    }
  }
  ```

---

### C. Offline Sync Batch Contract

`POST /api/v1/pos/sync`
- **Request Body**:
  ```json
  {
    "deviceId": "pos-tablet-01",
    "batch": [
      {
        "id": "offline_item_1",
        "deviceId": "pos-tablet-01",
        "branchId": "branch_123",
        "operation": "FINALIZE_SALE",
        "payload": {
          "sale": { /* Sale Object */ },
          "items": [ /* Items Array */ ],
          "payments": [ /* Payments Array */ ]
        },
        "idempotencyKey": "idem_offline_101",
        "createdAt": "2026-10-01T10:15:00.000Z",
        "retryCount": 0
      }
    ]
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "successful": [
      { "id": "offline_item_1", "idempotencyKey": "idem_offline_101", "serverId": "sale_789" }
    ],
    "conflicts": [],
    "failed": []
  }
  ```

---

### D. Grounded AI Insights

`POST /api/v1/ai/insights`
- **Request Body**:
  ```json
  {
    "insightType": "SALES_TREND" // "INVENTORY_RISK" | "EXPENSE_SPIKE" | "BUSINESS_SUMMARY"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "insightType": "SALES_TREND",
    "title": "Analisis Tren Penjualan",
    "insight": "Penjualan hari ini tercatat Rp 36.000,00 dengan laba kotor Rp 24.000,00 (Margin 66.7%). Kopi Robusta menjadi produk terlaris.",
    "actionableRecommendations": [
      "Pertahankan ketersediaan bahan baku untuk Kopi Robusta.",
      "Monitor pengeluaran operasional agar margin keuntungan tetap terjaga."
    ],
    "groundedMetrics": {
      "salesToday": "36000.0000",
      "grossProfit": "24000.0000"
    }
  }
  ```

---

## 5. Offline Queue Client Integration Pattern

The frontend web/mobile client uses the pre-built `OfflineSyncManager` located in `apps/web/src/offline/syncManager.ts`:

```typescript
import { OfflineSyncManager } from '@/offline/syncManager';

const syncManager = new OfflineSyncManager({
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL!,
  businessId: currentBusiness.id,
  branchId: currentBranch.id,
  deviceId: 'register-tab-01',
  getAuthToken: () => localStorage.getItem('token'),
  onSyncSuccess: (res) => console.log('Sync complete:', res),
});

// Auto-sync listener listens to online network event
syncManager.initAutoSync();

// When cashier finalizes sale offline:
await syncManager.queueOfflineSale(saleData, localSaleId);
```
