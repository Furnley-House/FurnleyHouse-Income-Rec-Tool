# Self-Hosting Migration Guide

## Overview

This guide covers migrating the Payment Reconciliation Tool from Lovable Cloud to a self-hosted environment using **Node.js (Express)** + **PostgreSQL** + **Prisma ORM**.

## Architecture Comparison

| Component | Lovable Cloud | Self-Hosted |
|-----------|--------------|-------------|
| Frontend | Lovable preview | Vercel / Netlify / nginx |
| API Layer | Supabase Edge Functions (Deno) | Express.js (Node.js) |
| Database | Supabase PostgreSQL | Self-hosted PostgreSQL |
| Auth | Supabase Auth | Passport.js / custom JWT |
| Zoho Integration | Edge Function `zoho-crm` | Express route `/api/zoho` |
| AI CSV Mapping | Edge Function `csv-mapping-ai` | Express route `/api/csv-mapping` |
| Token Exchange | Edge Function `zoho-token-exchange` | Express route `/api/zoho/token-exchange` |

## Step-by-Step Migration

### 1. Export Code from Lovable

1. Go to **Settings → Connectors → GitHub**
2. Connect your GitHub account and create a repository
3. Clone the repository locally

### 2. Set Up PostgreSQL

Install PostgreSQL locally or use a cloud provider (e.g., AWS RDS, DigitalOcean, Railway).

```bash
createdb payment_reconciliation
```

### 3. Set Up the Node.js Backend

The backend scaffold is in the `backend/` folder of this project.

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your actual values
npx prisma migrate dev
npm run dev
```

### 4. Environment Variables

#### Backend (`backend/.env`)

```env
DATABASE_URL="postgresql://user:password@localhost:5432/payment_reconciliation"
PORT=3001
CORS_ORIGIN="http://localhost:8080"

# Zoho CRM
ZOHO_CLIENT_ID="your_zoho_client_id"
ZOHO_CLIENT_SECRET="your_zoho_client_secret"
ZOHO_REFRESH_TOKEN="your_zoho_refresh_token"
ZOHO_ACCOUNTS_URL="https://accounts.zoho.eu"
ZOHO_API_DOMAIN="https://www.zohoapis.eu"

# AI (OpenAI-compatible endpoint for CSV mapping)
AI_API_KEY="your_openai_or_compatible_api_key"
AI_API_URL="https://api.openai.com/v1/chat/completions"
AI_MODEL="gpt-4o-mini"
```

#### Frontend (`.env`)

Replace the Supabase variables with your backend URL:

```env
VITE_API_BASE_URL="http://localhost:3001/api"
```

### 5. Update Frontend API Calls

All frontend code currently uses `supabase.functions.invoke(...)` and `supabase.from(...)`. These need to change to standard `fetch` calls.

**Before (Supabase):**
```typescript
const { data, error } = await supabase.functions.invoke('zoho-crm', {
  body: { action: 'getPayments', params: { status: 'unreconciled' } }
});
```

**After (Express):**
```typescript
const response = await fetch(`${API_BASE_URL}/zoho`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'getPayments', params: { status: 'unreconciled' } })
});
const data = await response.json();
```

**Before (Supabase DB):**
```typescript
const { data } = await supabase.from('cached_payments').select('*');
```

**After (Express):**
```typescript
const response = await fetch(`${API_BASE_URL}/cache/payments`);
const data = await response.json();
```

### 6. Files to Modify in Frontend

| File | Change Required |
|------|----------------|
| `src/hooks/useZohoData.ts` | Replace `supabase.functions.invoke` with `fetch` |
| `src/hooks/useZohoSync.ts` | Replace `supabase.functions.invoke` with `fetch` |
| `src/hooks/useCacheSync.ts` | Replace `supabase.from(...)` with `fetch` |
| `src/hooks/useCachedData.ts` | Replace `supabase.from(...)` with `fetch` |
| `src/hooks/useSyncStatus.ts` | Replace `supabase.from(...)` with `fetch` |
| `src/features/csv-import/hooks/useAIMapping.ts` | Replace `supabase.functions.invoke` with `fetch` |

### 7. Create an API Client

Create a shared API client to replace Supabase SDK calls:

```typescript
// src/lib/apiClient.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}
```

### 8. Deploy

#### Frontend (Vercel)
```bash
cd your-repo
vercel --prod
```

#### Backend (Railway / Render / VPS)
```bash
cd backend
npm run build
npm start
```

### 9. Data Migration

Export existing data from Lovable Cloud:
1. Open Cloud tab → Database → Tables
2. Export each table as CSV: `cached_payments`, `cached_line_items`, `cached_expectations`, `pending_matches`, `sync_status`
3. Import into your PostgreSQL using Prisma seed or `psql \copy`

## API Route Mapping

| Edge Function | Express Route | Method |
|--------------|---------------|--------|
| `zoho-crm` (all actions) | `/api/zoho` | POST |
| `zoho-token-exchange` | `/api/zoho/token-exchange` | POST |
| `csv-mapping-ai` | `/api/csv-mapping` | POST |
| N/A (was Supabase DB) | `/api/cache/payments` | GET/PUT |
| N/A (was Supabase DB) | `/api/cache/line-items` | GET/PUT |
| N/A (was Supabase DB) | `/api/cache/expectations` | GET/PUT |
| N/A (was Supabase DB) | `/api/cache/pending-matches` | GET/POST/PUT |
| N/A (was Supabase DB) | `/api/cache/sync-status` | GET/PUT |

## Security Notes

- Store all secrets in `.env` (never commit to git)
- Add `.env` to `.gitignore`
- Use HTTPS in production
- Add rate limiting middleware (e.g., `express-rate-limit`)
- Consider adding authentication (JWT or session-based) if multi-user
