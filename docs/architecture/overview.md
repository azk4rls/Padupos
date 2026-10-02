# PADUPOS — System Architecture Overview

## 1. Architectural Philosophy: Global-First Modular Monolith

PADUPOS is architected from day one as a **Global-First Multi-Tenant SaaS Business Operating System** for small and growing businesses. While Indonesia is the inaugural market, the platform's core domain models, math engines, accounting primitives, and database schemas are decoupled from any single nation, currency, language, or payment provider.

### Core Architectural Layers
```
┌─────────────────────────────────────────────────────────────┐
│                 Client Applications (Web / POS)             │
│            Next.js + IndexedDB Offline Storage Queue        │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON / Idempotency-Key
┌──────────────────────────────▼──────────────────────────────┐
│             Fastify API Modular Monolith (Node.js)          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Middleware: JWT Auth, Multi-Tenant Resolver, RBAC Matrix│ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────┬────────────┬─────────────┬────────────────┐ │
│  │ Countries  │ Catalog &  │ Cashier POS │ Double-Entry   │ │
│  │ & Config   │ Products   │ & Sessions  │ Accounting     │ │
│  ├────────────┼────────────┼─────────────┼────────────────┤ │
│  │ Non-Custodial  Inventory│ Finance &   │ Grounded AI    │ │
│  │ Payments   │ & WAC Cost │ Cashflow    │ & Reports      │ │
│  └────────────┴────────────┴─────────────┴────────────────┘ │
└──────────────────────────────┬──────────────────────────────┘
                               │
        ┌──────────────────────┴──────────────────────┐
        │                                             │
┌───────▼───────────────────────────┐   ┌─────────────▼────────────────┐
│   Supabase PostgreSQL 15+         │   │   Python ML Asynchronous     │
│   - Pure NUMERIC(15,4) Arithmetics│   │   Worker (scikit-learn / pandas)│
│   - Multi-Tenant RLS Security     │   │   - 30-Day Sufficiency Gates │
│   - Double-Entry Balance Engine   │   │   - Run-Rate Stock Depletion │
│   - Idempotency Execution Store   │   │   - Multi-Signal Fraud Outlier│
└───────────────────────────────────┘   └──────────────────────────────┘
```

---

## 2. Monorepo Organization

PADUPOS is structured as a pnpm workspace monorepo:

```
padupos/
├── apps/
│   ├── api/                 # Fastify TypeScript Modular Monolith
│   │   ├── src/
│   │   │   ├── db/          # Drizzle ORM schema and Supabase client
│   │   │   ├── plugins/     # auth, tenant resolver, rbac, errorHandler
│   │   │   ├── modules/     # Domain modular monolith route controllers
│   │   │   └── tests/       # Vitest suites (Security, Payment, Section 216, ML)
│   │   └── package.json
│   └── web/                 # Next.js 14 web and offline POS shell
│       ├── src/
│       │   ├── offline/     # IndexedDB schema (OfflineDB) & sync manager
│       │   ├── api/         # Typed API Client
│       │   └── app/         # Next.js App Router entrypoint
│       └── package.json
├── packages/
│   ├── types/               # Pure TypeScript interfaces across all domains
│   ├── config/              # Country configs, currency rules, system permissions, COA
│   ├── shared/              # Pure math engines: order calculations, WAC, session balancing
│   ├── validation/          # Zod validation schemas with min(1) prefixed/UUID support
│   └── ui/                  # Shared UI components
├── workers/
│   └── ml/                  # Python ML worker with sales forecast, stock run rate, anomaly detection
├── supabase/
│   └── migrations/          # Pure SQL schema migration with Row Level Security (RLS)
└── docs/                    # Complete production architectural documentation
```

---

## 3. Non-Negotiable Tenets

1. **Zero Dummy/Fake Data**: No simulated transactions, fake users, or artificial forecasts. If a business lacks 30 days of transactions, models explicitly respond with honest messages: `"Belum cukup data untuk membuat prediksi. Minimal 30 hari data transaksi diperlukan."`
2. **Decoupled Localization**: Any country can be activated by providing an entry in `SUPPORTED_COUNTRIES` with tax type, currency symbol, decimal places, and timezone.
3. **Pure Decimal Calculation**: All monetary amounts are handled via `bignumber.js` and stored as `NUMERIC(15,4)`. Floating-point arithmetic is strictly prohibited in financial paths.
4. **Strict Multi-Tenant Isolation**: Every database table includes `business_id`. Row Level Security (RLS) policies enforce tenant partition at the database layer, with application middleware validating tenant membership.
