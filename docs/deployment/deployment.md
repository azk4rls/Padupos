# PADUPOS — Deployment & Production Operations Guide

## 1. System Prerequisites

- **Node.js**: `20.x` or `22.x` LTS
- **Package Manager**: `pnpm >= 9.x`
- **Database**: PostgreSQL `15+` (Supabase or self-hosted PostgreSQL with `uuid-ossp` and `pgcrypto`)
- **Python**: `3.11+` for the ML Worker service

---

## 2. Environment Variables Specification

Create `.env` in the root workspace following `.env.example`:

```env
# Server
PORT=4000
NODE_ENV=production
HOST=0.0.0.0

# Database & Supabase
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/padupos
SUPABASE_URL=https://[PROJECT-ID].supabase.co
SUPABASE_ANON_KEY=[ANON-KEY]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE-ROLE-KEY]

# Security
JWT_SECRET=[SECURE_RANDOM_STRING_MIN_32_CHARS]

# Non-Custodial Payment Gateway (Sandbox / Production)
PAYMENT_GATEWAY_SERVER_KEY=[GATEWAY_SERVER_KEY]
PAYMENT_GATEWAY_CLIENT_KEY=[GATEWAY_CLIENT_KEY]
PAYMENT_GATEWAY_PROVIDER=sandbox

# Grounded AI Integration
GEMINI_API_KEY=[GEMINI_API_KEY]
```

---

## 3. Database Migration Execution

Apply migrations using the standard Supabase CLI or SQL runner:

```bash
# Push SQL migration to PostgreSQL
pnpm --filter padupos-api run db:migrate
```

---

## 4. Build & Production Start

```bash
# Build all workspaces
pnpm run build

# Start Fastify Modular Monolith
pnpm --filter padupos-api run start

# Start Next.js Frontend
pnpm --filter padupos-web run start
```

---

## 5. Database Backup, Disaster Recovery & Verification

### A. Automated Nightly Snapshot via pg_dump
Execute consistent binary/custom format dumps preserving RLS policies and table constraints:

```bash
# Automated backup command
pg_dump \
  --format=custom \
  --blobs \
  --no-owner \
  --no-privileges \
  --dbname="${DATABASE_URL}" \
  --file="backups/padupos_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### B. Point-in-Time Recovery (PITR) & Restore Procedure
To restore a database snapshot to a staging or disaster-recovery instance:

```bash
# 1. Restore database schema and data
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="${TARGET_DATABASE_URL}" \
  "backups/padupos_backup_[TIMESTAMP].dump"

# 2. Run post-restore integrity verification
pnpm --filter padupos-api run test:db
```

### C. Multi-Tenant Post-Restore Validation Checklist
1. Verify `businesses`, `branches`, and `profiles` row counts match pre-backup metadata.
2. Execute `test:db` suite to ensure Row Level Security (RLS) policies are active and preventing cross-tenant leakage.
3. Verify Chart of Accounts balances by calling `/api/v1/accounting/trial-balance` for all active businesses, confirming $\sum \text{Debit} == \sum \text{Credit}$.
