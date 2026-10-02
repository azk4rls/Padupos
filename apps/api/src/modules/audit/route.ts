import type { FastifyPluginAsync } from 'fastify';
import { domainStore } from '../domainStore.js';
import { requirePermission } from '../../plugins/rbac.js';

export const auditRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = [(fastify as any).authenticate, (fastify as any).resolveTenant];

  fastify.get('/audit/logs', { preHandler: [...auth, requirePermission('audit.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const logs = domainStore.auditLogs.filter((l) => l.businessId === businessId);
    return { logs: logs.slice(-100).reverse() };
  });
};
