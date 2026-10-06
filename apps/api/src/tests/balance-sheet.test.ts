import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { domainStore } from '../modules/domainStore.js';
import { clearMemberDirectoryForTesting, registerMemberForTesting } from '../plugins/rbac.js';
import type { JournalEntry, JournalEntryLine } from '@padupos/types';

/**
 * Phase 6 Balance Sheet regression suite.
 *
 * Covers the twelve acceptance dimensions required to call Phase 6 verified:
 * empty business, assets, liabilities, equity, revenue/current-period-earnings
 * treatment, the accounting equation, exact decimals, posted inclusion, unposted
 * exclusion, tenant isolation, authorization/business scope, and agreement with
 * the Trial Balance.
 *
 * These tests seed the ledger directly so that each accounting invariant can be
 * asserted against a hand-computed expectation, and separately exercise the HTTP
 * surface for the auth/tenant dimensions.
 */

const app = buildApp({ disableRateLimit: true });

const OWNER_A = 'test_bs_owner_a';
const OWNER_B = 'test_bs_owner_b';
const CASHIER_A = 'test_bs_cashier_a';

interface LedgerSpec {
  businessId: string;
  entryNumber: string;
  entryDate: string;
  isPosted?: boolean;
  lines: Array<{ code: string; debit: string; credit: string }>;
}

function seedJournal(spec: LedgerSpec): string {
  const id = `jrn_${spec.businessId}_${spec.entryNumber}`;
  const entry: JournalEntry = {
    id,
    businessId: spec.businessId,
    branchId: undefined,
    entryNumber: spec.entryNumber,
    entryDate: spec.entryDate,
    description: spec.entryNumber,
    sourceType: 'MANUAL',
    isPosted: spec.isPosted ?? true,
    createdBy: 'seed',
    createdAt: `${spec.entryDate}T00:00:00.000Z`,
  };

  const lines: JournalEntryLine[] = spec.lines.map((line, index) => ({
    id: `${id}_l${index}`,
    journalEntryId: id,
    accountId: `acc_${spec.businessId}_${line.code}`,
    description: line.code,
    debit: line.debit,
    credit: line.credit,
  }));

  domainStore.journalEntries.set(id, entry);
  domainStore.journalLines.set(id, lines);
  return id;
}

function accountId(businessId: string, code: string): string {
  return `acc_${businessId}_${code}`;
}

function headers(userId: string, businessId: string) {
  return {
    authorization: `Bearer ${userId}`,
    'x-business-id': businessId,
  };
}

const BIZ_A = 'bs_business_a';
const BIZ_B = 'bs_business_b';

