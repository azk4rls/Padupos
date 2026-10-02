import type { FastifyPluginAsync } from 'fastify';
import { offlineSyncBatchSchema } from '@padupos/validation';
import { deduplicateSyncBatch, validateOfflineCashSale } from '@padupos/shared';
import { domainStore } from '../domainStore.js';
import { requirePermission } from '../../plugins/rbac.js';

export const syncRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = [(fastify as any).authenticate, (fastify as any).resolveTenant];

  fastify.post('/pos/sync', {
    preHandler: [...auth, requirePermission('sales.create')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const body = offlineSyncBatchSchema.parse(request.body);

    // Deduplicate incoming batch
    const uniqueItems = deduplicateSyncBatch(body.batch as any);

    const successful: Array<{ id: string; idempotencyKey: string; serverId: string }> = [];
    const conflicts: Array<{ id: string; idempotencyKey: string; reason: string }> = [];
    const failed: Array<{ id: string; idempotencyKey: string; error: string; shouldRetry: boolean }> = [];

    for (const item of uniqueItems) {
      const idemKey = `sync:${businessId}:${item.idempotencyKey}`;

      // Check if already processed
      if (domainStore.idempotencyKeys.has(idemKey)) {
        const cached = domainStore.idempotencyKeys.get(idemKey)!;
        successful.push({
          id: item.id,
          idempotencyKey: item.idempotencyKey,
          serverId: (cached.response as any)?.serverId || item.id,
        });
        continue;
      }

      if (item.operation === 'FINALIZE_SALE') {
        const validation = validateOfflineCashSale(item.payload);
        if (!validation.isValid) {
          failed.push({
            id: item.id,
            idempotencyKey: item.idempotencyKey,
            error: validation.error || 'Invalid sale payload',
            shouldRetry: false,
          });
          continue;
        }

        // Successfully synced
        const serverId = `sale_${Date.now()}`;
        domainStore.idempotencyKeys.set(idemKey, {
          payloadHash: item.idempotencyKey,
          response: { serverId },
          statusCode: 200,
        });

        successful.push({
          id: item.id,
          idempotencyKey: item.idempotencyKey,
          serverId,
        });
      } else {
        successful.push({
          id: item.id,
          idempotencyKey: item.idempotencyKey,
          serverId: item.id,
        });
      }
    }

    return reply.status(200).send({
      message: 'Sync batch processed',
      successful,
      conflicts,
      failed,
    });
  });
};
