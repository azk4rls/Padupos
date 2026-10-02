import type { FastifyPluginAsync } from 'fastify';
import { MLService } from './service.js';
import { requirePermission } from '../../plugins/rbac.js';

export const mlRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = [(fastify as any).authenticate, (fastify as any).resolveTenant];

  // 1. Sales forecast with data sufficiency check
  fastify.get('/ml/sales-forecast', { preHandler: [...auth, requirePermission('ml.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const result = MLService.getSalesForecast(businessId);
    return result;
  });

  // 2. Stock forecast & restock suggestions
  fastify.get('/ml/stock-forecast', { preHandler: [...auth, requirePermission('ml.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const branchId = (request.query as any)?.branchId;
    const items = MLService.getStockForecast(businessId, branchId);
    return { stockForecast: items };
  });

  // 3. Anomaly detection events
  fastify.get('/ml/anomalies', { preHandler: [...auth, requirePermission('ml.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const anomalies = MLService.detectAnomalies(businessId);
    return { anomalies };
  });
};
