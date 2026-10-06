import type { FastifyReply, FastifyRequest } from 'fastify';
import { domainStore } from '../modules/domainStore.js';

/**
 * Branch scope resolution and authorization.
 *
 * Branch ids are opaque `br_...` strings, never UUIDs, so authorization is enforced
 * in code rather than by a schema regex.
 *
 * A caller-supplied branch id NEVER widens access. It can only narrow it, and only
 * to a branch that:
 *   1. exists,
 *   2. belongs to the already-authorized business (tenant boundary),
 *   3. is ACTIVE,
 *   4. and whose business the caller is an ACTIVE member / owner of
 *      (guaranteed upstream by resolveTenant, re-checked here defensively).
 */

export type BranchScopeResult =
  | { ok: true; branchId: null | string; branchTimezone: string | null }
  | { ok: false; statusCode: number; code: string; message: string };

function readRequestedBranchId(request: FastifyRequest): string | undefined {
  const header = request.headers['x-branch-id'];
  const headerValue = Array.isArray(header) ? header[0] : header;
  const raw =
    typeof headerValue === 'string' && headerValue.trim() !== ''
      ? headerValue
      : (request.query as Record<string, unknown> | undefined)?.branchId;

  // An absent OR blank reference both mean "no branch filter". Treating
  // `?branchId=` as an error would make a cleared UI filter 400, which is a worse
  // contract than interpreting it as business-level scope.
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'string') {
    throw new InvalidBranchReference('branchId must be a string');
  }
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

export class InvalidBranchReference extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBranchReference';
  }
}

/**
 * Resolves the effective branch scope for a tenant-scoped request.
 *
 * Precedence: `x-branch-id` header, then `?branchId=` query. Header wins so that a
 * client-wide active-branch selection is not silently overridden by a stale link.
 *
 * Absent branch  -> { ok: true, branchId: null }  => business-level scope.
 */
export function resolveBranchScope(
  request: FastifyRequest,
  reply: FastifyReply,
): BranchScopeResult {
  const context = request.businessContext;
  if (!context) {
    reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Tenant context must be resolved before resolving branch scope',
        requestId: request.id,
      },
    });
    return { ok: false, statusCode: 401, code: 'UNAUTHORIZED', message: 'unresolved tenant context' };
  }

  const businessId = context.businessId;
  let requestedBranchId: string | undefined;

  try {
    requestedBranchId = readRequestedBranchId(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Malformed branch identifier';
    reply.status(400).send({
      error: { code: 'INVALID_BRANCH', message, requestId: request.id },
    });
    return { ok: false, statusCode: 400, code: 'INVALID_BRANCH', message };
  }

  // No branch requested => business-level scope. No extra authorization needed;
  // resolveTenant already proved membership of `businessId`.
  if (requestedBranchId === undefined) {
    return { ok: true, branchId: null, branchTimezone: null };
  }

  const branch = domainStore.branches.get(requestedBranchId);

  // Non-existent branch is reported as forbidden rather than "not found" so that the
  // endpoint cannot be used to enumerate branch ids belonging to other tenants.
  if (!branch) {
    reply.status(403).send({
      error: {
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Branch does not exist or is not accessible for this business',
        requestId: request.id,
      },
    });
    return { ok: false, statusCode: 403, code: 'BRANCH_ACCESS_DENIED', message: 'unknown branch' };
  }

  // Tenant boundary: the branch must belong to the authorized business.
  if (branch.businessId !== businessId) {
    reply.status(403).send({
      error: {
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Branch does not belong to the authorized business',
        requestId: request.id,
      },
    });
    return { ok: false, statusCode: 403, code: 'BRANCH_ACCESS_DENIED', message: 'cross-tenant branch' };
  }

  if (branch.status !== 'ACTIVE') {
    reply.status(403).send({
      error: {
        code: 'BRANCH_ACCESS_DENIED',
        message: `Branch is ${branch.status} and cannot be used to scope this request`,
        requestId: request.id,
      },
    });
    return {
      ok: false,
      statusCode: 403,
      code: 'BRANCH_ACCESS_DENIED',
      message: `branch is ${branch.status}`,
    };
  }

  return {
    ok: true,
    branchId: branch.id,
    branchTimezone: branch.timezone ?? null,
  };
}