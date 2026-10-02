import type { FastifyPluginAsync } from 'fastify';
import { DashboardMetricsService } from './service.js';
import { requirePermission } from '../../plugins/rbac.js';

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = [(fastify as any).authenticate, (fastify as any).resolveTenant];

  fastify.get('/dashboard/metrics', {
    preHandler: [...auth, requirePermission('reports.view')],
  }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const metrics = DashboardMetricsService.getMetrics(businessId);
    return { metrics };
  });
};
