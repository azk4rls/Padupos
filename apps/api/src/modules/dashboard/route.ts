import type { FastifyPluginAsync } from 'fastify';
import { DashboardMetricsService } from './service.js';
import { requirePermission } from '../../plugins/rbac.js';
import { resolveBranchScope } from '../../lib/branchScope.js';
import { InvalidDateRangeError, resolveDateRange } from '../../lib/dateRange.js';

/**
 * Dashboard read contract
 * ======================
 *
 *   GET /dashboard/metrics
 *   GET /dashboard/metrics/series
 *
 * Query (both endpoints):
 *   x-branch-id   header   optional; narrows to one branch. Must belong to the
 *                          authorized business and be ACTIVE, else 403.
 *   branchId      query    alternative to the header (header wins).
 *   startDate     query    optional; `YYYY-MM-DD` or offset-qualified ISO-8601.
 *   endDate       query    optional; inclusive calendar day.
 *
 * Omitting both dates resolves to the current business-timezone calendar day.
 */
export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = [(fastify as any).authenticate, (fastify as any).resolveTenant];

  fastify.get('/dashboard/metrics', {
    preHandler: [...auth, requirePermission('reports.view')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;

    const branch = resolveBranchScope(request, reply);
    if (!branch.ok) return;

    let range;
    try {
      range = resolveDateRange(request.query as never, businessId, branch.branchId);
    } catch (error) {
      if (error instanceof InvalidDateRangeError) {
        return reply.status(400).send({
          error: { code: error.code, message: error.message, requestId: request.id },
        });
      }
      throw error;
    }

    const metrics = DashboardMetricsService.getMetrics(businessId, branch.branchId, range);
    return { metrics };
  });

  fastify.get('/dashboard/metrics/series', {
    preHandler: [...auth, requirePermission('reports.view')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;

    const branch = resolveBranchScope(request, reply);
    if (!branch.ok) return;

    let range;
    try {
      range = resolveDateRange(request.query as never, businessId, branch.branchId);
    } catch (error) {
      if (error instanceof InvalidDateRangeError) {
        return reply.status(400).send({
          error: { code: error.code, message: error.message, requestId: request.id },
        });
      }
      throw error;
    }

    return {
      series: DashboardMetricsService.getTimeSeries(businessId, branch.branchId, range),
    };
  });
};