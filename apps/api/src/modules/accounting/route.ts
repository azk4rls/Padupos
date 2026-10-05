import type { FastifyPluginAsync } from 'fastify';
import { domainStore } from '../domainStore.js';
import { requirePermission } from '../../plugins/rbac.js';
import { generatePrefixedId, toBN } from '@padupos/shared';
import { createAccountingPeriodSchema } from '@padupos/validation';
import type { Account, AccountingPeriod, JournalEntry, JournalEntryLine } from '@padupos/types';
import BigNumber from 'bignumber.js';

export const accountingRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = [(fastify as any).authenticate, (fastify as any).resolveTenant];

  // 1. Chart of Accounts
  fastify.get('/accounting/accounts', { preHandler: [...auth, requirePermission('accounting.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const list: Account[] = [];
    for (const a of domainStore.accounts.values()) {
      if (a.businessId === businessId) list.push(a);
    }
    return { accounts: list };
  });

  // 2. Accounting Periods
  fastify.get('/accounting/periods', { preHandler: [...auth, requirePermission('accounting.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const periods: AccountingPeriod[] = [];
    for (const p of domainStore.accountingPeriods.values()) {
      if (p.businessId === businessId) periods.push(p);
    }
    return { periods };
  });

  fastify.post('/accounting/periods', { preHandler: [...auth, requirePermission('accounting.manage')] }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const body = createAccountingPeriodSchema.parse(request.body);

    const periodId = generatePrefixedId('prd');
    const period: AccountingPeriod = {
      id: periodId,
      businessId,
      name: body.name,
      startDate: body.startDate,
      endDate: body.endDate,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    };

    domainStore.accountingPeriods.set(periodId, period);
    return reply.status(201).send({ period });
  });

  fastify.post<{ Params: { id: string } }>('/accounting/periods/:id/close', {
    preHandler: [...auth, requirePermission('accounting.manage')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const userId = request.user!.id;
    const period = domainStore.accountingPeriods.get(request.params.id);

    if (!period || period.businessId !== businessId) {
      return reply.status(404).send({
        error: { code: 'PERIOD_NOT_FOUND', message: 'Accounting period not found', requestId: request.id },
      });
    }

    period.status = 'CLOSED';
    period.closedAt = new Date().toISOString();
    period.closedBy = userId;

    return { message: 'Accounting period closed successfully', period };
  });

  // 3. Journal Entries & Lines
  fastify.get('/accounting/journals', { preHandler: [...auth, requirePermission('accounting.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const entries: Array<JournalEntry & { lines: JournalEntryLine[] }> = [];

    for (const j of domainStore.journalEntries.values()) {
      if (j.businessId === businessId) {
        const lines = domainStore.journalLines.get(j.id) || [];
        entries.push({ ...j, lines });
      }
    }

    return { journalEntries: entries };
  });

  // 4. Manual Journal Entry Creation
  fastify.post('/accounting/journals', {
    preHandler: [...auth, requirePermission('accounting.manage')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const userId = request.user!.id;
    const body = request.body as {
      entryDate: string;
      description: string;
      branchId?: string;
      lines: Array<{ accountId: string; description?: string; debit: string; credit: string }>;
    };

    if (!body.entryDate || !body.description || !Array.isArray(body.lines) || body.lines.length < 2) {
      return reply.status(400).send({
        error: { code: 'INVALID_JOURNAL', message: 'Journal entry must have entryDate, description, and at least 2 lines', requestId: request.id },
      });
    }

    // Check closed accounting period
    if (domainStore.isDateInClosedPeriod(businessId, body.entryDate)) {
      return reply.status(400).send({
        error: { code: 'CLOSED_PERIOD', message: 'Cannot post journal entries into a closed accounting period', requestId: request.id },
      });
    }

    // Validate debit === credit
    let totalDebit = new BigNumber(0);
    let totalCredit = new BigNumber(0);
    for (const line of body.lines) {
      totalDebit = totalDebit.plus(toBN(line.debit || 0));
      totalCredit = totalCredit.plus(toBN(line.credit || 0));
    }

    if (!totalDebit.isEqualTo(totalCredit)) {
      return reply.status(400).send({
        error: { code: 'UNBALANCED_JOURNAL', message: 'Total debits must equal total credits', requestId: request.id },
      });
    }

    const jEntryId = generatePrefixedId('jrn');
    const jEntry: JournalEntry = {
      id: jEntryId,
      businessId,
      branchId: body.branchId,
      entryNumber: `JRN-MAN-${Date.now().toString().slice(-6)}`,
      entryDate: body.entryDate.split('T')[0],
      description: body.description,
      sourceType: 'MANUAL',
      sourceId: undefined,
      isPosted: true,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };

    const lines: JournalEntryLine[] = body.lines.map((l) => ({
      id: generatePrefixedId('jln'),
      journalEntryId: jEntryId,
      accountId: l.accountId,
      description: l.description,
      debit: toBN(l.debit || 0).toFixed(4),
      credit: toBN(l.credit || 0).toFixed(4),
    }));

    domainStore.journalEntries.set(jEntryId, jEntry);
    domainStore.journalLines.set(jEntryId, lines);

    return reply.status(201).send({ journalEntry: { ...jEntry, lines } });
  });

  // 5. Strict Immutability: Disallow direct editing or deletion of posted journals
  fastify.put<{ Params: { id: string } }>('/accounting/journals/:id', {
    preHandler: [...auth, requirePermission('accounting.manage')],
  }, async (request, reply) => {
    return reply.status(400).send({
      error: {
        code: 'JOURNAL_IS_IMMUTABLE',
        message: 'Posted journal entries are strictly immutable. Corrections must be performed via reversal or adjustment entries.',
        requestId: request.id,
      },
    });
  });

  fastify.delete<{ Params: { id: string } }>('/accounting/journals/:id', {
    preHandler: [...auth, requirePermission('accounting.manage')],
  }, async (request, reply) => {
    return reply.status(400).send({
      error: {
        code: 'JOURNAL_IS_IMMUTABLE',
        message: 'Posted journal entries cannot be deleted. Corrections must use reversal entries.',
        requestId: request.id,
      },
    });
  });

  // 6. Journal Entry Reversal Flow (Historical Immutability Preservation)
  fastify.post<{ Params: { id: string } }>('/accounting/journals/:id/reverse', {
    preHandler: [...auth, requirePermission('accounting.manage')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const userId = request.user!.id;
    const originalEntry = domainStore.journalEntries.get(request.params.id);

    if (!originalEntry || originalEntry.businessId !== businessId) {
      return reply.status(404).send({
        error: { code: 'JOURNAL_NOT_FOUND', message: 'Original journal entry not found', requestId: request.id },
      });
    }

    // Check if journal has already been reversed
    for (const j of domainStore.journalEntries.values()) {
      if (j.businessId === businessId && j.sourceType === 'REVERSAL' && j.sourceId === originalEntry.id) {
        return reply.status(400).send({
          error: { code: 'ALREADY_REVERSED', message: 'Journal entry has already been reversed', requestId: request.id },
        });
      }
    }

    // Check if original journal belongs to a closed period
    if (domainStore.isDateInClosedPeriod(businessId, originalEntry.entryDate)) {
      return reply.status(400).send({
        error: { code: 'CLOSED_PERIOD', message: 'Cannot reverse journals belonging to a closed accounting period', requestId: request.id },
      });
    }

    const originalLines = domainStore.journalLines.get(originalEntry.id) || [];
    if (originalLines.length === 0) {
      return reply.status(422).send({
        error: { code: 'NO_LINES_TO_REVERSE', message: 'Journal entry has no lines to reverse', requestId: request.id },
      });
    }

    const reversalEntryId = generatePrefixedId('jrn');
    const reversalEntry: JournalEntry = {
      id: reversalEntryId,
      businessId,
      branchId: originalEntry.branchId,
      entryNumber: `REV-${originalEntry.entryNumber}`,
      entryDate: new Date().toISOString().split('T')[0],
      description: `Reversal of ${originalEntry.entryNumber}: ${originalEntry.description}`,
      sourceType: 'REVERSAL',
      sourceId: originalEntry.id,
      isPosted: true,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };

    // Invert lines: swap debits and credits
    const reversalLines: JournalEntryLine[] = originalLines.map((line) => ({
      id: generatePrefixedId('jln'),
      journalEntryId: reversalEntryId,
      accountId: line.accountId,
      description: `Reversal of line ${line.id}`,
      debit: line.credit, // Invert
      credit: line.debit, // Invert
    }));

    domainStore.journalEntries.set(reversalEntryId, reversalEntry);
    domainStore.journalLines.set(reversalEntryId, reversalLines);

    return reply.status(201).send({
      message: 'Journal entry reversed successfully',
      reversalEntry: {
        ...reversalEntry,
        lines: reversalLines,
      },
    });
  });

  // 6. Trial Balance Verification: Verifies sum(debits) === sum(credits)
  fastify.get('/accounting/trial-balance', { preHandler: [...auth, requirePermission('accounting.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;

    let totalDebitSum = new BigNumber(0);
    let totalCreditSum = new BigNumber(0);
    const accountBalances: Record<string, { code: string; name: string; type: string; debit: string; credit: string }> = {};

    for (const j of domainStore.journalEntries.values()) {
      if (j.businessId === businessId && j.isPosted) {
        const lines = domainStore.journalLines.get(j.id) || [];
        for (const line of lines) {
          const acc = domainStore.accounts.get(line.accountId);
          if (!acc) continue;

          if (!accountBalances[acc.id]) {
            accountBalances[acc.id] = {
              code: acc.code,
              name: acc.name,
              type: acc.type,
              debit: '0.0000',
              credit: '0.0000',
            };
          }

          const curDebit = toBN(accountBalances[acc.id].debit).plus(toBN(line.debit));
          const curCredit = toBN(accountBalances[acc.id].credit).plus(toBN(line.credit));

          accountBalances[acc.id].debit = curDebit.toFixed(4);
          accountBalances[acc.id].credit = curCredit.toFixed(4);

          totalDebitSum = totalDebitSum.plus(toBN(line.debit));
          totalCreditSum = totalCreditSum.plus(toBN(line.credit));
        }
      }
    }

    const isBalanced = totalDebitSum.isEqualTo(totalCreditSum);

    return {
      isBalanced,
      totalDebits: totalDebitSum.toFixed(4),
      totalCredits: totalCreditSum.toFixed(4),
      difference: totalDebitSum.minus(totalCreditSum).toFixed(4),
      accounts: Object.values(accountBalances),
    };
  });

  // 6b. Balance Sheet
  fastify.get('/accounting/balance-sheet', { preHandler: [...auth, requirePermission('accounting.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const accountBalances: Record<string, { code: string; name: string; type: string; debit: string; credit: string }> = {};
    for (const j of domainStore.journalEntries.values()) {
      if (j.businessId === businessId && j.isPosted) {
        const lines = domainStore.journalLines.get(j.id) || [];
        for (const line of lines) {
          const acc = domainStore.accounts.get(line.accountId);
          if (!acc) continue;
          if (!accountBalances[acc.id]) {
            accountBalances[acc.id] = { code: acc.code, name: acc.name, type: acc.type, debit: '0.0000', credit: '0.0000' };
          }
          accountBalances[acc.id].debit = toBN(accountBalances[acc.id].debit).plus(toBN(line.debit)).toFixed(4);
          accountBalances[acc.id].credit = toBN(accountBalances[acc.id].credit).plus(toBN(line.credit)).toFixed(4);
        }
      }
    }
    const format = (d: string, c: string, type: string) => {
      const db = toBN(d); const cr = toBN(c);
      if (type === 'ASSET' || type === 'EXPENSE') return db.minus(cr).toFixed(4);
      return cr.minus(db).toFixed(4);
    };
    let totalAssets = new BigNumber(0), totalLiabilities = new BigNumber(0), totalEquity = new BigNumber(0);
    const assets: any[] = [], liabilities: any[] = [], equity: any[] = [];
    for (const bal of Object.values(accountBalances)) {
      const amount = format(bal.debit, bal.credit, bal.type);
      const amtBN = toBN(amount);
      if (bal.type === 'ASSET' && amtBN.isGreaterThan(0)) {
        assets.push({ code: bal.code, name: bal.name, type: bal.type, amount: amtBN.abs().toFixed(4) });
        totalAssets = totalAssets.plus(amtBN.abs());
      } else if (bal.type === 'LIABILITY' && amtBN.isGreaterThan(0)) {
        liabilities.push({ code: bal.code, name: bal.name, type: bal.type, amount: amtBN.abs().toFixed(4) });
        totalLiabilities = totalLiabilities.plus(amtBN.abs());
      } else if (bal.type === 'EQUITY' && amtBN.isGreaterThan(0)) {
        equity.push({ code: bal.code, name: bal.name, type: bal.type, amount: amtBN.abs().toFixed(4) });
        totalEquity = totalEquity.plus(amtBN.abs());
      }
    }
    const assetsTotal = totalAssets; const liabEquityTotal = totalLiabilities.plus(totalEquity);
    const isBalanced = assetsTotal.isEqualTo(liabEquityTotal);
    return {
      assets, liabilities, equity,
      totals: { assets: assetsTotal.toFixed(4), liabilities: totalLiabilities.toFixed(4), equity: totalEquity.toFixed(4), liabilitiesPlusEquity: liabEquityTotal.toFixed(4) },
      balanceCheck: { balanced: isBalanced, difference: assetsTotal.minus(liabEquityTotal).toFixed(4) }
    };
  });
};
