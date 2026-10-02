import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { errorHandler } from './plugins/errorHandler.js';
import { authPlugin } from './plugins/auth.js';
import { rbacPlugin } from './plugins/rbac.js';
import { config } from './config/index.js';

// Route Modules
import { healthRoutes } from './modules/health/route.js';
import { countriesRoutes } from './modules/countries/route.js';
import { authRoutes } from './modules/auth/route.js';
import { businessesRoutes } from './modules/businesses/route.js';
import { productsRoutes } from './modules/products/route.js';
import { inventoryRoutes } from './modules/inventory/route.js';
import { posRoutes } from './modules/pos/route.js';
import { paymentsRoutes } from './modules/payments/route.js';
import { financeRoutes } from './modules/finance/route.js';
import { accountingRoutes } from './modules/accounting/route.js';
import { purchasesRoutes } from './modules/purchases/route.js';
import { dashboardRoutes } from './modules/dashboard/route.js';
import { reportsRoutes } from './modules/reports/route.js';
import { aiRoutes } from './modules/ai/route.js';
import { mlRoutes } from './modules/ml/route.js';
import { syncRoutes } from './modules/sync/route.js';
import { subscriptionsRoutes } from './modules/subscriptions/route.js';
import { auditRoutes } from './modules/audit/route.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: false, // Clean test output
    trustProxy: true,
  });

  // 1. Security Headers & CORS
  app.register(helmet, { contentSecurityPolicy: false });
  app.register(cors, {
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // 2. Rate Limiting
  app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_TIME_WINDOW_MS,
  });

  // 3. Error Handling
  app.setErrorHandler(errorHandler);

  // 4. Core Plugins
  app.register(authPlugin);
  app.register(rbacPlugin);

  // 5. Health Check Routes (Root level)
  app.register(healthRoutes);

  // 6. Versioned API Routes (/api/v1)
  app.register(async (v1) => {
    v1.register(countriesRoutes);
    v1.register(authRoutes);
    v1.register(businessesRoutes);
    v1.register(productsRoutes);
    v1.register(inventoryRoutes);
    v1.register(posRoutes);
    v1.register(paymentsRoutes);
    v1.register(financeRoutes);
    v1.register(accountingRoutes);
    v1.register(purchasesRoutes);
    v1.register(dashboardRoutes);
    v1.register(reportsRoutes);
    v1.register(aiRoutes);
    v1.register(mlRoutes);
    v1.register(syncRoutes);
    v1.register(subscriptionsRoutes);
    v1.register(auditRoutes);
  }, { prefix: '/api/v1' });

  return app;
}