beforeEach(() => {
  domainStore.clearAll();
  clearMemberDirectoryForTesting();

  domainStore.businesses.set(BIZ_A, {
    id: BIZ_A,
    ownerUserId: 'bs_owner_a',
    name: 'Balance Sheet Co A',
    businessType: 'RETAIL',
    countryCode: 'ID',
    currency: 'IDR',
    locale: 'id-ID',
    timezone: 'Asia/Jakarta',
    fiscalYearStartMonth: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as never);
  domainStore.businesses.set(BIZ_B, {
    id: BIZ_B,
    ownerUserId: 'bs_owner_b',
    name: 'Balance Sheet Co B',
    businessType: 'RETAIL',
    countryCode: 'ID',
    currency: 'IDR',
    locale: 'id-ID',
    timezone: 'Asia/Jakarta',
    fiscalYearStartMonth: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as never);

  domainStore.initializeDefaultAccounts(BIZ_A, 'IDR');
  domainStore.initializeDefaultAccounts(BIZ_B, 'IDR');

  registerMemberForTesting(BIZ_A, 'bs_cashier_a', 'CASHIER');
});

describe('Phase 6 — Balance Sheet: 1. empty business', () => {
  it('returns zeroed sections for a business with no ledger activity', async () => {
    const emptyBusiness = 'bs_business_empty';
    domainStore.businesses.set(emptyBusiness, {
      id: emptyBusiness,
      ownerUserId: 'bs_owner_empty',
      name: 'Never Traded Ltd',
      businessType: 'RETAIL',
      countryCode: 'ID',
      currency: 'IDR',
      locale: 'id-ID',
      timezone: 'Asia/Jakarta',
      fiscalYearStartMonth: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as never);
    domainStore.initializeDefaultAccounts(emptyBusiness, 'IDR');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/balance-sheet',
      headers: headers('test_bs_owner_empty', emptyBusiness),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.assets).toEqual([]);
    expect(body.liabilities).toEqual([]);
    expect(body.equity).toEqual([]);
    expect(body.currentPeriodEarnings).toEqual({
      revenue: '0.0000',
      expenses: '0.0000',
      net: '0.0000',
    });
    expect(body.totals.assets).toBe('0.0000');
    expect(body.totals.liabilitiesPlusEquity).toBe('0.0000');
    expect(body.balanceCheck.balanced).toBe(true);
    expect(body.balanceCheck.difference).toBe('0.0000');
  });
});

describe('Phase 6 — Balance Sheet: 2. asset balances', () => {
  it('reports asset accounts on their natural debit balance', async () => {
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-ASSET',
      entryDate: '2026-10-01',
      lines: [
        { code: '1010', debit: '1500.5000', credit: '0.0000' },
        { code: '1050', debit: '999.9999', credit: '0.0000' },
        { code: '3010', debit: '0.0000', credit: '2500.4999' },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/balance-sheet',
      headers: headers(OWNER_A, BIZ_A),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const cash = body.assets.find((line: { code: string }) => line.code === '1010');
    const inventory = body.assets.find((line: { code: string }) => line.code === '1050');

    expect(cash.amount).toBe('1500.5000');
    expect(inventory.amount).toBe('999.9999');
    expect(body.totals.assets).toBe('2500.4999');
    // 999.9999 + 1500.5000 must not be collapsed by binary floating point.
    expect(body.balanceCheck.balanced).toBe(true);
  });

  it('nets a contra-asset (credit balance) to a negative line rather than hiding it', async () => {
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-CONTRA',
      entryDate: '2026-10-01',
      lines: [
        { code: '1010', debit: '500.0000', credit: '0.0000' },
        { code: '1050', debit: '0.0000', credit: '120.0000' },
        { code: '3010', debit: '0.0000', credit: '380.0000' },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/balance-sheet',
      headers: headers(OWNER_A, BIZ_A),
    });

    const body = res.json();
    const inventory = body.assets.find((line: { code: string }) => line.code === '1050');
    expect(inventory.amount).toBe('-120.0000');
    expect(body.totals.assets).toBe('380.0000');
    expect(body.balanceCheck.balanced).toBe(true);
  });
});

describe('Phase 6 — Balance Sheet: 3. liability balances', () => {
  it('reports liability accounts on their natural credit balance', async () => {
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-LIAB',
      entryDate: '2026-10-02',
      lines: [
        { code: '1010', debit: '9201.0000', credit: '0.0000' },
        { code: '2010', debit: '0.0000', credit: '4000.0001' },
        { code: '2020', debit: '0.0000', credit: '600.4999' },
        { code: '3010', debit: '0.0000', credit: '4600.5000' },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/finance/balance-sheet',
      headers: headers(OWNER_A, BIZ_A),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const payables = body.liabilities.find((line: { code: string }) => line.code === '2010');
    const tax = body.liabilities.find((line: { code: string }) => line.code === '2020');

    expect(payables.amount).toBe('4000.0001');
    expect(tax.amount).toBe('600.4999');
    expect(body.totals.assets).toBe('9201.0000');
    expect(body.totals.liabilities).toBe('4600.5000');
    expect(body.totals.retainedEquity).toBe('4600.5000');
    expect(body.totals.liabilitiesPlusEquity).toBe('9201.0000');
    expect(body.balanceCheck.balanced).toBe(true);
  });
});

describe('Phase 6 — Balance Sheet: 4. equity balances', () => {
  it('separates retained equity from current-period earnings', async () => {
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-EQUITY',
      entryDate: '2026-10-03',
      lines: [
        { code: '1010', debit: '12500.0000', credit: '0.0000' },
        { code: '3010', debit: '0.0000', credit: '10000.0000' },
        { code: '3020', debit: '0.0000', credit: '2500.0000' },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/balance-sheet',
      headers: headers(OWNER_A, BIZ_A),
    });

    const body = res.json();
    expect(body.equity.map((line: { code: string }) => line.code)).toEqual(['3010', '3020']);
    expect(body.totals.assets).toBe('12500.0000');
    expect(body.totals.retainedEquity).toBe('12500.0000');
    expect(body.totals.currentPeriodEarnings).toBe('0.0000');
    expect(body.totals.equity).toBe('12500.0000');
    expect(body.balanceCheck.balanced).toBe(true);
  });
});

describe('Phase 6 — Balance Sheet: 5. revenue and current-period earnings', () => {
  it('closes revenue and expense into current-period earnings inside total equity', async () => {
    // Cash sale of 10,000 with 4,000 COGS => net profit 6,000.
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-SALE',
      entryDate: '2026-10-04',
      lines: [
        { code: '1010', debit: '10000.0000', credit: '0.0000' },
        { code: '4010', debit: '0.0000', credit: '10000.0000' },
      ],
    });
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-COGS',
      entryDate: '2026-10-04',
      lines: [
        { code: '5010', debit: '4000.0000', credit: '0.0000' },
        { code: '1050', debit: '0.0000', credit: '4000.0000' },
      ],
    });
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-OPEX',
      entryDate: '2026-10-04',
      lines: [
        { code: '6010', debit: '1500.0000', credit: '0.0000' },
        { code: '1010', debit: '0.0000', credit: '1500.0000' },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/balance-sheet',
      headers: headers(OWNER_A, BIZ_A),
    });

    const body = res.json();
    expect(body.currentPeriodEarnings.revenue).toBe('10000.0000');
    expect(body.currentPeriodEarnings.expenses).toBe('5500.0000');
    expect(body.currentPeriodEarnings.net).toBe('4500.0000');
    // Total equity must include current-period earnings, otherwise the equation fails.
    expect(body.totals.equity).toBe('4500.0000');
    expect(body.totals.liabilitiesPlusEquity).toBe('4500.0000');
    expect(body.balanceCheck.balanced).toBe(true);
  });

  it('nets contra-revenue into total revenue', async () => {
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-DISCOUNT',
      entryDate: '2026-10-04',
      lines: [
        { code: '1010', debit: '900.0000', credit: '0.0000' },
        { code: '4010', debit: '0.0000', credit: '1000.0000' },
        { code: '4020', debit: '100.0000', credit: '0.0000' },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/balance-sheet',
      headers: headers(OWNER_A, BIZ_A),
    });

    const body = res.json();
    expect(body.currentPeriodEarnings.revenue).toBe('900.0000');
    expect(body.currentPeriodEarnings.net).toBe('900.0000');
    expect(body.balanceCheck.balanced).toBe(true);
  });

  it('reports a loss as negative current-period earnings while still balancing', async () => {
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-LOSS',
      entryDate: '2026-10-04',
      lines: [
        { code: '6010', debit: '2500.0000', credit: '0.0000' },
        { code: '1010', debit: '0.0000', credit: '2500.0000' },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/balance-sheet',
      headers: headers(OWNER_A, BIZ_A),
    });

    const body = res.json();
    expect(body.currentPeriodEarnings.net).toBe('-2500.0000');
    expect(body.totals.equity).toBe('-2500.0000');
    expect(body.totals.assets).toBe('-2500.0000');
    expect(body.balanceCheck.balanced).toBe(true);
  });
});

