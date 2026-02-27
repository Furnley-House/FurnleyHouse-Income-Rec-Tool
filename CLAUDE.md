# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A payment reconciliation platform for Furnley House (and Headleys, Anchor Wealth) that matches bulk provider payments (from Aegon, Aviva, etc.) against fee expectations held in Zoho CRM. Replaces a manual spreadsheet process.

**Architecture:** React SPA (port 8080) ↔ Express backend (port 3001) ↔ PostgreSQL (Prisma) + Zoho CRM (OAuth2) + Azure OpenAI

## Commands

### Frontend (root directory)
```bash
npm run dev        # Start Vite dev server on port 8080
npm run build      # Production build
npm run lint       # ESLint
```

### Backend (`/backend` directory)
```bash
npm run dev        # tsx watch (hot-reload) on port 3001
npm run build      # tsc compile to dist/
npm start          # Run compiled dist/index.js
npm run db:migrate # Prisma migrate dev
npm run db:push    # Push schema without migration
```

No test framework is configured.

## Environment Setup

**Frontend (`.env` in root):**
```
VITE_API_URL=http://localhost:3001
```

**Backend (`/backend/.env`):**
```
DATABASE_URL="postgresql://..."
PORT=3001
CORS_ORIGIN="http://localhost:8080"
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
ZOHO_ACCOUNTS_URL="https://accounts.zoho.eu"
ZOHO_API_DOMAIN="https://www.zohoapis.eu"
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT="gpt-4o-mini"
AZURE_OPENAI_API_VERSION="2024-08-01-preview"
```

## Architecture

### Frontend (`/src`)
- **Router:** `App.tsx` → `/` (Home), `/reconciliation` (main workspace), `/import/csv-mapper`
- **State:** Zustand store at `src/store/reconciliationStore.ts` — owns all reconciliation state (payments, expectations, matches, filters, statistics)
- **Server state:** TanStack React Query for async fetching
- **API client:** `src/lib/api.ts` — wraps all backend calls, returns `{data, error}` tuples

Key hooks:
- `useZohoData.ts` — fetch payments/expectations from Zoho via backend
- `useZohoSync.ts` — sync confirmed matches back to Zoho
- `useCachedData.ts` — read from PostgreSQL cache
- `useCacheSync.ts` — write matches to PostgreSQL cache

### Backend (`/backend/src`)
- `index.ts` — Express setup, CORS
- `routes/zoho.ts` — action-based dispatch (`POST /api/zoho` with `action` field)
- `routes/csvMapping.ts` — `POST /api/csv-mapping`, calls Azure OpenAI
- `routes/cache.ts` — CRUD for PostgreSQL cache (`/api/cache/*`)
- `lib/zohoAuth.ts` — OAuth2 refresh token flow with in-memory + DB token caching
- `lib/zohoApi.ts` — Zoho API wrapper functions

### Database (Prisma / PostgreSQL)
Models: `CachedPayment`, `CachedLineItem`, `CachedExpectation`, `PendingMatch`, `SyncStatus`, `ZohoTokenCache`

### Zoho CRM Modules
- `Bank_Payments` — parent payment records (one per provider statement)
- `Bank_Payment_Lines` — individual line items within a payment
- `Expectations` — expected fee calculations from client plans
- `Payment_Matches` — confirmed matches written back after reconciliation
- `Providers` — reference data (supports parent/child hierarchy)

## Reconciliation Workflow

**Phase 1 — CSV Import:** User uploads provider CSV → AI maps columns (Azure OpenAI) → validated line items stored in Zoho as `Bank_Payment_Lines`

**Phase 2 — Data Download:** Fetch from Zoho in order: Providers → Bank_Payments → Bank_Payment_Lines → Expectations. All records cached in PostgreSQL (no status filtering — Zoho has blank status data quality issues).

**Phase 3 — Matching:** Prescreening mode auto-matches on Plan/Policy Reference with progressive variance tolerance (exact → 1% → 5% → 10% → 25%). User accepts/manually matches/invalidates remaining items.

**Phase 4 — Sync:** Three-phase batch sync (100 records/call): create `Payment_Matches` → update `Bank_Payment_Lines` statuses → update `Expectations` statuses. Halts on Zoho rate limit (60s cooldown).

## Key Design Decisions

- **No real-time Zoho queries:** Rate limits (200-record query limit, calls-per-minute cap) make this impractical for 3,000+ records — always fetch-cache-work.
- **Fetch-Work-Sync cycle:** Only one download session active at a time; sync must complete before new data loads.
- **OAuth token in DB:** All backend instances share one token via `ZohoTokenCache` — prevents refresh flooding.
- **Action-based Zoho route:** `POST /api/zoho` dispatches on the `action` field rather than REST resource routes.
- **Frontend TypeScript is permissive:** `noImplicitAny: false`, strict null checks disabled. Backend TypeScript is strict.

## UI Components

Uses shadcn/ui (Radix UI + Tailwind). Add new components via: `npx shadcn@latest add <component>` from the root directory. Component config is in `components.json`. Path alias `@` maps to `./src`.
