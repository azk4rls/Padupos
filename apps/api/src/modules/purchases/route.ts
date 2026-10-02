import type { FastifyPluginAsync } from 'fastify';
import { createSupplierSchema, createPurchaseSchema } from '@padupos/validation';
import { domainStore } from '../domainStore.js';
import { requirePermission } from '../../plugins/rbac.js';
import {
  calculateWeightedAverageCost,
  generatePrefixedId,
  toBN,
} from '@padupos/shared';
import type { Supplier, Purchase, PurchaseItem, Payable, JournalEntry, Inventory } from '@padupos/types';
import BigNumber from 'bignumber.js';

export const purchasesRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = [(fastify as any).authenticate, (fastify as any).resolveTenant];

  // 1. Suppliers
  fastify.get('/suppliers', { preHandler: [...auth, requirePermission('suppliers.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const list: Supplier[] = [];
    for (const s of domainStore.suppliers.values()) {
      if (s.businessId === businessId) list.push(s);
    }
    return { suppliers: list };
  });

  fastify.post('/suppliers', { preHandler: [...auth, requirePermission('suppliers.manage')] }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const body = createSupplierSchema.parse(request.body);

    const supplierId = generatePrefixedId('sup');
    const supplier: Supplier = {
      id: supplierId,
      businessId,
      name: body.name,
      contactPerson: body.contactPerson,
      phone: body.phone,
      email: body.email,
      address: body.address,
      taxId: body.taxId,
      notes: body.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    domainStore.suppliers.set(supplierId, supplier);
    return reply.status(201).send({ supplier });
  });

  // 2. Purchases & Stock Receipt with WAC Update
  fastify.get('/purchases', { preHandler: [...auth, requirePermission('purchases.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const list: Purchase[] = [];
    for (const p of domainStore.purchases.values()) {
      if (p.businessId === businessId) list.push(p);
    }
    return { purchases: list };
  });

  fastify.post('/purchases', { preHandler: [...auth, requirePermission('purchases.create')] }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const userId = request.user!.id;
    const body = createPurchaseSchema.parse(request.body);

    const purchaseId = generatePrefixedId('pch');
    let subtotalBN = new BigNumber(0);
    const purchaseItemsList: PurchaseItem[] = [];

    // Process each item: update inventory & calculate new WAC
    for (const item of body.items) {
      const qtyBN = toBN(item.quantity);
      const unitCostBN = toBN(item.unitCost);
      const itemSubtotal = qtyBN.multipliedBy(unitCostBN);
      subtotalBN = subtotalBN.plus(itemSubtotal);

      const invKey = `${body.branchId}:${item.productId}:${item.variantId || ''}`;
      let inv = domainStore.inventories.get(invKey);

      if (!inv) {
        inv = {
          id: generatePrefixedId('inv'),
          businessId,
          branchId: body.branchId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: '0.0000',
          reservedQuantity: '0.0000',
          availableQuantity: '0.0000',
          averageCost: item.unitCost,
          minimumStock: '5.0000',
          updatedAt: new Date().toISOString(),
        };
        domainStore.inventories.set(invKey, inv);
      }

      // Calculate new Weighted Average Cost (WAC)
      const newAverageCost = calculateWeightedAverageCost({
        oldQuantity: inv.quantity,
        oldAverageCost: inv.averageCost,
        newQuantity: item.quantity,
        newUnitCost: item.unitCost,
      });

      // Increment inventory balance
      inv.quantity = toBN(inv.quantity).plus(qtyBN).toFixed(4);
      inv.availableQuantity = toBN(inv.availableQuantity).plus(qtyBN).toFixed(4);
      inv.averageCost = newAverageCost;
      inv.updatedAt = new Date().toISOString();

      // Record movement
      domainStore.movements.push({
        id: generatePrefixedId('mov'),
        businessId,
        branchId: body.branchId,
        productId: item.productId,
        variantId: item.variantId,
        type: 'PURCHASE_IN',
        quantity: qtyBN.toFixed(4),
        unitCost: item.unitCost,
        totalCost: itemSubtotal.toFixed(4),
        referenceType: 'PURCHASE',
        referenceId: purchaseId,
        createdBy: userId,
        createdAt: new Date().toISOString(),
      });

      purchaseItemsList.push({
        id: generatePrefixedId('pitem'),
        purchaseId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: qtyBN.toFixed(4),
        unitCost: toBN(item.unitCost).toFixed(4),
        subtotal: itemSubtotal.toFixed(4),
      });
    }

    const taxBN = toBN(body.taxAmount || 0);
    const totalAmountBN = subtotalBN.plus(taxBN);

    const biz = domainStore.businesses.get(businessId)!;
    const currency = biz.baseCurrency;

    const purchase: Purchase = {
      id: purchaseId,
      businessId,
      branchId: body.branchId,
      supplierId: body.supplierId,
      invoiceNumber: body.invoiceNumber,
      subtotal: subtotalBN.toFixed(4),
      taxAmount: taxBN.toFixed(4),
      totalAmount: totalAmountBN.toFixed(4),
      currency,
      isCredit: body.isCredit,
      dueDate: body.dueDate,
      purchasedAt: body.purchasedAt,
      receivedBy: userId,
      createdAt: new Date().toISOString(),
    };

    domainStore.purchases.set(purchaseId, purchase);

    // If Credit purchase, create Payable record
    if (body.isCredit) {
      const payableId = generatePrefixedId('payb');
      const payable: Payable = {
        id: payableId,
        businessId,
        supplierId: body.supplierId,
        purchaseId,
        originalAmount: totalAmountBN.toFixed(4),
        paidAmount: '0.0000',
        remainingAmount: totalAmountBN.toFixed(4),
        dueDate: body.dueDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      domainStore.payables.set(payableId, payable);
    }

    // Double-Entry:
    // Debit Merchandise Inventory (1050)
    // Credit Accounts Payable (2010) or Cash (1010)
    const jEntryId = generatePrefixedId('jrn');
    const invAccId = `acc_${businessId}_1050`;
    const creditAccId = body.isCredit ? `acc_${businessId}_2010` : `acc_${businessId}_1010`;

    const jEntry: JournalEntry = {
      id: jEntryId,
      businessId,
      branchId: body.branchId,
      entryNumber: `JRN-PCH-${body.invoiceNumber}`,
      entryDate: body.purchasedAt.split('T')[0],
      description: `Stock Purchase #${body.invoiceNumber}`,
      sourceType: 'PURCHASE',
      sourceId: purchaseId,
      isPosted: true,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };

    domainStore.journalEntries.set(jEntryId, jEntry);
    domainStore.journalLines.set(jEntryId, [
      { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: invAccId, debit: totalAmountBN.toFixed(4), credit: '0.0000' },
      { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: creditAccId, debit: '0.0000', credit: totalAmountBN.toFixed(4) },
    ]);

    return reply.status(201).send({
      purchase,
      items: purchaseItemsList,
    });
  });
};