describe('Phase 6 — Balance Sheet: 6. accounting equation', () => {
  it('satisfies Assets = Liabilities + Equity across a mixed ledger', async () => {
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-MIX-1',
      entryDate: '2026-10-05',
      lines: [
        { code: '1010', debit: '84953.0000', credit: '0.0000' },
        { code: '2010', debit: '0.0000', credit: '12000.5000' },
        { code: '3010', debit: '0.0000', credit: '50000.0000' },
        { code: '4010', debit: '0.0000', credit: '30000.0000' },
        { code: '6010', debit: '7047.5000', credit: '0.0000' },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/balance-sheet',
      headers: headers(OWNER_A, BIZ_A),
    });

    const body = res.json();
    expect(body.balanceCheck.difference).toBe('0.0000');
    expect(body.reportingEquation.satisfied).toBe(true);
    expect(body.reportingEquation.left).toBe(body.reportingEquation.right);
    expect(body.totals.assets).toBe('84953.0000');
    expect(body.totals.liabilities).toBe('12000.5000');
    expect(body.totals.retainedEquity).toBe('50000.0000');
    expect(body.totals.currentPeriodEarnings).toBe('22952.5000');
    expect(body.totals.equity).toBe('72952.5000');
    expect(body.totals.liabilitiesPlusEquity).toBe('84953.0000');
    expect(body.balanceCheck.balanced).toBe(true);
  });
});

