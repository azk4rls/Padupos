import type { FastifyPluginAsync } from 'fastify';
import { PLAN_ENTITLEMENTS } from '@padupos/config';
import { domainStore } from '../domainStore.js';
import type { PlanTier } from '@padupos/types';

export const subscriptionsRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = [(fastify as any).authenticate, (fastify as any).resolveTenant];

  // 1. List Plans and Entitlements
  fastify.get('/subscriptions/plans', async () => {
    return {
      plans: [
        { tier: 'FREE', name: 'Free Starter', entitlements: PLAN_ENTITLEMENTS.FREE },
        { tier: 'PRO', name: 'Professional', entitlements: PLAN_ENTITLEMENTS.PRO },
        { tier: 'BUSINESS', name: 'Business AI & Multi-Outlet', entitlements: PLAN_ENTITLEMENTS.BUSINESS },
        { tier: 'ENTERPRISE', name: 'Enterprise Scale', entitlements: PLAN_ENTITLEMENTS.ENTERPRISE },
      ],
    };
  });

  // 2. Current Business Subscription & Entitlements
  fastify.get('/subscriptions/current', { preHandler: auth }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const sub = domainStore.subscriptions.get(`sub_${businessId}`);
    const tier = (sub?.planId || 'FREE') as PlanTier;
    const entitlements = PLAN_ENTITLEMENTS[tier];

    return {
      subscription: sub,
      tier,
      entitlements,
    };
  });
};
