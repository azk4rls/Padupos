import type { FastifyPluginAsync } from 'fastify';
import { MLService } from './service.js';
import { requirePermission } from '../../plugins/rbac.js';
import { resolveBranchScope } from '../../lib/branchScope.js';
import { InvalidDateRangeError } from '../../lib/dateRange.js';
import {
  mlTrainingDataRequestSchema,
  aiInsightQuerySchema,
  generateAiInsightSchema,
} from '@padupos/validation';

export const mlRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = [(fastify as any).authenticate, (fastify as any).resolveTenant];

  // ================================================================
  // 1. BASELINE PREDICTION ENDPOINTS (PHASE 7 COMPATIBILITY)
  // ================================================================

  // Sales forecast with data sufficiency check
  fastify.get('/ml/sales-forecast', { preHandler: [...auth, requirePermission('ml.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const result = MLService.getSalesForecast(businessId);
    return result;
  });

  // Stock forecast & restock suggestions
  fastify.get('/ml/stock-forecast', { preHandler: [...auth, requirePermission('ml.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const branchId = (request.query as any)?.branchId;
    const items = MLService.getStockForecast(businessId, branchId);
    return { stockForecast: items };
  });

  // Anomaly detection events
  fastify.get('/ml/anomalies', { preHandler: [...auth, requirePermission('ml.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const anomalies = MLService.detectAnomalies(businessId);
    return { anomalies };
  });

  // ================================================================
  // 2. PHASE 8.1 ML DATA READINESS ENDPOINTS
  // ================================================================

  // Daily Sales Time Series Dataset
  fastify.get('/ml/datasets/sales-daily', { preHandler: [...auth, requirePermission('ml.view')] }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const branch = resolveBranchScope(request, reply);
    if (!branch.ok) return;

    try {
      const dataset = MLService.getSalesDailyDataset(businessId, branch.branchId, request.query as never);
      return dataset;
    } catch (error) {
      if (error instanceof InvalidDateRangeError) {
        return reply.status(400).send({
          error: { code: error.code, message: error.message, requestId: request.id },
        });
      }
      throw error;
    }
  });

  // Daily Inventory Time Series Dataset
  fastify.get('/ml/datasets/inventory-daily', { preHandler: [...auth, requirePermission('ml.view')] }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const branch = resolveBranchScope(request, reply);
    if (!branch.ok) return;

    const query = request.query as Record<string, unknown>;
    let productIds: string[] | undefined;
    if (typeof query.productIds === 'string') {
      productIds = query.productIds.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (Array.isArray(query.productIds)) {
      productIds = query.productIds.map(String);
    }

    try {
      const dataset = MLService.getInventoryDailyDataset(businessId, branch.branchId, query as never, productIds);
      return dataset;
    } catch (error) {
      if (error instanceof InvalidDateRangeError) {
        return reply.status(400).send({
          error: { code: error.code, message: error.message, requestId: request.id },
        });
      }
      throw error;
    }
  });

  // Product Demand Features Dataset
  fastify.get('/ml/datasets/product-demand', { preHandler: [...auth, requirePermission('ml.view')] }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const branch = resolveBranchScope(request, reply);
    if (!branch.ok) return;

    const query = request.query as Record<string, unknown>;
    let productIds: string[] | undefined;
    if (typeof query.productIds === 'string') {
      productIds = query.productIds.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (Array.isArray(query.productIds)) {
      productIds = query.productIds.map(String);
    }

    try {
      const dataset = MLService.getProductDemandDataset(businessId, branch.branchId, query as never, productIds);
      return dataset;
    } catch (error) {
      if (error instanceof InvalidDateRangeError) {
        return reply.status(400).send({
          error: { code: error.code, message: error.message, requestId: request.id },
        });
      }
      throw error;
    }
  });

  // Anomaly Detection Dataset
  fastify.get('/ml/datasets/anomalies', { preHandler: [...auth, requirePermission('ml.view')] }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const branch = resolveBranchScope(request, reply);
    if (!branch.ok) return;

    try {
      const dataset = MLService.getAnomalyDetectionDataset(businessId, branch.branchId, request.query as never);
      return dataset;
    } catch (error) {
      if (error instanceof InvalidDateRangeError) {
        return reply.status(400).send({
          error: { code: error.code, message: error.message, requestId: request.id },
        });
      }
      throw error;
    }
  });

  // Business Insight Unified Dataset
  fastify.get('/ml/datasets/business-insight', { preHandler: [...auth, requirePermission('ml.view')] }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const branch = resolveBranchScope(request, reply);
    if (!branch.ok) return;

    try {
      const dataset = MLService.getBusinessInsightDataset(businessId, branch.branchId, request.query as never);
      return dataset;
    } catch (error) {
      if (error instanceof InvalidDateRangeError) {
        return reply.status(400).send({
          error: { code: error.code, message: error.message, requestId: request.id },
        });
      }
      throw error;
    }
  });

  // ML Training Data Generation / Feature Extraction
  fastify.post('/ml/training-data', { preHandler: [...auth, requirePermission('ml.view')] }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const parseResult = mlTrainingDataRequestSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid training data request parameters',
          details: parseResult.error.format(),
          requestId: request.id,
        },
      });
    }

    const { branchId, predictionType, lookbackDays, maxTrainingDays } = parseResult.data;

    // If branchId is specified, verify tenant ownership
    if (branchId) {
      const { domainStore } = await import('../domainStore.js');
      const branch = domainStore.branches.get(branchId);
      if (!branch || branch.businessId !== businessId) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN_BRANCH',
            message: 'Branch does not belong to this business',
            requestId: request.id,
          },
        });
      }
    }

    const result = MLService.getTrainingData(businessId, branchId ?? null, {
      businessId,
      branchId: branchId ?? null,
      predictionType,
      lookbackDays,
      maxTrainingDays,
    });

    return result;
  });

  // ================================================================
  // 3. PHASE 8.2 AI BUSINESS INSIGHTS ENDPOINTS
  // ================================================================

  // Get grounded active AI insights
  fastify.get('/ml/insights', { preHandler: [...auth, requirePermission('ml.view')] }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const branch = resolveBranchScope(request, reply);
    if (!branch.ok) return;

    const parseResult = aiInsightQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid insight query parameters',
          details: parseResult.error.format(),
          requestId: request.id,
        },
      });
    }

    try {
      const q = (request.query || {}) as never;
      const result = await MLService.getInsights(businessId, branch.branchId, q);
      return result;
    } catch (error) {
      if (error instanceof InvalidDateRangeError) {
        return reply.status(400).send({
          error: { code: error.code, message: error.message, requestId: request.id },
        });
      }
      throw error;
    }
  });

  // Generate on-demand grounded AI insight
  fastify.post('/ml/insights/generate', { preHandler: [...auth, requirePermission('ml.view')] }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const parseResult = generateAiInsightSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid insight generation request',
          details: parseResult.error.format(),
          requestId: request.id,
        },
      });
    }

    const { insightType, branchId, startDate, endDate } = parseResult.data;

    // Verify branch ownership if specified
    if (branchId) {
      const { domainStore } = await import('../domainStore.js');
      const branch = domainStore.branches.get(branchId);
      if (!branch || branch.businessId !== businessId) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN_BRANCH',
            message: 'Branch does not belong to this business',
            requestId: request.id,
          },
        });
      }
    }

    try {
      const insight = await MLService.generateInsight(businessId, branchId ?? null, insightType, {
        startDate,
        endDate,
      });
      return reply.status(201).send({ insight });
    } catch (error) {
      if (error instanceof InvalidDateRangeError) {
        return reply.status(400).send({
          error: { code: error.code, message: error.message, requestId: request.id },
        });
      }
      throw error;
    }
  });
};