describe('Phase 6 — Balance Sheet: 7. exact decimals', () => {
  it('preserves four-decimal precision that IEEE-754 cannot represent', async () => {
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-PRECISE',
      entryDate: '2026-10-06',
      lines: [
        { code: '1010', debit: '0.1000', credit: '0.0000' },
        { code: '3010', debit: '0.0000', credit: '0.1000' },
      ],
    });
    // 0.1 + 0.2 !== 0.3 in binary floating point; the ledger must not inherit that.
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-PRECISE-2',
      entryDate: '2026-10-06',
      lines: [
        { code: '1010', debit: '0.2000', credit: '0.0000' },
        { code: '3010', debit: '0.0000', credit: '0.2000' },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/balance-sheet',
      headers: headers(OWNER_A, BIZ_A),
    });

    const body = res.json();
    expect(body.totals.assets).toBe('0.3000');
    expect(body.totals.equity).toBe('0.3000');
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(body.balanceCheck.balanced).toBe(true);
  });

  it('keeps 4-decimal scale on every emitted amount', async () => {
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-SCALE',
      entryDate: '2026-10-06',
      lines: [
        { code: '1010', debit: '7.5', credit: '0' },
        { code: '3010', debit: '0', credit: '7.5' },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/balance-sheet',
      headers: headers(OWNER_A, BIZ_A),
    });

    const body = res.json();
    expect(body.assets[0].amount).toBe('7.5000');
    expect(body.totals.assets).toBe('7.5000');
  });
});

describe('Phase 6 — Balance Sheet: 8. posted journals included', () => {
  it('includes entries posted through the real journal API', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/accounting/journals',
      headers: headers(OWNER_A, BIZ_A),
      payload: {
        entryDate: '2026-10-07',
        description: 'Owner funding',
        lines: [
          { accountId: accountId(BIZ_A, '1010'), debit: '12345.6789', credit: '0.0000' },
          { accountId: accountId(BIZ_A, '3010'), debit: '0.0000', credit: '12345.6789' },
        ],
      },
    });
    expect(res.statusCode).toBe(201);

    const sheet = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/balance-sheet',
      headers: headers(OWNER_A, BIZ_A),
    });

    const body = sheet.json();
    expect(body.totals.assets).toBe('12345.6789');
    expect(body.totals.retainedEquity).toBe('12345.6789');
    expect(body.balanceCheck.balanced).toBe(true);
  });
});

describe('Phase 6 — Balance Sheet: 9. unposted journals excluded', () => {
  it('ignores unposted entries entirely', async () => {
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-POSTED',
      entryDate: '2026-10-08',
      lines: [
        { code: '1010', debit: '500.0000', credit: '0.0000' },
        { code: '3010', debit: '0.0000', credit: '500.0000' },
      ],
    });
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-DRAFT',
      entryDate: '2026-10-08',
      isPosted: false,
      lines: [
        { code: '1010', debit: '9999.0000', credit: '0.0000' },
        { code: '3010', debit: '0.0000', credit: '9999.0000' },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/balance-sheet',
      headers: headers(OWNER_A, BIZ_A),
    });

    const body = res.json();
    expect(body.totals.assets).toBe('500.0000');
    expect(body.totals.equity).toBe('500.0000');
    expect(body.balanceCheck.balanced).toBe(true);
  });

  it('excludes unposted entries that would otherwise break the equation', async () => {
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-UNBALANCED-DRAFT',
      entryDate: '2026-10-08',
      isPosted: false,
      lines: [
        { code: '1010', debit: '1000.0000', credit: '0.0000' },
        { code: '3010', debit: '0.0000', credit: '400.0000' },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/balance-sheet',
      headers: headers(OWNER_A, BIZ_A),
    });

    const body = res.json();
    expect(body.totals.assets).toBe('0.0000');
    expect(body.balanceCheck.balanced).toBe(true);
  });
});

describe('Phase 6 — Balance Sheet: 10. tenant isolation', () => {
  it('never exposes another tenant ledger', async () => {
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-TENANT-A',
      entryDate: '2026-10-09',
      lines: [
        { code: '1010', debit: '111.0000', credit: '0.0000' },
        { code: '3010', debit: '0.0000', credit: '111.0000' },
      ],
    });
    seedJournal({
      businessId: BIZ_B,
      entryNumber: 'JE-TENANT-B',
      entryDate: '2026-10-09',
      lines: [
        { code: '1010', debit: '999.0000', credit: '0.0000' },
        { code: '3010', debit: '0.0000', credit: '999.0000' },
      ],
    });

    const viewA = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/balance-sheet',
      headers: headers(OWNER_A, BIZ_A),
    });
    const viewB = await app.inject({
      method: 'GET',
      url: '/api/v1/finance/balance-sheet',
      headers: headers(OWNER_B, BIZ_B),
    });

    expect(viewA.json().totals.assets).toBe('111.0000');
    expect(viewB.json().totals.assets).toBe('999.0000');
    expect(JSON.stringify(viewA.json())).not.toContain('999.0000');
    expect(JSON.stringify(viewB.json())).not.toContain('111.0000');
  });
});

