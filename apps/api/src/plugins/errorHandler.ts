import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { config } from '../config/index.js';

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const requestId = (request.headers['x-request-id'] as string) || (request.id as string) || 'req_unknown';

  // 1. Zod Validation Errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        requestId,
        details: error.flatten().fieldErrors,
      },
    });
  }

  // 2. Custom or HTTP status errors
  const statusCode = error.statusCode || 500;
  const isProduction = config.APP_ENV === 'production';

  // 3. Known application error codes
  const code = (error as any).code || (statusCode === 404 ? 'NOT_FOUND' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 401 ? 'UNAUTHORIZED' : 'INTERNAL_SERVER_ERROR');

  const message = statusCode >= 500 && isProduction
    ? 'An unexpected internal error occurred. Please contact support.'
    : error.message || 'An error occurred';

  request.log.error({
    err: error,
    requestId,
    statusCode,
    url: request.url,
    method: request.method,
  });

  return reply.status(statusCode).send({
    error: {
      code,
      message,
      requestId,
      ...(isProduction ? {} : { details: error.stack }),
    },
  });
}
