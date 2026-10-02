import type { FastifyPluginAsync } from 'fastify';
import { createBusinessSchema } from '@padupos/validation';
import { domainStore } from '../domainStore.js';
import { registerMemberForTesting } from '../../plugins/rbac.js';
import { generatePrefixedId } from '@padupos/shared';
import type { Business, Branch, BusinessMember } from '@padupos/types';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Onboarding: Create new business + first branch + owner membership
  fastify.post('/auth/onboarding', { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const userId = request.user!.id;
    const body = createBusinessSchema.parse(request.body);

    const businessId = generatePrefixedId('biz');
    const branchId = generatePrefixedId('brn');
    const memberId = generatePrefixedId('mem');

    const business: Business = {
      id: businessId,
      ownerUserId: userId,
      name: body.name,
      legalName: body.legalName,
      businessType: body.businessType,
      countryId: `cnt_${body.countryCode.toLowerCase()}`,
      baseCurrency: body.currency,
      displayCurrency: body.currency,
      locale: body.locale,
      timezone: body.timezone,
      fiscalYearStartMonth: body.fiscalYearStartMonth,
      taxId: body.taxId,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const branch: Branch = {
      id: branchId,
      businessId,
      name: body.initialBranchName,
      code: 'MAIN',
      timezone: body.timezone,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const member: BusinessMember = {
      id: memberId,
      businessId,
      userId,
      roleId: 'role_owner',
      status: 'ACTIVE',
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    domainStore.businesses.set(businessId, business);
    domainStore.branches.set(branchId, branch);
    domainStore.members.set(memberId, member);
    registerMemberForTesting(businessId, userId, 'OWNER');

    // Initialize Chart of Accounts for this business
    domainStore.initializeDefaultAccounts(businessId, body.currency);

    // Initialize default FREE subscription
    domainStore.subscriptions.set(`sub_${businessId}`, {
      id: `sub_${businessId}`,
      businessId,
      planId: 'FREE',
      status: 'ACTIVE',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return reply.status(201).send({
      message: 'Onboarding completed successfully',
      business,
      branch,
    });
  });

  // Current authenticated profile & accessible businesses
  fastify.get('/auth/me', { preHandler: [(fastify as any).authenticate] }, async (request) => {
    const userId = request.user!.id;
    const userBusinesses: Business[] = [];

    for (const biz of domainStore.businesses.values()) {
      if (biz.ownerUserId === userId) {
        userBusinesses.push(biz);
        continue;
      }
      for (const m of domainStore.members.values()) {
        if (m.businessId === biz.id && m.userId === userId && m.status === 'ACTIVE') {
          userBusinesses.push(biz);
          break;
        }
      }
    }

    return {
      user: {
        id: userId,
        email: request.user!.email,
      },
      businesses: userBusinesses,
    };
  });
};
