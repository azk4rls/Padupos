# PADUPOS — Non-Custodial Payment Flow

## 1. Non-Custodial Architecture

PADUPOS operates strictly on a **non-custodial** architecture. Merchant funds flow directly from the customer through the merchant's configured payment gateway (e.g. Midtrans, Xendit, Stripe) to the merchant's bank account. PADUPOS servers never touch, pool, or hold merchant balances.

```
┌───────────┐         1. Checkout          ┌────────────────┐
│ Customer  ├─────────────────────────────►│ POS Cashier /  │
│           │                              │ Web Register   │
└─────┬─────┘                              └───────┬────────┘
      │                                            │ 2. Create Intent
      │ 4. Scan QRIS / Pay                         ▼
      │    Directly to Gateway             ┌────────────────┐
      │                                    │ PADUPOS API    │
      ▼                                    └───────┬────────┘
┌───────────────────────────┐                      │ 3. Sign Order & Issue URL
│ Payment Gateway Partner   │◄─────────────────────┘
│ (Sandbox / Production)    │
└─────────────┬─────────────┘
              │
              │ 5. Asynchronous Webhook (Signed HMAC-SHA256)
              ▼
┌───────────────────────────┐
│ PADUPOS Webhook Receiver  │
│ - Verify Signature        │
│ - Verify Amount Match     │
│ - Idempotent Settle       │
│ - Post Journal Entry      │
└───────────────────────────┘
```

---

## 2. Order Lifecycle State Machine

- `PENDING`: Payment invoice created; awaiting customer payment.
- `SETTLED`: Gateway verified full payment received via signed webhook. Sale marked as `PAID`.
- `EXPIRED`: Payment time window lapsed without confirmation.
- `FAILED`: Payment rejected or cancelled.

---

## 3. Strict Security Rules

1. **Client Never Dictates Status**: The POS frontend cannot mark a digital transaction (QRIS/Card/Transfer) as `PAID`. Only a cryptographically verified webhook or verified manual cashier override can transition state.
2. **Gross Amount Matching**: If the payment gateway reports an amount different from `sale.total_amount`, the webhook is flagged as `AMOUNT_MISMATCH` and rejected.
3. **Idempotency**: Webhook events are deduplicated by `gateway_transaction_id`.
