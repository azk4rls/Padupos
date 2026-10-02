import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { ROLE_PERMISSIONS, type SystemPermission } from '@padupos/config';
import type { RoleName } from '@padupos/types';

export interface BusinessContext {
  businessId: string;
  role: RoleName;
  permissions: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    businessContext?: BusinessContext;
  }
}

// In-memory tenant membership cache / store for test & development
const memberDirectory = new Map<string, { role: RoleName; status: string }>();

export function registerMemberForTesting(businessId: string, userId: string, role: RoleName) {
  memberDirectory.set(`${businessId}:${userId}`, { role, status: 'ACTIVE' });
}

export function clearMemberDirectoryForTesting() {
  memberDirectory.clear();
}

const rbacPluginCallback: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('resolveTenant', async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request.headers['x-business-id'] as string) || (request.query as any)?.businessId;
    const userId = request.user?.id;

    if (!userId) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required before tenant resolution',
          requestId: request.id,
        },
      });
    }

    if (!businessId) {
      return reply.status(400).send({
        error: {
          code: 'TENANT_REQUIRED',
          message: 'Missing x-business-id header for tenant-scoped operation',
          requestId: request.id,
        },
      });
    }

    // Lookup genuine membership or ownership
    const { domainStore } = await import('../modules/domainStore.js');
    const biz = domainStore.businesses.get(businessId);
    let role: RoleName | null = null;

    if (biz && biz.ownerUserId === userId) {
      role = 'OWNER';
    } else {
      const key = `${businessId}:${userId}`;
      const mem = memberDirectory.get(key);
      if (mem && mem.status === 'ACTIVE') {
        role = mem.role;
      }
    }

    if (!role) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: inactive or missing membership for requested business',
          requestId: request.id,
        },
      });
    }

    const rolePerms = ROLE_PERMISSIONS[role] || [];
    request.businessContext = {
      businessId,
      role,
      permissions: [...rolePerms],
    };
  });
};

export function requirePermission(permission: SystemPermission) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const context = request.businessContext;
    if (!context) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Tenant context must be resolved before checking permissions',
          requestId: request.id,
        },
      });
    }

    if (!context.permissions.includes(permission)) {
      return reply.status(403).send({
        error: {
          code: 'PERMISSION_DENIED',
          message: `Forbidden: missing required permission '${permission}'`,
          requestId: request.id,
        },
      });
    }
  };
}

export const rbacPlugin = fp(rbacPluginCallback);
