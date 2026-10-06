import { domainStore } from '../../modules/domainStore.js';
import { clearMemberDirectoryForTesting, registerMemberForTesting } from '../../plugins/rbac.js';
import { toBN } from '@padupos/shared';
import BigNumber from 'bignumber.js';
import type { FastifyInstance } from 'fastify';

/**
 * Shared fixture helpers for tenant/report regression suites.
 *
 * Business/branch/user creation goes through the real onboarding endpoint wherever
 * possible so the suites exercise the same code path production does, instead of
 * hand-assembling entities the API would never produce.
 */

export const OWNER_A_TOKEN = 'test_rep_owner_a';
export const OWNER_B_TOKEN = 'test_rep_owner_b';
export const MANAGER_A_TOKEN = 'test_rep_manager_a';

export function ownerIdA(): string {
  return OWNER_A_TOKEN.replace(/^test_/, '');
}
export function ownerIdB(): string {
  return OWNER_B_TOKEN.replace(/^test_/, '');
}
export function managerIdA(): string {
  return MANAGER_A_TOKEN.replace(/^test_/, '');
}

export function resetAll(): void {
  domainStore.clearAll();
  clearMemberDirectoryForTesting();
}

export function tenantHeaders(token: string, businessId: string) {
  return {
    authorization: `Bearer ${token}`,
    'x-business-id': businessId,
  };
}

export interface OnboardedBusiness {
  businessId: string;
  branchId: string;
  secondBranchId: string;
  timezone: string;
}

/** Onboards a business with one initial branch, then creates a second branch. */
export async function onboardBusiness(
  app: FastifyInstance,
  token: string,
  options: { name: string; timezone?: string },
): Promise<OnboardedBusiness> {
  const timezone = options.timezone ?? 'Asia/Jakarta';

  const onboarding = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/onboarding',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: options.name,
      businessType: 'RETAIL',
      countryCode: 'ID',
      currency: 'IDR',
      locale: 'id-ID',
      timezone,
      fiscalYearStartMonth: 1,
      initialBranchName: 'Branch One',
    },
  });

  if (onboarding.statusCode !== 201) {
    throw new Error(`onboarding failed: ${onboarding.statusCode} ${onboarding.body}`);
  }

  const data = onboarding.json();
  const businessId: string = data.business.id;
  const branchId: string = data.branch.id;

  // FREE tier is capped at a single outlet. Multi-branch reporting is a paid-tier
  // capability, so the fixture upgrades the plan the same way a real subscriber would.
  domainStore.subscriptions.set(`sub_${businessId}`, {
    id: `sub_${businessId}`,
    businessId,
    planId: 'BUSINESS',
    status: 'ACTIVE',
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
    cancelAtPeriodEnd: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as never);

  const second = await app.inject({
    method: 'POST',
    url: '/api/v1/branches',
    headers: tenantHeaders(token, businessId),
    payload: { name: 'Branch Two', code: 'BR2', timezone },
  });

  if (second.statusCode !== 201) {
    throw new Error(`branch creation failed: ${second.statusCode} ${second.body}`);
  }

  return {
    businessId,
    branchId,
    secondBranchId: second.json().branch.id,
    timezone,
  };
}

/**
 * Adds a MANAGER and a CASHIER to a business so role-scoped authorization can be
 * asserted without hand-editing the member directory.
 */
export function addMembers(
  businessId: string,
  roles: Array<{ userId: string; role: 'MANAGER' | 'CASHIER' | 'STAFF' }>,
): void {
  for (const entry of roles) {
    registerMemberForTesting(businessId, entry.userId, entry.role);
  }
}

export interface SaleSpec {
  businessId: string;
  branchId: string;
  invoiceNumber: string;
  createdAt: string;
  subtotal: string;
  cogs: string;
  status?: string;
}

/** Seeds a PAID sale plus its items directly, for deterministic report assertions. */
export function seedSale(spec: SaleSpec): void {
  const id = `sale_${spec.businessId}_${spec.invoiceNumber}`;
  const subtotalBN = toBN(spec.subtotal);
  const cogsBN = toBN(spec.cogs);

  domainStore.sales.set(id, {
    id,
    businessId: spec.businessId,
    branchId: spec.branchId,
    invoiceNumber: spec.invoiceNumber,
    status: (spec.status ?? 'PAID') as never,
    subtotal: spec.subtotal,
    discountAmount: '0.0000',
    taxAmount: '0.0000',
    feeAmount: '0.0000',
    totalAmount: subtotalBN.toFixed(4),
    cogsAmount: cogsBN.toFixed(4),
    grossProfitAmount: subtotalBN.minus(cogsBN).toFixed(4),
    currency: 'IDR',
    createdBy: 'seed',
    createdAt: spec.createdAt,
    updatedAt: spec.createdAt,
  } as never);

  domainStore.saleItems.set(id, [
    {
      id: `${id}_item`,
      saleId: id,
      productId: `prod_${spec.businessId}_${spec.invoiceNumber}`,
      quantity: '1.0000',
      unitPrice: spec.subtotal,
      unitCost: spec.cogs,
      subtotal: spec.subtotal,
      discountAmount: '0.0000',
      taxAmount: '0.0000',
      total: subtotalBN.toFixed(4),
      cogsTotal: cogsBN.toFixed(4),
    },
  ]);

  const productId = `prod_${spec.businessId}_${spec.invoiceNumber}`;
  if (!domainStore.products.has(productId)) {
    domainStore.products.set(productId, {
      id: productId,
      businessId: spec.businessId,
      name: `Product ${spec.invoiceNumber}`,
      unit: 'pcs',
      costMethod: 'WEIGHTED_AVERAGE',
      isActive: true,
      createdAt: spec.createdAt,
      updatedAt: spec.createdAt,
    } as never);
  }
}

export function sumStrings(values: string[]): string {
  return values
    .reduce((total: BigNumber, value: string) => total.plus(toBN(value)), new BigNumber(0))
    .toFixed(4);
}

export { registerMemberForTesting };
export type { FastifyInstance };