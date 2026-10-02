import type { FastifyPluginAsync } from 'fastify';
import { createPaymentRequestSchema } from '@padupos/validation';
import { domainStore } from '../domainStore.js';
import { requirePermission } from '../../plugins/rbac.js';
import { MockSandboxPaymentProvider, XenditSandboxPaymentProvider } from './provider.js';
import { config } from '../../config/index.js';
import { generatePrefixedId, toBN } from '@padupos/shared';
import type { PaymentProvider, JournalEntry } from '@padupos/types';

export const paymentsRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = [(fastify as any).authenticate, (fastify as any).resolveTenant];

  // Provider Registry
  const providers: Record<string, PaymentProvider> = {
    MOCK_SANDBOX: new MockSandboxPaymentProvider(),
    XENDIT: new XenditSandboxPaymentProvider(config.PAYMENT_API_KEY, config.PAYMENT_WEBHOOK_TOKEN),
  };

  // 1. Create Payment Request
  fastify.post('/payments', {
    preHandler: [...auth, requirePermission('payment.create')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const body = createPaymentRequestSchema.parse(request.body);

    const sale = domainStore.sales.get(body.saleId);
    if (!sale || sale.businessId !== businessId) {
      return reply.status(404).send({
        error: { code: 'SALE_NOT_FOUND', message: 'Sale not found', requestId: request.id },
      });
    }

    if (sale.status === 'PAID') {
      return reply.status(400).send({
        error: { code: 'ALREADY_PAID', message: 'Sale has already been paid', requestId: request.id },
      });
    }

    const providerKey = config.PAYMENT_PROVIDER.toUpperCase();
    const provider = providers[providerKey] || providers.MOCK_SANDBOX;

    const providerRes = await provider.createPayment({
      businessId,
      saleId: sale.id,
      amount: sale.totalAmount,
      currency: sale.currency,
      method: body.method,
      description: `Payment for Order ${sale.invoiceNumber}`,
      customerEmail: body.customerEmail,
      customerName: body.customerName,
    });

    // Reuse existing pending payment for this sale if present
    let paymentId = generatePrefixedId('pay');
    for (const p of domainStore.payments.values()) {
      if (p.saleId === sale.id && p.businessId === businessId && p.status === 'PENDING') {
        paymentId = p.id;
        break;
      }
    }
    const payment = {
      id: paymentId,
      businessId,
      saleId: sale.id,
      provider: provider.name,
      providerPaymentId: providerRes.providerPaymentId,
      providerReference: providerRes.providerReference,
      method: body.method,
      amount: sale.totalAmount,
      currency: sale.currency,
      status: providerRes.status,
      settlementStatus: 'NOT_SETTLED' as const,
      expiresAt: providerRes.expiresAt,
      metadata: providerRes.rawResponse,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    domainStore.payments.set(paymentId, payment);

    return reply.status(201).send({
      payment,
      paymentUrl: providerRes.paymentUrl,
      qrCodeString: providerRes.qrCodeString,
    });
  });

  // 2. Verified Payment Webhook Handler
  // POST /api/v1/webhooks/payments/:provider
  fastify.post<{ Params: { provider: string } }>('/webhooks/payments/:provider', async (request, reply) => {
    const providerKey = request.params.provider.toUpperCase();
    const provider = providers[providerKey];

    if (!provider) {
      return reply.status(404).send({
        error: { code: 'UNKNOWN_PROVIDER', message: `Provider '${providerKey}' is not supported`, requestId: request.id },
      });
    }

    // 1. Authenticate & Verify Webhook Signature
    const rawBody = JSON.stringify(request.body || {});
    const isVerified = provider.verifyWebhookSignature(request.headers as any, rawBody);

    if (!isVerified) {
      request.log.warn({ msg: 'Webhook signature verification failed', provider: providerKey, headers: request.headers });
      return reply.status(401).send({
        error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed', requestId: request.id },
      });
    }

    // 2. Parse Normalized Event
    const parsed = provider.parseWebhook(request.body as Record<string, unknown>);

    // 3. Idempotency Check: prevent duplicate event processing
    const eventKey = `evt:${providerKey}:${parsed.providerEventId}`;
    if (domainStore.idempotencyKeys.has(eventKey)) {
      return reply.status(200).send({ message: 'Event already processed' });
    }

    // 4. Find Associated Payment
    let matchingPayment: any = null;
    for (const p of domainStore.payments.values()) {
      if (p.providerReference === parsed.providerReference || p.providerPaymentId === parsed.providerPaymentId || p.saleId === parsed.providerReference) {
        matchingPayment = p;
        break;
      }
    }

    if (!matchingPayment) {
      return reply.status(404).send({
        error: { code: 'PAYMENT_NOT_FOUND', message: 'No associated payment found for webhook event', requestId: request.id },
      });
    }

    // 5. Verification against expected amount & currency
    const expectedAmountBN = toBN(matchingPayment.amount);
    const receivedAmountBN = toBN(parsed.amount);

    if (!expectedAmountBN.isEqualTo(receivedAmountBN) || (parsed.currency && parsed.currency !== matchingPayment.currency)) {
      const isCurMismatch = parsed.currency && parsed.currency !== matchingPayment.currency;
      domainStore.reconciliations.push({
        id: generatePrefixedId('rec'),
        businessId: matchingPayment.businessId,
        paymentId: matchingPayment.id,
        provider: providerKey,
        providerReference: parsed.providerReference,
        providerAmount: parsed.amount,
        systemAmount: matchingPayment.amount,
        status: 'MISMATCH',
        discrepancyDetails: {
          reason: isCurMismatch ? 'Currency mismatch' : 'Amount mismatch',
          expected: matchingPayment.amount,
          received: parsed.amount,
          expectedCurrency: matchingPayment.currency,
          receivedCurrency: parsed.currency,
        },
        reconciledAt: new Date().toISOString(),
      });

      return reply.status(422).send({
        error: { code: 'PAYMENT_MISMATCH', message: isCurMismatch ? 'Received currency does not match expected currency' : 'Received amount does not match expected payment amount', requestId: request.id },
      });
    }

    // 6. Valid State Transition
    matchingPayment.status = parsed.status;
    matchingPayment.settlementStatus = parsed.settlementStatus || 'SETTLED';
    matchingPayment.paidAt = parsed.paidAt;
    matchingPayment.updatedAt = new Date().toISOString();

    // 7. Finalize Sale if genuinely PAID
    if (parsed.status === 'PAID') {
      const sale = domainStore.sales.get(matchingPayment.saleId);
      if (sale && sale.status !== 'PAID') {
        sale.status = 'PAID';
        sale.updatedAt = new Date().toISOString();

        // Post Double-Entry Journal for non-cash payment clearing
        const jEntryId = generatePrefixedId('jrn');
        const jEntry: JournalEntry = {
          id: jEntryId,
          businessId: sale.businessId,
          branchId: sale.branchId,
          entryNumber: `JRN-${sale.invoiceNumber}`,
          entryDate: new Date().toISOString().split('T')[0],
          description: `Digital Payment Sale #${sale.invoiceNumber}`,
          sourceType: 'SALE',
          sourceId: sale.id,
          isPosted: true,
          createdBy: sale.createdBy,
          createdAt: new Date().toISOString(),
        };

        const bankAccId = `acc_${sale.businessId}_1030`; // Payment Gateway Clearing
        const revAccId = `acc_${sale.businessId}_4010`;  // Sales Revenue
        const cogsAccId = `acc_${sale.businessId}_5010`; // COGS
        const invAccId = `acc_${sale.businessId}_1050`;  // Inventory

        domainStore.journalEntries.set(jEntryId, jEntry);
        domainStore.journalLines.set(jEntryId, [
          { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: bankAccId, debit: sale.totalAmount, credit: '0.0000' },
          { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: revAccId, debit: '0.0000', credit: sale.totalAmount },
          { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: cogsAccId, debit: sale.cogsAmount, credit: '0.0000' },
          { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: invAccId, debit: '0.0000', credit: sale.cogsAmount },
        ]);
      }

      // Record MATCHED reconciliation
      domainStore.reconciliations.push({
        id: generatePrefixedId('rec'),
        businessId: matchingPayment.businessId,
        paymentId: matchingPayment.id,
        provider: providerKey,
        providerReference: parsed.providerReference,
        providerAmount: parsed.amount,
        systemAmount: matchingPayment.amount,
        status: 'MATCHED',
        reconciledAt: new Date().toISOString(),
      });
    }

    // Save event in idempotency keys
    domainStore.idempotencyKeys.set(eventKey, {
      payloadHash: parsed.providerEventId,
      response: { received: true, status: parsed.status },
      statusCode: 200,
    });

    return reply.status(200).send({ received: true, status: parsed.status });
  });

  // 3. Payment Reconciliation Records
  fastify.get('/payments/reconciliation', {
    preHandler: [...auth, requirePermission('payment.reconcile')],
  }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const list = domainStore.reconciliations.filter((r) => r.businessId === businessId);
    return { reconciliations: list };
  });
};
