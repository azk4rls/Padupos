import type { FastifyPluginAsync } from 'fastify';
import { generateAiInsightSchema } from '@padupos/validation';
import { AIInsightService } from './service.js';
import { domainStore } from '../domainStore.js';
import { requirePermission } from '../../plugins/rbac.js';

export const aiRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = [(fastify as any).authenticate, (fastify as any).resolveTenant];

  // 1. Get cached insights
  fastify.get('/ai/insights', { preHandler: [...auth, requirePermission('ai.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const list = domainStore.aiInsights.filter((i) => i.businessId === businessId && i.status === 'ACTIVE');
    return { insights: list };
  });

  // 2. Generate on-demand grounded insight
  fastify.post('/ai/insights/generate', { preHandler: [...auth, requirePermission('ai.view')] }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const body = generateAiInsightSchema.parse(request.body);

    const insight = await AIInsightService.generateInsight(businessId, body.insightType);
    return reply.status(201).send({ insight });
  });
};
