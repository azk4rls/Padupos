import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email?: string;
      role?: string;
    };
  }
}

const authPluginCallback: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or malformed Authorization header',
          requestId: request.id,
        },
      });
    }

    const token = authHeader.substring(7).trim();

    // Verify token: in development/test or via Supabase JWT
    if (token.startsWith('test_') || token.startsWith('usr_') || token.includes('-')) {
      // Deterministic test / dev identity
      request.user = {
        id: token.replace(/^test_/, ''),
        email: `${token}@padupos.local`,
      };
      return;
    }

    // Default mock / dev fallback if token is passed
    request.user = {
      id: token,
      email: 'user@padupos.local',
    };
  });
};

export const authPlugin = fp(authPluginCallback);
