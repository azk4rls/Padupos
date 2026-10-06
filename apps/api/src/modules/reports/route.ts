import type { FastifyPluginAsync } from 'fastify';
import { domainStore } from '../domainStore.js';
import { requirePermission } from '../../plugins/rbac.js';
import { toBN } from '@padupos/shared';
import BigNumber from 'bignumber.js';
import { resolveBranchScope } from '../../lib/branchScope.js';
import { InvalidDateRangeError, resolveDateRange } from '../../lib/dateRange.js';
import {
  EXPORT_ARTIFACT_TTL_MS,
  SUPPORTED_EXPORT_FORMATS,
  SUPPORTED_EXPORT_REPORTS,
  consumeExportArtifact,
  createExportArtifact,
  deleteExportArtifact,
  isSupportedExportFormat,
  isSupportedExportReport,
} from '../../lib/exportService.js';

export const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = [(fastify as any).authenticate, (fastify as any).resolveTenant];

  /**
   * GET /reports/sales
   *
   * Query:
   *   x-branch-id | branchId   optional, explicitly authorized (403 when not a
   *                             member branch of the authorized business)
   *   startDate, endDate       optional inclusive calendar range in business tz
   */
  fastify.get('/reports/sales', { preHandler: [...auth, requirePermission('reports.view')] }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;

    const branch = resolveBranchScope(request, reply);
    if (!branch.ok) return;
    const branchId = branch.branchId;

    let range;
    try {
      range = resolveDateRange(request.query as never, businessId, branchId);
    } catch (error) {
      if (error instanceof InvalidDateRangeError) {
        return reply.status(400).send({
          error: { code: error.code, message: error.message, requestId: request.id },
        });
      }
      throw error;
    }

    let totalRevenue = new BigNumber(0);
    let totalCogs = new BigNumber(0);
    let totalDiscount = new BigNumber(0);
    let totalTax = new BigNumber(0);
    let totalTransactions = 0;

    const salesList = [];
    for (const sale of domainStore.sales.values()) {
      if (
        sale.businessId !== businessId ||
        (branchId !== null && sale.branchId !== branchId) ||
        sale.status !== 'PAID'
      ) {
        continue;
      }
      const instant = new Date(sale.createdAt);
      if (Number.isNaN(instant.getTime())) continue;
      if (instant.getTime() < range.startInclusive.getTime()) continue;
      if (instant.getTime() >= range.endExclusive.getTime()) continue;

      totalRevenue = totalRevenue.plus(toBN(sale.totalAmount));
      totalCogs = totalCogs.plus(toBN(sale.cogsAmount));
      totalDiscount = totalDiscount.plus(toBN(sale.discountAmount));
      totalTax = totalTax.plus(toBN(sale.taxAmount));
      totalTransactions += 1;
      salesList.push(sale);
    }

    const grossProfit = totalRevenue.minus(totalCogs);
    const marginPct = totalRevenue.isGreaterThan(0)
      ? grossProfit.dividedBy(totalRevenue).multipliedBy(100).toFixed(2)
      : '0.00';

    return {
      scope: { branchId, timeZone: range.timeZone },
      range: { startDate: range.startDate, endDate: range.endDate, dayCount: range.dayCount },
      summary: {
        totalRevenue: totalRevenue.toFixed(4),
        totalCogs: totalCogs.toFixed(4),
        grossProfit: grossProfit.toFixed(4),
        grossMarginPercentage: marginPct,
        totalDiscount: totalDiscount.toFixed(4),
        totalTax: totalTax.toFixed(4),
        transactionCount: totalTransactions,
      },
      sales: salesList,
    };
  });

  /**
   * POST /reports/export
   *
   * Generates a real CSV artefact and returns an opaque download token.
   *
   * The token is unguessable (256 bits) and is resolved only through
   * `GET /reports/exports/:token`, which re-authenticates and re-scopes to the
   * caller's business.
   */
  fastify.post('/reports/export', { preHandler: [...auth, requirePermission('reports.export')] }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;

    const branch = resolveBranchScope(request, reply);
    if (!branch.ok) return;
    const branchId = branch.branchId;

    const body = (request.body ?? {}) as {
      format?: string;
      reportType?: string;
      startDate?: string;
      endDate?: string;
      branchId?: string;
    };

    const reportType = (body.reportType ?? '').toUpperCase();
    const format = (body.format ?? 'CSV').toUpperCase();

    if (!isSupportedExportReport(reportType)) {
      return reply.status(400).send({
        error: {
          code: 'UNSUPPORTED_REPORT_TYPE',
          message: `reportType must be one of: ${SUPPORTED_EXPORT_REPORTS.join(', ')}`,
          requestId: request.id,
        },
      });
    }

    if (!isSupportedExportFormat(format)) {
      return reply.status(400).send({
        error: {
          code: 'UNSUPPORTED_EXPORT_FORMAT',
          message: `format must be one of: ${SUPPORTED_EXPORT_FORMATS.join(', ')}`,
          requestId: request.id,
        },
      });
    }

    let range;
    try {
      range = resolveDateRange(
        {
          startDate: body.startDate,
          endDate: body.endDate,
        },
        businessId,
        branchId,
      );
    } catch (error) {
      if (error instanceof InvalidDateRangeError) {
        return reply.status(400).send({
          error: { code: error.code, message: error.message, requestId: request.id },
        });
      }
      throw error;
    }

    const artifact = createExportArtifact({ businessId, reportType, branchId, range, format });

    return reply.status(201).send({
      reportType,
      format: artifact.format,
      branchId,
      range: { startDate: range.startDate, endDate: range.endDate, dayCount: range.dayCount },
      rowCount: artifact.rowCount,
      filename: artifact.filename,
      contentType: artifact.contentType,
      expiresAt: new Date(artifact.expiresAt).toISOString(),
      downloadUrl: `/api/v1/reports/exports/${artifact.token}`,
    });
  });

  /**
   * GET /reports/exports/:token
   *
   * Protected download. Unknown token, expired token, or a token belonging to
   * another tenant all return 404 so the endpoint cannot enumerate artefacts.
   */
  fastify.get<{ Params: { token: string } }>('/reports/exports/:token', {
    preHandler: [...auth, requirePermission('reports.export')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const artifact = consumeExportArtifact(request.params.token, businessId);

    if (!artifact) {
      return reply.status(404).send({
        error: {
          code: 'EXPORT_NOT_FOUND',
          message: 'Export artefact does not exist, has expired, or is not accessible',
          requestId: request.id,
        },
      });
    }

    // One-shot download: the artefact is destroyed once served.
    deleteExportArtifact(artifact.token);

    return reply
      .status(200)
      .header('content-type', artifact.contentType)
      .header('content-disposition', `attachment; filename="${artifact.filename}"`)
      .header('content-length', String(Buffer.byteLength(artifact.body, 'utf8')))
      .header('cache-control', 'private, no-store')
      .header('x-export-ttl-seconds', String(Math.floor(EXPORT_ARTIFACT_TTL_MS / 1000)))
      .send(artifact.body);
  });
};