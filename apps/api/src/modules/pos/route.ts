import type { FastifyPluginAsync } from 'fastify';
import {
  openCashSessionSchema,
  closeCashSessionSchema,
  recordCashMovementSchema,
  finalizeSaleSchema,
  createReturnSchema,
} from '@padupos/validation';
import { domainStore } from '../domainStore.js';
import { requirePermission } from '../../plugins/rbac.js';
import {
  calculateOrder,
  calculateCashSession,
  generatePrefixedId,
  toBN,
} from '@padupos/shared';
import type {
  CashSession,
  Sale,
  SaleItem,
  Payment,
  JournalEntry,
  JournalEntryLine,
  Return,
  ReturnItem,
} from '@padupos/types';
import BigNumber from 'bignumber.js';

export const posRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = [(fastify as any).authenticate, (fastify as any).resolveTenant];

  // 1. Open Cashier Session
  fastify.post('/pos/sessions/open', {
    preHandler: [...auth, requirePermission('sales.create')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const userId = request.user!.id;
    const body = openCashSessionSchema.parse(request.body);

    // Check if cashier already has an active open session in this branch
    for (const s of domainStore.cashSessions.values()) {
      if (s.businessId === businessId && s.branchId === body.branchId && s.cashierUserId === userId && s.status === 'OPEN') {
        return reply.status(400).send({
          error: {
            code: 'ACTIVE_SESSION_EXISTS',
            message: 'An active cash session is already open for this cashier in this branch',
            requestId: request.id,
          },
        });
      }
    }

    const sessionId = generatePrefixedId('csess');
    const session: CashSession = {
      id: sessionId,
      businessId,
      branchId: body.branchId,
      cashierUserId: userId,
      openedAt: new Date().toISOString(),
      openingCash: body.openingCash,
      cashSales: '0.0000',
      cashExpenses: '0.0000',
      cashIn: '0.0000',
      cashOut: '0.0000',
      expectedCash: body.openingCash,
      status: 'OPEN',
      notes: body.notes,
    };

    domainStore.cashSessions.set(sessionId, session);
    return reply.status(201).send({ session });
  });

  // 2. Get Current Cashier Session
  fastify.get('/pos/sessions/current', {
    preHandler: [...auth, requirePermission('sales.create')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const userId = request.user!.id;
    const branchId = (request.query as any)?.branchId;

    for (const s of domainStore.cashSessions.values()) {
      if (s.businessId === businessId && s.cashierUserId === userId && s.status === 'OPEN') {
        if (!branchId || s.branchId === branchId) {
          return { session: s };
        }
      }
    }

    return reply.status(404).send({
      error: { code: 'NO_ACTIVE_SESSION', message: 'No active cash session found', requestId: request.id },
    });
  });

  // 3. Record Cash In / Out
  fastify.post('/pos/sessions/movements', {
    preHandler: [...auth, requirePermission('sales.create')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const userId = request.user!.id;
    const body = recordCashMovementSchema.parse(request.body);

    const session = domainStore.cashSessions.get(body.cashSessionId);
    if (!session || session.businessId !== businessId || session.status !== 'OPEN') {
      return reply.status(400).send({
        error: { code: 'INVALID_SESSION', message: 'Active session not found', requestId: request.id },
      });
    }

    const amountBN = toBN(body.amount);
    if (body.type === 'IN') {
      session.cashIn = toBN(session.cashIn).plus(amountBN).toFixed(4);
    } else if (body.type === 'OUT') {
      session.cashOut = toBN(session.cashOut).plus(amountBN).toFixed(4);
    } else if (body.type === 'EXPENSE') {
      session.cashExpenses = toBN(session.cashExpenses).plus(amountBN).toFixed(4);
    }

    // Recalculate expected cash
    const balancing = calculateCashSession({
      openingCash: session.openingCash,
      cashSales: session.cashSales,
      cashIn: session.cashIn,
      cashOut: session.cashOut,
      cashExpenses: session.cashExpenses,
    });
    session.expectedCash = balancing.expectedCash;

    const movement = {
      id: generatePrefixedId('cmov'),
      businessId,
      branchId: body.branchId,
      cashSessionId: session.id,
      type: body.type,
      amount: amountBN.toFixed(4),
      reason: body.reason,
      performedBy: userId,
      createdAt: new Date().toISOString(),
    };

    domainStore.cashMovements.push(movement);
    return reply.status(201).send({ movement, session });
  });

  // 4. Close Cashier Session
  fastify.post<{ Params: { id: string } }>('/pos/sessions/:id/close', {
    preHandler: [...auth, requirePermission('sales.create')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const body = closeCashSessionSchema.parse(request.body);

    const session = domainStore.cashSessions.get(request.params.id);
    if (!session || session.businessId !== businessId) {
      return reply.status(404).send({
        error: { code: 'SESSION_NOT_FOUND', message: 'Cash session not found', requestId: request.id },
      });
    }

    if (session.status === 'CLOSED') {
      return reply.status(400).send({
        error: { code: 'ALREADY_CLOSED', message: 'Cash session is already closed', requestId: request.id },
      });
    }

    const balancing = calculateCashSession({
      openingCash: session.openingCash,
      cashSales: session.cashSales,
      cashIn: session.cashIn,
      cashOut: session.cashOut,
      cashExpenses: session.cashExpenses,
      actualCash: body.actualCash,
    });

    session.actualCash = balancing.actualCash!;
    session.difference = balancing.difference!;
    session.status = 'CLOSED';
    session.closedAt = new Date().toISOString();
    if (body.notes) session.notes = body.notes;

    return {
      message: 'Session closed successfully',
      session,
      isBalanced: balancing.isBalanced,
      difference: balancing.difference,
    };
  });

  // 5. Atomic Sale Finalization (POS Checkout)
  fastify.post('/pos/sales', {
    preHandler: [...auth, requirePermission('sales.create')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const userId = request.user!.id;
    const body = finalizeSaleSchema.parse(request.body);

    // Idempotency check: if key already executed for this business, return cached response
    const idemKey = `sale:${businessId}:${body.idempotencyKey}`;
    if (domainStore.idempotencyKeys.has(idemKey)) {
      const cached = domainStore.idempotencyKeys.get(idemKey)!;
      return reply.status(cached.statusCode).send(cached.response);
    }

    const biz = domainStore.businesses.get(businessId)!;
    const currency = biz.baseCurrency;

    // Check inventory stock and retrieve unit costs
    const itemsForCalculation = [];
    for (const item of body.items) {
      const invKey = `${body.branchId}:${item.productId}:${item.variantId || ''}`;
      const inv = domainStore.inventories.get(invKey);
      const reqQty = toBN(item.quantity);

      if (!inv || toBN(inv.availableQuantity).isLessThan(reqQty)) {
        return reply.status(400).send({
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: `Insufficient stock for product ${item.productId}`,
            requestId: request.id,
          },
        });
      }

      itemsForCalculation.push({
        unitPrice: item.unitPrice,
        unitCost: inv.averageCost,
        quantity: item.quantity,
        discountAmount: item.discountAmount,
      });
    }

    // Pure calculation engine
    const orderCalc = calculateOrder({
      items: itemsForCalculation,
      orderDiscountAmount: body.orderDiscountAmount,
      taxRatePercentage: body.taxRatePercentage,
      isTaxInclusive: body.isTaxInclusive,
      feeAmount: body.feeAmount,
    });

    const saleId = generatePrefixedId('sale');
    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;

    // Is it paid immediately? Cash is PAID immediately; non-cash is PENDING_PAYMENT until webhook
    const isCash = body.paymentMethod === 'CASH';
    const saleStatus = isCash ? 'PAID' : 'PENDING_PAYMENT';

    const sale: Sale = {
      id: saleId,
      businessId,
      branchId: body.branchId,
      cashSessionId: body.cashSessionId,
      customerId: body.customerId,
      invoiceNumber,
      status: saleStatus,
      subtotal: orderCalc.subtotal,
      discountAmount: toBN(orderCalc.itemsDiscountTotal).plus(toBN(orderCalc.orderDiscount)).toFixed(4),
      taxAmount: orderCalc.taxAmount,
      feeAmount: orderCalc.feeAmount,
      totalAmount: orderCalc.grandTotal,
      cogsAmount: orderCalc.totalCOGS,
      grossProfitAmount: orderCalc.grossProfit,
      currency,
      notes: body.notes,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Create Sale Items & Deduct Inventory Movemenets
    const createdSaleItems: SaleItem[] = [];

    for (let i = 0; i < body.items.length; i++) {
      const reqItem = body.items[i];
      const calcItem = orderCalc.items[i];
      const invKey = `${body.branchId}:${reqItem.productId}:${reqItem.variantId || ''}`;
      const inv = domainStore.inventories.get(invKey)!;
      const qtyBN = toBN(reqItem.quantity);

      // Decrement stock
      inv.quantity = toBN(inv.quantity).minus(qtyBN).toFixed(4);
      inv.availableQuantity = toBN(inv.availableQuantity).minus(qtyBN).toFixed(4);
      inv.updatedAt = new Date().toISOString();

      // Record movement
      domainStore.movements.push({
        id: generatePrefixedId('mov'),
        businessId,
        branchId: body.branchId,
        productId: reqItem.productId,
        variantId: reqItem.variantId,
        type: 'SALE_OUT',
        quantity: qtyBN.toFixed(4),
        unitCost: inv.averageCost,
        totalCost: calcItem.cogsTotal,
        referenceType: 'SALE',
        referenceId: saleId,
        createdBy: userId,
        createdAt: new Date().toISOString(),
      });

      const sItem: SaleItem = {
        id: generatePrefixedId('sitem'),
        saleId,
        productId: reqItem.productId,
        variantId: reqItem.variantId,
        quantity: qtyBN.toFixed(4),
        unitPrice: toBN(reqItem.unitPrice).toFixed(4),
        unitCost: inv.averageCost,
        subtotal: calcItem.lineSubtotal,
        discountAmount: calcItem.discountAmount,
        taxAmount: '0.0000',
        total: calcItem.lineTotal,
        cogsTotal: calcItem.cogsTotal,
      };

      createdSaleItems.push(sItem);
    }

    domainStore.sales.set(saleId, sale);
    domainStore.saleItems.set(saleId, createdSaleItems);

    // Create Payment Record
    const paymentId = generatePrefixedId('pay');
    const payment: Payment = {
      id: paymentId,
      businessId,
      saleId,
      provider: isCash ? 'CASH' : 'MOCK_SANDBOX',
      method: body.paymentMethod,
      amount: orderCalc.grandTotal,
      currency,
      status: isCash ? 'PAID' : 'PENDING',
      settlementStatus: isCash ? 'SETTLED' : 'NOT_SETTLED',
      paidAt: isCash ? new Date().toISOString() : undefined,
      settledAt: isCash ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    domainStore.payments.set(paymentId, payment);

    // If Cash, update active cash session
    if (isCash && body.cashSessionId) {
      const session = domainStore.cashSessions.get(body.cashSessionId);
      if (session && session.status === 'OPEN') {
        session.cashSales = toBN(session.cashSales).plus(toBN(orderCalc.grandTotal)).toFixed(4);
        const bal = calculateCashSession({
          openingCash: session.openingCash,
          cashSales: session.cashSales,
          cashIn: session.cashIn,
          cashOut: session.cashOut,
          cashExpenses: session.cashExpenses,
        });
        session.expectedCash = bal.expectedCash;
      }
    }

    // Post Double-Entry Journal Entry
    if (isCash) {
      const jEntryId = generatePrefixedId('jrn');
      const jEntry: JournalEntry = {
        id: jEntryId,
        businessId,
        branchId: body.branchId,
        entryNumber: `JRN-${sale.invoiceNumber}`,
        entryDate: new Date().toISOString().split('T')[0],
        description: `Cash Sale #${sale.invoiceNumber}`,
        sourceType: 'SALE',
        sourceId: saleId,
        isPosted: true,
        createdBy: userId,
        createdAt: new Date().toISOString(),
      };

      // 1. Debit Cash, Credit Sales Revenue
      // 2. Debit COGS, Credit Merchandise Inventory
      const cashAccId = `acc_${businessId}_1010`;
      const revAccId = `acc_${businessId}_4010`;
      const cogsAccId = `acc_${businessId}_5010`;
      const invAccId = `acc_${businessId}_1050`;

      domainStore.journalEntries.set(jEntryId, jEntry);
      domainStore.journalLines.set(jEntryId, [
        { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: cashAccId, debit: orderCalc.grandTotal, credit: '0.0000' },
        { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: revAccId, debit: '0.0000', credit: orderCalc.grandTotal },
        { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: cogsAccId, debit: orderCalc.totalCOGS, credit: '0.0000' },
        { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: invAccId, debit: '0.0000', credit: orderCalc.totalCOGS },
      ]);
    }

    const responsePayload = {
      message: 'Sale finalized successfully',
      sale,
      items: createdSaleItems,
      payment,
      receiptUrl: `/api/v1/pos/sales/${saleId}/receipt`,
    };

    // Store in idempotency table
    domainStore.idempotencyKeys.set(idemKey, {
      payloadHash: body.idempotencyKey,
      response: responsePayload,
      statusCode: 201,
    });

    return reply.status(201).send(responsePayload);
  });

  // 6. Get Receipt Data
  fastify.get<{ Params: { id: string } }>('/pos/sales/:id/receipt', {
    preHandler: [...auth, requirePermission('sales.view')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const sale = domainStore.sales.get(request.params.id);

    if (!sale || sale.businessId !== businessId) {
      return reply.status(404).send({
        error: { code: 'SALE_NOT_FOUND', message: 'Sale not found', requestId: request.id },
      });
    }

    const biz = domainStore.businesses.get(businessId)!;
    const branch = domainStore.branches.get(sale.branchId);
    const items = domainStore.saleItems.get(sale.id) || [];

    const enrichedItems = items.map((it) => {
      const prod = domainStore.products.get(it.productId);
      return {
        ...it,
        productName: prod ? prod.name : 'Unknown Product',
        unit: prod ? prod.unit : 'pcs',
      };
    });

    return {
      receipt: {
        invoiceNumber: sale.invoiceNumber,
        businessName: biz.name,
        branchName: branch ? branch.name : 'Main Branch',
        branchAddress: branch?.address,
        phone: branch?.phone,
        items: enrichedItems,
        subtotal: sale.subtotal,
        discount: sale.discountAmount,
        tax: sale.taxAmount,
        fees: sale.feeAmount,
        total: sale.totalAmount,
        currency: sale.currency,
        status: sale.status,
        date: sale.createdAt,
        cashierId: sale.createdBy,
      },
    };
  });

  // 7. Returns / Refunds
  fastify.post<{ Params: { id: string } }>('/pos/sales/:id/returns', {
    preHandler: [...auth, requirePermission('sales.refund')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const userId = request.user!.id;
    const body = createReturnSchema.parse({ ...request.body as object, saleId: request.params.id });

    const sale = domainStore.sales.get(body.saleId);
    // Validation 1: Tenant ownership
    if (!sale || sale.businessId !== businessId) {
      return reply.status(404).send({
        error: { code: 'SALE_NOT_FOUND', message: 'Sale not found', requestId: request.id },
      });
    }

    // Validation 2: Sale must be finalized and PAID
    if (sale.status === 'REFUNDED') {
      return reply.status(400).send({
        error: { code: 'ALREADY_REFUNDED', message: 'This sale has already been refunded', requestId: request.id },
      });
    }

    if (sale.status !== 'PAID') {
      return reply.status(400).send({
        error: { code: 'INVALID_SALE_FOR_RETURN', message: 'Only finalized PAID sales can be returned', requestId: request.id },
      });
    }

    const returnId = generatePrefixedId('ret');
    const returnRef = `RET-${Date.now().toString().slice(-6)}`;
    let refundSum = new BigNumber(0);
    let totalRestockCost = new BigNumber(0);
    const returnItemsList: ReturnItem[] = [];

    const saleItemsList = domainStore.saleItems.get(sale.id) || [];

    for (const item of body.items) {
      const sItem = saleItemsList.find((si) => si.id === item.saleItemId);
      if (!sItem) continue;

      const qtyBN = toBN(item.quantity);
      if (qtyBN.isLessThanOrEqualTo(0) || qtyBN.isGreaterThan(toBN(sItem.quantity))) {
        return reply.status(400).send({
          error: { code: 'INVALID_REFUND_AMOUNT', message: `Invalid return quantity for item ${sItem.productId}`, requestId: request.id },
        });
      }

      const refundItemAmount = toBN(sItem.unitPrice).multipliedBy(qtyBN);
      refundSum = refundSum.plus(refundItemAmount);

      // Return stock to inventory if requested
      if (item.restockToInventory) {
        const invKey = `${sale.branchId}:${sItem.productId}:${sItem.variantId || ''}`;
        const inv = domainStore.inventories.get(invKey);
        if (inv) {
          inv.quantity = toBN(inv.quantity).plus(qtyBN).toFixed(4);
          inv.availableQuantity = toBN(inv.availableQuantity).plus(qtyBN).toFixed(4);
          inv.updatedAt = new Date().toISOString();

          const itemRestockCost = qtyBN.multipliedBy(toBN(sItem.unitCost));
          totalRestockCost = totalRestockCost.plus(itemRestockCost);

          domainStore.movements.push({
            id: generatePrefixedId('mov'),
            businessId,
            branchId: sale.branchId,
            productId: sItem.productId,
            variantId: sItem.variantId,
            type: 'SALE_RETURN_IN',
            quantity: qtyBN.toFixed(4),
            unitCost: sItem.unitCost,
            totalCost: itemRestockCost.toFixed(4),
            referenceType: 'SALE',
            referenceId: returnId,
            createdBy: userId,
            createdAt: new Date().toISOString(),
          });
        }
      }

      returnItemsList.push({
        id: generatePrefixedId('ritem'),
        returnId,
        saleItemId: sItem.id,
        productId: sItem.productId,
        quantity: qtyBN.toFixed(4),
        unitPrice: sItem.unitPrice,
        refundSubtotal: refundItemAmount.toFixed(4),
        restockToInventory: item.restockToInventory,
      });
    }

    if (refundSum.isLessThanOrEqualTo(0) || refundSum.isGreaterThan(toBN(sale.totalAmount))) {
      return reply.status(400).send({
        error: { code: 'INVALID_REFUND_AMOUNT', message: 'Refund amount must be positive and cannot exceed sale total', requestId: request.id },
      });
    }

    const returnRecord: Return = {
      id: returnId,
      businessId,
      branchId: sale.branchId,
      saleId: sale.id,
      referenceNumber: returnRef,
      refundAmount: refundSum.toFixed(4),
      reason: body.reason,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };

    sale.status = 'REFUNDED';
    sale.updatedAt = new Date().toISOString();
    domainStore.returns.set(returnId, returnRecord);

    // Find Associated Payment to determine Refund Credit Account
    let matchingPayment: Payment | undefined;
    for (const p of domainStore.payments.values()) {
      if (p.saleId === sale.id && p.businessId === businessId) {
        if (p.status === 'PAID' || !matchingPayment) {
          matchingPayment = p;
        }
      }
    }

    // Account determination:
    // Returns & Allowances (4020) is debited
    // Credit Account depends on payment method and settlement status:
    // A. Cash -> 1010 Cash on Hand
    // B. Gateway Pre-Settlement -> 1030 Payment Gateway Clearing
    // C. Gateway Post-Settlement -> 1020 Bank Account
    const returnsAccId = `acc_${businessId}_4020`;
    let refundCreditAccId = `acc_${businessId}_1010`; // Default cash

    if (matchingPayment) {
      if (matchingPayment.method === 'CASH' || matchingPayment.provider === 'CASH') {
        refundCreditAccId = `acc_${businessId}_1010`; // Cash on Hand
      } else if (matchingPayment.settlementStatus === 'SETTLED') {
        refundCreditAccId = `acc_${businessId}_1020`; // Bank Account (Post-Settlement)
      } else {
        refundCreditAccId = `acc_${businessId}_1030`; // Payment Gateway Clearing (Pre-Settlement)
      }
    }

    // Post Double-Entry Journal for Refund
    const jEntryId = generatePrefixedId('jrn');
    const jEntry: JournalEntry = {
      id: jEntryId,
      businessId,
      branchId: sale.branchId,
      entryNumber: `JRN-RET-${Date.now().toString().slice(-6)}`,
      entryDate: new Date().toISOString().split('T')[0],
      description: `Refund for Sale #${sale.invoiceNumber} (${returnRecord.referenceNumber})`,
      sourceType: 'REFUND',
      sourceId: returnId,
      isPosted: true,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };

    const lines: JournalEntryLine[] = [
      { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: returnsAccId, debit: refundSum.toFixed(4), credit: '0.0000' },
      { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: refundCreditAccId, debit: '0.0000', credit: refundSum.toFixed(4) },
    ];

    // If items were restocked, reverse COGS and increment Merchandise Inventory
    if (totalRestockCost.isGreaterThan(0)) {
      const invAccId = `acc_${businessId}_1050`;
      const cogsAccId = `acc_${businessId}_5010`;
      lines.push(
        { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: invAccId, debit: totalRestockCost.toFixed(4), credit: '0.0000' },
        { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: cogsAccId, debit: '0.0000', credit: totalRestockCost.toFixed(4) }
      );
    }

    domainStore.journalEntries.set(jEntryId, jEntry);
    domainStore.journalLines.set(jEntryId, lines);

    return reply.status(201).send({ return: returnRecord, items: returnItemsList, journalEntry: { ...jEntry, lines } });
  });
};
