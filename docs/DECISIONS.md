# DECISIONS.md

Architecture Decision Records (ADRs)

## D001 — Modular Monolith
Chosen for maintainability with clear domain boundaries while avoiding premature microservices complexity.

## D002 — Supabase PostgreSQL
Postgres as authoritative data store with Supabase Auth/Storage integration.

## D003 — True Double-Entry Accounting
Enforces financial correctness via balanced journal entries; posted journals immutable.

## D004 — Non-Custodial Payment Architecture
Clear separation between payment processing, settlement, and accounting recognition.

## D005 — Payment Provider Adapter
Abstract provider specifics behind adapter to support multiple providers (XENDIT) with consistent semantics.

## D006 — Exact Decimal Money
Use NUMERIC/DECIMAL with bignumber.js; never float for monetary values.

## D007 — Global-First Architecture
Configuration-driven (country/currency/locale/tax) to support global expansion starting with Indonesia.

## D008 — AI Read-Only & Grounded
AI must be deterministic, grounded in real data; return INSUFFICIENT_DATA when data inadequate.

## D009 — Offline Cash Sales First
Support offline POS for reliability; sync with authoritative backend and idempotency.

## D010 — Backend Authority Boundary
Backend is single source of truth. Frontend must never compute financial totals, stock, or authorization.

