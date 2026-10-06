import type { FastifyPluginAsync } from 'fastify';
import {
  createExpenseCategorySchema,
  createExpenseSchema,
  recordReceivablePaymentSchema,
  recordPayablePaymentSchema,
} from '@padupos/validation';
import { domainStore } from '../domainStore.js';
import { requirePermission } from '../../plugins/rbac.js';
import { buildBalanceSheet } from '../accounting/balanceSheetService.js';
import { generatePrefixedId, toBN } from '@padupos/shared';
import type { Expense, ExpenseCategory, JournalEntry, Receivable, Payable } from '@padupos/types';
import BigNumber from 'bignumber.js';

export const financeRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = [(fastify as any).authenticate, (fastify as any).resolveTenant];

  // 1. Expense Categories
  fastify.get('/finance/expense-categories', { preHandler: [...auth, requirePermission('finance.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const categories: ExpenseCategory[] = [];
    for (const c of domainStore.expenseCategories.values()) {
      if (c.businessId === businessId) categories.push(c);
    }
    return { categories };
  });

  fastify.post('/finance/expense-categories', { preHandler: [...auth, requirePermission('finance.create')] }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const body = createExpenseCategorySchema.parse(request.body);

    const categoryId = generatePrefixedId('expcat');
    const category: ExpenseCategory = {
      id: categoryId,
      businessId,
      name: body.name,
      description: body.description,
      createdAt: new Date().toISOString(),
    };

    domainStore.expenseCategories.set(categoryId, category);
    return reply.status(201).send({ category });
  });

  // 2. Expenses (Log & Journal Posting)
  fastify.get('/finance/expenses', { preHandler: [...auth, requirePermission('finance.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const list = domainStore.expenses.filter((e) => e.businessId === businessId);
    return { expenses: list };
  });

  fastify.post('/finance/expenses', { preHandler: [...auth, requirePermission('finance.create')] }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const userId = request.user!.id;
    const body = createExpenseSchema.parse(request.body);

    const expenseId = generatePrefixedId('exp');
    const expense: Expense = {
      id: expenseId,
      businessId,
      branchId: body.branchId,
      categoryId: body.categoryId,
      amount: toBN(body.amount).toFixed(4),
      currency: body.currency,
      paymentMethod: body.paymentMethod,
      receiptUrl: body.receiptUrl,
      description: body.description,
      incurredAt: body.incurredAt,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };

    domainStore.expenses.push(expense);

    // Double-Entry: Debit Operational Expense (6010), Credit Cash on Hand (1010)
    const jEntryId = generatePrefixedId('jrn');
    const jEntry: JournalEntry = {
      id: jEntryId,
      businessId,
      branchId: body.branchId,
      entryNumber: `JRN-EXP-${Date.now().toString().slice(-6)}`,
      entryDate: body.incurredAt.split('T')[0],
      description: `Expense: ${body.description}`,
      sourceType: 'EXPENSE',
      sourceId: expenseId,
      isPosted: true,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };

    const expAccId = `acc_${businessId}_6010`;
    const cashAccId = `acc_${businessId}_1010`;

    domainStore.journalEntries.set(jEntryId, jEntry);
    domainStore.journalLines.set(jEntryId, [
      { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: expAccId, debit: expense.amount, credit: '0.0000' },
      { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: cashAccId, debit: '0.0000', credit: expense.amount },
    ]);

    return reply.status(201).send({ expense });
  });

  // 3. Receivables & Collections
  fastify.get('/finance/receivables', { preHandler: [...auth, requirePermission('finance.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const list: Receivable[] = [];
    for (const r of domainStore.receivables.values()) {
      if (r.businessId === businessId) list.push(r);
    }
    return { receivables: list };
  });

  fastify.post<{ Params: { id: string } }>('/finance/receivables/:id/payments', {
    preHandler: [...auth, requirePermission('finance.update')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const userId = request.user!.id;
    const rec = domainStore.receivables.get(request.params.id);

    if (!rec || rec.businessId !== businessId) {
      return reply.status(404).send({
        error: { code: 'RECEIVABLE_NOT_FOUND', message: 'Receivable not found', requestId: request.id },
      });
    }

    const body = recordReceivablePaymentSchema.parse(request.body);
    const payAmountBN = toBN(body.amount);
    const newPaidBN = toBN(rec.paidAmount).plus(payAmountBN);
    const remainingBN = toBN(rec.originalAmount).minus(newPaidBN);

    rec.paidAmount = newPaidBN.toFixed(4);
    rec.remainingAmount = remainingBN.toFixed(4);
    rec.status = remainingBN.isLessThanOrEqualTo(0) ? 'PAID' : 'PARTIAL';
    rec.updatedAt = new Date().toISOString();

    // Double-Entry: Debit Cash (1010), Credit Accounts Receivable (1040)
    const jEntryId = generatePrefixedId('jrn');
    const cashAccId = `acc_${businessId}_1010`;
    const arAccId = `acc_${businessId}_1040`;

    domainStore.journalEntries.set(jEntryId, {
      id: jEntryId,
      businessId,
      entryNumber: `JRN-RECPAY-${Date.now().toString().slice(-6)}`,
      entryDate: new Date().toISOString().split('T')[0],
      description: `Receivable collection for sale ${rec.saleId}`,
      sourceType: 'RECEIVABLE_PAYMENT',
      sourceId: rec.id,
      isPosted: true,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    });

    domainStore.journalLines.set(jEntryId, [
      { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: cashAccId, debit: payAmountBN.toFixed(4), credit: '0.0000' },
      { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: arAccId, debit: '0.0000', credit: payAmountBN.toFixed(4) },
    ]);

    return { message: 'Receivable payment recorded successfully', receivable: rec };
  });

  // 4. Payables & Supplier Payments
  fastify.get('/finance/payables', { preHandler: [...auth, requirePermission('finance.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const list: Payable[] = [];
    for (const p of domainStore.payables.values()) {
      if (p.businessId === businessId) list.push(p);
    }
    return { payables: list };
  });

  fastify.post<{ Params: { id: string } }>('/finance/payables/:id/payments', {
    preHandler: [...auth, requirePermission('finance.update')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const userId = request.user!.id;
    const payable = domainStore.payables.get(request.params.id);

    if (!payable || payable.businessId !== businessId) {
      return reply.status(404).send({
        error: { code: 'PAYABLE_NOT_FOUND', message: 'Payable not found', requestId: request.id },
      });
    }

    const body = recordPayablePaymentSchema.parse(request.body);
    const payAmountBN = toBN(body.amount);
    const newPaidBN = toBN(payable.paidAmount).plus(payAmountBN);
    const remainingBN = toBN(payable.originalAmount).minus(newPaidBN);

    payable.paidAmount = newPaidBN.toFixed(4);
    payable.remainingAmount = remainingBN.toFixed(4);
    payable.status = remainingBN.isLessThanOrEqualTo(0) ? 'PAID' : 'PARTIAL';
    payable.updatedAt = new Date().toISOString();

    // Double-Entry: Debit Accounts Payable (2010), Credit Cash (1010)
    const jEntryId = generatePrefixedId('jrn');
    const apAccId = `acc_${businessId}_2010`;
    const cashAccId = `acc_${businessId}_1010`;

    domainStore.journalEntries.set(jEntryId, {
      id: jEntryId,
      businessId,
      entryNumber: `JRN-PAYPAY-${Date.now().toString().slice(-6)}`,
      entryDate: new Date().toISOString().split('T')[0],
      description: `Payable disbursement for purchase ${payable.purchaseId}`,
      sourceType: 'PAYABLE_PAYMENT',
      sourceId: payable.id,
      isPosted: true,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    });

    domainStore.journalLines.set(jEntryId, [
      { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: apAccId, debit: payAmountBN.toFixed(4), credit: '0.0000' },
      { id: generatePrefixedId('jln'), journalEntryId: jEntryId, accountId: cashAccId, debit: '0.0000', credit: payAmountBN.toFixed(4) },
    ]);

    return { message: 'Payable payment recorded successfully', payable };
  });

  // 5. Profit & Loss Statement (Real Data Derived)
  fastify.get('/finance/profit-loss', { preHandler: [...auth, requirePermission('finance.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;

    let revenueBN = new BigNumber(0);
    let cogsBN = new BigNumber(0);

    for (const s of domainStore.sales.values()) {
      if (s.businessId === businessId && s.status === 'PAID') {
        revenueBN = revenueBN.plus(toBN(s.totalAmount).minus(toBN(s.taxAmount))); // net revenue
        cogsBN = cogsBN.plus(toBN(s.cogsAmount));
      }
    }

    const grossProfitBN = revenueBN.minus(cogsBN);

    let operatingExpensesBN = new BigNumber(0);
    const expenseBreakdown: Record<string, string> = {};

    for (const e of domainStore.expenses) {
      if (e.businessId === businessId) {
        const amt = toBN(e.amount);
        operatingExpensesBN = operatingExpensesBN.plus(amt);
        const cat = domainStore.expenseCategories.get(e.categoryId)?.name || 'General';
        expenseBreakdown[cat] = toBN(expenseBreakdown[cat] || 0).plus(amt).toFixed(4);
      }
    }

    const operatingProfitBN = grossProfitBN.minus(operatingExpensesBN);

    return {
      revenue: revenueBN.toFixed(4),
      cogs: cogsBN.toFixed(4),
      grossProfit: grossProfitBN.toFixed(4),
      operatingExpenses: operatingExpensesBN.toFixed(4),
      operatingProfit: operatingProfitBN.toFixed(4),
      expenseBreakdown,
      label: 'Estimated Operating Profit (Standard MSME Accounting)',
    };
  });

  // 6. Cash Flow Statement (Cash in vs Cash out)
  fastify.get('/finance/cash-flow', { preHandler: [...auth, requirePermission('finance.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;

    let salesCashIn = new BigNumber(0);
    for (const s of domainStore.sales.values()) {
      if (s.businessId === businessId && s.status === 'PAID') {
        salesCashIn = salesCashIn.plus(toBN(s.totalAmount));
      }
    }

    let operatingCashOut = new BigNumber(0);
    for (const e of domainStore.expenses) {
      if (e.businessId === businessId) {
        operatingCashOut = operatingCashOut.plus(toBN(e.amount));
      }
    }

    let supplierCashOut = new BigNumber(0);
    for (const p of domainStore.purchases.values()) {
      if (p.businessId === businessId && !p.isCredit) {
        supplierCashOut = supplierCashOut.plus(toBN(p.totalAmount));
      }
    }

    const totalInflow = salesCashIn;
    const totalOutflow = operatingCashOut.plus(supplierCashOut);
    const netCashFlow = totalInflow.minus(totalOutflow);

    return {
      inflows: {
        salesReceipts: salesCashIn.toFixed(4),
        totalInflow: totalInflow.toFixed(4),
      },
      outflows: {
        operatingExpenses: operatingCashOut.toFixed(4),
        supplierDisbursements: supplierCashOut.toFixed(4),
        totalOutflow: totalOutflow.toFixed(4),
      },
      netCashFlow: netCashFlow.toFixed(4),
    };
  });

  // Balance Sheet (shared derivation with /accounting/balance-sheet)
  fastify.get('/finance/balance-sheet', { preHandler: [...auth, requirePermission('finance.view')] }, async (request) => {
    return buildBalanceSheet(request.businessContext!.businessId);
  });
};
