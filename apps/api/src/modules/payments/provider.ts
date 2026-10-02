import type { PaymentProvider, PaymentStatus, SettlementStatus, PaymentReconciliation, PaymentMethodType } from '@padupos/types';
import { generatePrefixedId } from '@padupos/shared';

// ================================================================
// 1. MOCK SANDBOX PAYMENT ADAPTER (DEV & TEST ONLY)
// ================================================================

export class MockSandboxPaymentProvider implements PaymentProvider {
  public name = 'MOCK_SANDBOX';

  async createPayment(params: {
    businessId: string;
    saleId: string;
    amount: string;
    currency: string;
    method: PaymentMethodType;
    description: string;
    customerEmail?: string;
    customerName?: string;
  }) {
    const providerPaymentId = generatePrefixedId('mock_pay');
    const providerReference = `REF-${Date.now().toString().slice(-8)}`;

    return {
      providerPaymentId,
      providerReference,
      paymentUrl: `https://sandbox.padupos.local/pay/${providerPaymentId}`,
      qrCodeString: params.method === 'QR' ? `00020101021226${providerPaymentId}5802ID5911PADUPOS` : undefined,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      status: 'PENDING' as PaymentStatus,
      rawResponse: { id: providerPaymentId, mock: true, env: 'sandbox' },
    };
  }

  async getPaymentStatus(providerPaymentId: string) {
    return {
      status: 'PAID' as PaymentStatus,
      settlementStatus: 'SETTLED' as SettlementStatus,
      paidAt: new Date().toISOString(),
      rawResponse: { id: providerPaymentId, status: 'PAID' },
    };
  }

  verifyWebhookSignature(headers: Record<string, string | string[] | undefined>, _rawBody: string): boolean {
    const token = headers['x-callback-token'] || headers['x-webhook-token'];
    return Boolean(token && token === 'valid_sandbox_token');
  }

  parseWebhook(payload: Record<string, unknown>) {
    return {
      providerEventId: (payload.id as string) || generatePrefixedId('evt'),
      providerPaymentId: (payload.payment_id as string) || (payload.external_id as string) || 'unknown',
      providerReference: (payload.reference as string) || 'unknown',
      amount: String(payload.amount || '0'),
      currency: (payload.currency as string) || 'IDR',
      status: (payload.status === 'SUCCESS' ? 'PAID' : payload.status === 'EXPIRED' ? 'EXPIRED' : 'FAILED') as PaymentStatus,
      settlementStatus: 'SETTLED' as SettlementStatus,
      paidAt: (payload.paid_at as string) || new Date().toISOString(),
    };
  }

  async reconcilePayment(providerReference: string): Promise<PaymentReconciliation> {
    return {
      id: generatePrefixedId('rec'),
      businessId: 'biz_default',
      provider: this.name,
      providerReference,
      providerAmount: '100000.0000',
      systemAmount: '100000.0000',
      status: 'MATCHED',
      reconciledAt: new Date().toISOString(),
    };
  }
}

// ================================================================
// 2. XENDIT SANDBOX PROVIDER ADAPTER
// ================================================================

export class XenditSandboxPaymentProvider implements PaymentProvider {
  public name = 'XENDIT';
  private apiKey: string;
  private webhookToken: string;

  constructor(apiKey: string, webhookToken: string) {
    this.apiKey = apiKey;
    this.webhookToken = webhookToken;
  }

  async createPayment(params: {
    businessId: string;
    saleId: string;
    amount: string;
    currency: string;
    method: PaymentMethodType;
    description: string;
    customerEmail?: string;
    customerName?: string;
  }) {
    const providerPaymentId = generatePrefixedId('xnd_inv');
    const providerReference = `XND-${Date.now().toString().slice(-8)}`;

    return {
      providerPaymentId,
      providerReference,
      paymentUrl: `https://checkout-staging.xendit.co/web/${providerPaymentId}`,
      qrCodeString: params.method === 'QR' ? `00020101021226${providerPaymentId}` : undefined,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      status: 'PENDING' as PaymentStatus,
      rawResponse: { id: providerPaymentId, external_id: params.saleId, status: 'PENDING' },
    };
  }

  async getPaymentStatus(providerPaymentId: string) {
    return {
      status: 'PENDING' as PaymentStatus,
      settlementStatus: 'NOT_SETTLED' as SettlementStatus,
      rawResponse: { id: providerPaymentId, status: 'PENDING' },
    };
  }

  verifyWebhookSignature(headers: Record<string, string | string[] | undefined>, _rawBody: string): boolean {
    const callbackToken = headers['x-callback-token'];
    return Boolean(callbackToken && callbackToken === this.webhookToken);
  }

  parseWebhook(payload: Record<string, unknown>) {
    const rawStatus = String(payload.status || '').toUpperCase();
    const mappedStatus: PaymentStatus = rawStatus === 'PAID' || rawStatus === 'SETTLED' ? 'PAID' : rawStatus === 'EXPIRED' ? 'EXPIRED' : 'FAILED';

    return {
      providerEventId: (payload.id as string) || generatePrefixedId('evt'),
      providerPaymentId: (payload.id as string) || (payload.external_id as string),
      providerReference: (payload.external_id as string) || 'unknown',
      amount: String(payload.amount || '0'),
      currency: (payload.currency as string) || 'IDR',
      status: mappedStatus,
      settlementStatus: (mappedStatus === 'PAID' ? 'SETTLED' : 'NOT_SETTLED') as SettlementStatus,
      paidAt: (payload.paid_at as string) || (mappedStatus === 'PAID' ? new Date().toISOString() : undefined),
    };
  }

  async reconcilePayment(providerReference: string): Promise<PaymentReconciliation> {
    return {
      id: generatePrefixedId('rec'),
      businessId: 'biz_default',
      provider: this.name,
      providerReference,
      providerAmount: '0.0000',
      systemAmount: '0.0000',
      status: 'MATCHED',
      reconciledAt: new Date().toISOString(),
    };
  }
}
