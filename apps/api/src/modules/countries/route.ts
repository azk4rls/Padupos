import type { FastifyPluginAsync } from 'fastify';
import { SUPPORTED_COUNTRIES } from '@padupos/config';

export const countriesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/countries', async () => {
    return {
      countries: Object.values(SUPPORTED_COUNTRIES),
    };
  });

  fastify.get<{ Params: { code: string } }>('/countries/:code', async (request, reply) => {
    const code = request.params.code.toUpperCase();
    const country = SUPPORTED_COUNTRIES[code];
    if (!country) {
      return reply.status(404).send({
        error: {
          code: 'COUNTRY_NOT_FOUND',
          message: `Country code '${code}' is not supported`,
          requestId: request.id,
        },
      });
    }
    return { country };
  });
};
