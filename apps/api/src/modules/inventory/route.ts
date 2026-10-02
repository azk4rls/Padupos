import type { FastifyPluginAsync } from 'fastify';
import { createStockAdjustmentSchema, createStockTransferSchema } from '@padupos/validation';
import { domainStore } from '../domainStore.js';
import { requirePermission } from '../../plugins/rbac.js';
import { generatePrefixedId, toBN } from '@padupos/shared';
import type { Inventory, InventoryMovement, StockTransfer, StockTransferItem } from '@padupos/types';

export const inventoryRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = [(fastify as any).authenticate, (fastify as any).resolveTenant];

  // 1. Current stock balances
  fastify.get('/inventory', { preHandler: [...auth, requirePermission('inventory.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const branchId = (request.query as any)?.branchId;

    const items: Array<Inventory & { product?: { name: string; sku?: string; unit: string } }> = [];
    for (const inv of domainStore.inventories.values()) {
      if (inv.businessId === businessId && (!branchId || inv.branchId === branchId)) {
        const prod = domainStore.products.get(inv.productId);
        items.push({
          ...inv,
          product: prod ? { name: prod.name, sku: prod.sku, unit: prod.unit } : undefined,
        });
      }
    }
    return { inventory: items };
  });

  // 2. Inventory movements log
  fastify.get('/inventory/movements', { preHandler: [...auth, requirePermission('inventory.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const branchId = (request.query as any)?.branchId;

    const list = domainStore.movements.filter(
      (m) => m.businessId === businessId && (!branchId || m.branchId === branchId)
    );
    return { movements: list.slice(-100).reverse() }; // return recent 100 movements
  });

  // 3. Stock Adjustment
  fastify.post('/inventory/adjust', {
    preHandler: [...auth, requirePermission('inventory.adjust')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const userId = request.user!.id;
    const body = createStockAdjustmentSchema.parse(request.body);

    const invKey = `${body.branchId}:${body.productId}:${body.variantId || ''}`;
    let inv = domainStore.inventories.get(invKey);

    if (!inv) {
      inv = {
        id: generatePrefixedId('inv'),
        businessId,
        branchId: body.branchId,
        productId: body.productId,
        variantId: body.variantId,
        quantity: '0.0000',
        reservedQuantity: '0.0000',
        availableQuantity: '0.0000',
        averageCost: '0.0000',
        minimumStock: '5.0000',
        updatedAt: new Date().toISOString(),
      };
      domainStore.inventories.set(invKey, inv);
    }

    const previousQty = toBN(inv.quantity);
    const adjustedQty = toBN(body.adjustedQuantity);
    const diffQty = adjustedQty.minus(previousQty);

    if (diffQty.isZero()) {
      return reply.status(400).send({
        error: { code: 'NO_CHANGE', message: 'Adjusted quantity equals previous quantity', requestId: request.id },
      });
    }

    const movementType = diffQty.isPositive() ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
    const movementId = generatePrefixedId('mov');

    const movement: InventoryMovement = {
      id: movementId,
      businessId,
      branchId: body.branchId,
      productId: body.productId,
      variantId: body.variantId,
      type: movementType,
      quantity: diffQty.abs().toFixed(4),
      unitCost: inv.averageCost,
      totalCost: diffQty.abs().multipliedBy(toBN(inv.averageCost)).toFixed(4),
      referenceType: 'ADJUSTMENT',
      referenceId: generatePrefixedId('adj'),
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };

    // Update inventory balance
    inv.quantity = adjustedQty.toFixed(4);
    inv.availableQuantity = adjustedQty.minus(toBN(inv.reservedQuantity)).toFixed(4);
    inv.updatedAt = new Date().toISOString();

    domainStore.movements.push(movement);

    return reply.status(200).send({
      message: 'Stock adjusted successfully',
      inventory: inv,
      movement,
    });
  });

  // 4. Inter-Branch Stock Transfer (Atomic Multi-Outlet)
  fastify.post('/inventory/transfer', {
    preHandler: [...auth, requirePermission('inventory.transfer')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const userId = request.user!.id;
    const body = createStockTransferSchema.parse(request.body);

    if (body.sourceBranchId === body.destinationBranchId) {
      return reply.status(400).send({
        error: { code: 'INVALID_TRANSFER', message: 'Source and destination branches cannot be the same', requestId: request.id },
      });
    }

    // Verify source stock availability
    for (const item of body.items) {
      const srcKey = `${body.sourceBranchId}:${item.productId}:${item.variantId || ''}`;
      const srcInv = domainStore.inventories.get(srcKey);
      const reqQty = toBN(item.quantity);
      if (!srcInv || toBN(srcInv.availableQuantity).isLessThan(reqQty)) {
        return reply.status(400).send({
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: `Insufficient stock in source branch for product ${item.productId}`,
            requestId: request.id,
          },
        });
      }
    }

    const transferId = generatePrefixedId('trf');
    const transferRef = `TRF-${Date.now().toString().slice(-6)}`;

    const transferItems: StockTransferItem[] = [];

    // Atomic execution: decrease source, increase destination
    for (const item of body.items) {
      const srcKey = `${body.sourceBranchId}:${item.productId}:${item.variantId || ''}`;
      const dstKey = `${body.destinationBranchId}:${item.productId}:${item.variantId || ''}`;

      const srcInv = domainStore.inventories.get(srcKey)!;
      let dstInv = domainStore.inventories.get(dstKey);

      if (!dstInv) {
        dstInv = {
          id: generatePrefixedId('inv'),
          businessId,
          branchId: body.destinationBranchId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: '0.0000',
          reservedQuantity: '0.0000',
          availableQuantity: '0.0000',
          averageCost: srcInv.averageCost,
          minimumStock: '5.0000',
          updatedAt: new Date().toISOString(),
        };
        domainStore.inventories.set(dstKey, dstInv);
      }

      const qtyBN = toBN(item.quantity);

      // 1. Decrement source
      srcInv.quantity = toBN(srcInv.quantity).minus(qtyBN).toFixed(4);
      srcInv.availableQuantity = toBN(srcInv.availableQuantity).minus(qtyBN).toFixed(4);
      srcInv.updatedAt = new Date().toISOString();

      // 2. Increment destination
      dstInv.quantity = toBN(dstInv.quantity).plus(qtyBN).toFixed(4);
      dstInv.availableQuantity = toBN(dstInv.availableQuantity).plus(qtyBN).toFixed(4);
      dstInv.updatedAt = new Date().toISOString();

      // 3. Movement Out
      domainStore.movements.push({
        id: generatePrefixedId('mov'),
        businessId,
        branchId: body.sourceBranchId,
        productId: item.productId,
        variantId: item.variantId,
        type: 'TRANSFER_OUT',
        quantity: qtyBN.toFixed(4),
        unitCost: srcInv.averageCost,
        totalCost: qtyBN.multipliedBy(toBN(srcInv.averageCost)).toFixed(4),
        referenceType: 'TRANSFER',
        referenceId: transferId,
        createdBy: userId,
        createdAt: new Date().toISOString(),
      });

      // 4. Movement In
      domainStore.movements.push({
        id: generatePrefixedId('mov'),
        businessId,
        branchId: body.destinationBranchId,
        productId: item.productId,
        variantId: item.variantId,
        type: 'TRANSFER_IN',
        quantity: qtyBN.toFixed(4),
        unitCost: srcInv.averageCost,
        totalCost: qtyBN.multipliedBy(toBN(srcInv.averageCost)).toFixed(4),
        referenceType: 'TRANSFER',
        referenceId: transferId,
        createdBy: userId,
        createdAt: new Date().toISOString(),
      });

      transferItems.push({
        id: generatePrefixedId('titem'),
        transferId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: qtyBN.toFixed(4),
        unitCost: srcInv.averageCost,
      });
    }

    const transfer: StockTransfer = {
      id: transferId,
      businessId,
      sourceBranchId: body.sourceBranchId,
      destinationBranchId: body.destinationBranchId,
      referenceNumber: transferRef,
      status: 'RECEIVED',
      requestedBy: userId,
      receivedBy: userId,
      shippedAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      notes: body.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return reply.status(201).send({ transfer, items: transferItems });
  });
};