describe('Phase 6 — Balance Sheet: 11. authorization and business scope', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/accounting/balance-sheet' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a user with no membership in the requested business', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/balance-sheet',
      headers: headers('test_bs_stranger', BIZ_A),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('rejects a member whose role lacks accounting.view', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/balance-sheet',
      headers: headers(CASHIER_A, BIZ_A),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('PERMISSION_DENIED');
  });

  it('rejects the finance alias for a role lacking finance.view', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/finance/balance-sheet',
      headers: headers(CASHIER_A, BIZ_A),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('PERMISSION_DENIED');
  });

  it('requires a tenant header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/balance-sheet',
      headers: { authorization: `Bearer ${OWNER_A}` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('TENANT_REQUIRED');
  });
});

describe('Phase 6 — Balance Sheet: 12. agreement with Trial Balance', () => {
  it('reconciles asset+liability+equity against the trial balance ledger', async () => {
    // A coherent operating ledger:
    //   opening inventory + capital, credit sale, COGS, unpaid opex, collection.
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-TB-OPEN',
      entryDate: '2026-10-10',
      lines: [
        { code: '1050', debit: '30000.0000', credit: '0.0000' },
        { code: '3010', debit: '0.0000', credit: '30000.0000' },
      ],
    });
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-TB-SALE',
      entryDate: '2026-10-10',
      lines: [
        { code: '1040', debit: '15000.0000', credit: '0.0000' },
        { code: '4010', debit: '0.0000', credit: '15000.0000' },
      ],
    });
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-TB-COGS',
      entryDate: '2026-10-10',
      lines: [
        { code: '5010', debit: '12000.0000', credit: '0.0000' },
        { code: '1050', debit: '0.0000', credit: '12000.0000' },
      ],
    });
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-TB-OPEX',
      entryDate: '2026-10-10',
      lines: [
        { code: '6010', debit: '5000.0000', credit: '0.0000' },
        { code: '2010', debit: '0.0000', credit: '5000.0000' },
      ],
    });
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-TB-COLLECT',
      entryDate: '2026-10-10',
      lines: [
        { code: '1010', debit: '15000.0000', credit: '0.0000' },
        { code: '1040', debit: '0.0000', credit: '15000.0000' },
      ],
    });

    const [sheet, trial] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/api/v1/accounting/balance-sheet',
        headers: headers(OWNER_A, BIZ_A),
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/accounting/trial-balance',
        headers: headers(OWNER_A, BIZ_A),
      }),
    ]);

    const body = sheet.json();
    const trialBody = trial.json();

    expect(trialBody.isBalanced).toBe(true);
    expect(trialBody.difference).toBe('0.0000');
    expect(trialBody.totalDebits).toBe('77000.0000');
    expect(trialBody.totalCredits).toBe('77000.0000');

    // Cash 15,000 + inventory 18,000; AR nets to zero and is omitted.
    expect(body.totals.assets).toBe('33000.0000');
    expect(body.totals.liabilities).toBe('5000.0000');
    expect(body.totals.retainedEquity).toBe('30000.0000');
    expect(body.currentPeriodEarnings.revenue).toBe('15000.0000');
    expect(body.currentPeriodEarnings.expenses).toBe('17000.0000');
    expect(body.totals.currentPeriodEarnings).toBe('-2000.0000');
    expect(body.totals.equity).toBe('28000.0000');
    expect(body.totals.liabilitiesPlusEquity).toBe('33000.0000');
    expect(body.balanceCheck.balanced).toBe(true);
    expect(body.reportingEquation.satisfied).toBe(true);
  });

  it('keeps both balance sheet endpoints on one identical derivation', async () => {
    seedJournal({
      businessId: BIZ_A,
      entryNumber: 'JE-PARITY',
      entryDate: '2026-10-11',
      lines: [
        { code: '1010', debit: '3000.0001', credit: '0.0000' },
        { code: '2020', debit: '0.0000', credit: '1000.0001' },
        { code: '4010', debit: '0.0000', credit: '2500.0000' },
        { code: '6020', debit: '500.0000', credit: '0.0000' },
      ],
    });

    const [accounting, finance] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/api/v1/accounting/balance-sheet',
        headers: headers(OWNER_A, BIZ_A),
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/finance/balance-sheet',
        headers: headers(OWNER_A, BIZ_A),
      }),
    ]);

    expect(accounting.statusCode).toBe(200);
    expect(finance.statusCode).toBe(200);
    expect(accounting.json()).toEqual(finance.json());
  });
});