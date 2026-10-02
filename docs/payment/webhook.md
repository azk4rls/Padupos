# PADUPOS — Payment Webhook Verification Specification

## 1. Webhook Endpoint
- **URL**: `POST /api/v1/payments/webhook`
- **Headers**:
  - `Content-Type`: `application/json`
  - `x-provider`: `sandbox | midtrans | xendit | stripe`
  - `x-signature`: `<hmac_sha256_hex_digest>`

---

## 2. Signature Calculation & Verification

To prevent forgery or replay attacks, incoming webhook payloads are authenticated via HMAC-SHA256 signature:

$$\text{Signature} = \text{HMAC-SHA256}(\text{orderId} + \text{statusCode} + \text{grossAmount} + \text{serverKey})$$

```typescript
import crypto from 'node:crypto';

export function verifyWebhookSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  providedSignature: string
): boolean {
  const payload = `${orderId}:${statusCode}:${grossAmount}:${serverKey}`;
  const computed = crypto.createHmac('sha256', serverKey).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(providedSignature));
}
```

---

## 3. Discrepancy Defense: Amount Verification

When a webhook arrives with `status: 'SETTLED'`:
1. The server loads the corresponding `sale` record.
2. The server compares `toBN(webhook.grossAmount).isEqualTo(toBN(sale.totalAmount))`.
3. If unequal:
   - Webhook returns HTTP `422 Unprocessable Entity`.
   - Error code: `PAYMENT_AMOUNT_MISMATCH`.
   - Anomaly event is recorded in `anomaly_events`.
   - Sale remains in `PENDING` state to prevent underpayment fraud.
