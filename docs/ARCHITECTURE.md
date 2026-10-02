# ARCHITECTURE.md

PADUPOS — Technical Architecture

## OVERVIEW

PADUPOS is a global-first, configuration-driven AI Business OS for small and growing businesses. Initial market focus: Indonesia. Architecture is modular monolith with clear domain boundaries.


## FRONTEND

**Stack (verified from actual repository):**
- Next.js: ^15.2.0
- React: ^19.0.0
- React DOM: ^19.0.0
- TypeScript: ^5.7.3
- Tailwind CSS: ^3.4.17 (with PostCSS/autoprefixer)
- shadcn/ui-style components in apps/web/src/components/ui
- PWA capabilities present (structure supports PWA; offline module implemented)
- Dexie/IndexedDB: apps/web/src/offline/db.ts implements local database schema
- State management: React Context (AuthContext)
- API client: typed wrapper with auth/business/branch headers


## BACKEND

**Stack (verified):**
- Fastify: ^5.2.1
- TypeScript: ^5.7.3
- Zod: ^3.24.2 (validation via @padupos/validation and inline)
- Modular monolith (domain modules under apps/api/src/modules/)
- Drizzle ORM: ^0.45.3
- Postgres client: postgres ^3.4.5
- bignumber.js for exact decimal arithmetic


## DATA

- Supabase PostgreSQL (configured via DATABASE_URL)
- Supabase Auth (integrated)
- Supabase Storage (supported by schema)
- Realtime: present in schema concepts where applicable
- Drizzle ORM with schema-first approach


## ML

- Python components in workers/ml (present)
- Libraries as defined in workers/ml and ML service implementation
- ML pipeline structure documented in docs/ml/ml-pipeline.md
- Forecasting with data sufficiency/fallback behavior


## MODULE BOUNDARIES

Core domain hierarchy:
- user → profile → membership → business → branch → permission

Request flow:
- frontend → API (typed contracts) → backend (authoritative) → database (Postgres)

Offline flow:
- offline POS → IndexedDB (Dexie) → sync → backend → authoritative result

Payment semantics:
- customer payment (intent/authorization/capture as applicable)
- provider settlement (separate from payment state)
- accounting recognition (posted to journals only by backend)

**Authority:** Backend is the single source of truth for all business rules, financial calculations, and state transitions.

