import type { FastifyPluginAsync } from 'fastify';
import { updateBusinessSchema, createBranchSchema, inviteMemberSchema } from '@padupos/validation';
import { domainStore } from '../domainStore.js';
import { requirePermission, registerMemberForTesting } from '../../plugins/rbac.js';
import { PLAN_ENTITLEMENTS } from '@padupos/config';
import { generatePrefixedId } from '@padupos/shared';
import type { Branch, BusinessMember, PlanTier } from '@padupos/types';

export const businessesRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = [(fastify as any).authenticate, (fastify as any).resolveTenant];

  // 1. Get Business details
  fastify.get<{ Params: { id: string } }>('/businesses/:id', { preHandler: auth }, async (request, reply) => {
    const biz = domainStore.businesses.get(request.params.id);
    if (!biz || biz.id !== request.businessContext!.businessId) {
      return reply.status(404).send({
        error: { code: 'BUSINESS_NOT_FOUND', message: 'Business not found', requestId: request.id },
      });
    }
    return { business: biz };
  });

  // 2. Update Business
  fastify.patch<{ Params: { id: string } }>('/businesses/:id', {
    preHandler: [...auth, requirePermission('settings.manage')],
  }, async (request, reply) => {
    const biz = domainStore.businesses.get(request.params.id);
    if (!biz || biz.id !== request.businessContext!.businessId) {
      return reply.status(404).send({
        error: { code: 'BUSINESS_NOT_FOUND', message: 'Business not found', requestId: request.id },
      });
    }

    const body = updateBusinessSchema.parse(request.body);
    const updated = { ...biz, ...body, updatedAt: new Date().toISOString() };
    domainStore.businesses.set(biz.id, updated);

    return { business: updated };
  });

  // 3. Branches (List & Create with Entitlement limit checks)
  fastify.get('/branches', { preHandler: auth }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const branches: Branch[] = [];
    for (const brn of domainStore.branches.values()) {
      if (brn.businessId === businessId) {
        branches.push(brn);
      }
    }
    return { branches };
  });

  fastify.post('/branches', {
    preHandler: [...auth, requirePermission('settings.manage')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const body = createBranchSchema.parse(request.body);

    // Check Plan Entitlement limits
    const sub = domainStore.subscriptions.get(`sub_${businessId}`);
    const tier = (sub?.planId || 'FREE') as PlanTier;
    const entitlement = PLAN_ENTITLEMENTS[tier];

    let currentBranchCount = 0;
    for (const brn of domainStore.branches.values()) {
      if (brn.businessId === businessId) currentBranchCount++;
    }

    if (currentBranchCount >= entitlement.maxBranches) {
      return reply.status(403).send({
        error: {
          code: 'ENTITLEMENT_LIMIT_REACHED',
          message: `Your current ${tier} plan limit is ${entitlement.maxBranches} outlet(s). Upgrade to expand outlets.`,
          requestId: request.id,
        },
      });
    }

    const branchId = generatePrefixedId('brn');
    const newBranch: Branch = {
      id: branchId,
      businessId,
      name: body.name,
      code: body.code,
      address: body.address,
      phone: body.phone,
      timezone: body.timezone,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    domainStore.branches.set(branchId, newBranch);
    return reply.status(201).send({ branch: newBranch });
  });

  // 4. Members (List & Invite)
  fastify.get('/members', { preHandler: auth }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const members: BusinessMember[] = [];
    for (const m of domainStore.members.values()) {
      if (m.businessId === businessId) {
        members.push(m);
      }
    }
    return { members };
  });

  fastify.post('/members', {
    preHandler: [...auth, requirePermission('employees.manage')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const body = inviteMemberSchema.parse(request.body);

    const memberId = generatePrefixedId('mem');
    const invitedUserId = `user_${body.email.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const member: BusinessMember = {
      id: memberId,
      businessId,
      userId: invitedUserId,
      roleId: `role_${body.roleName.toLowerCase()}`,
      status: 'ACTIVE',
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    domainStore.members.set(memberId, member);
    registerMemberForTesting(businessId, invitedUserId, body.roleName);

    return reply.status(201).send({ member });
  });
};
