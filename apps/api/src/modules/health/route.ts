import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      service: 'padupos-api',
      timestamp: new Date().toISOString(),
    };
  });

  fastify.get('/ready', async () => {
    return {
      ready: true,
      service: 'padupos-api',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  });
};
