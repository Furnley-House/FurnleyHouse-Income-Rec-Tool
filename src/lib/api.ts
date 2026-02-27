/**
 * API client for the Node.js backend.
 * Replaces all supabase.functions.invoke() and supabase.from() calls.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

// ─── Zoho CRM (replaces supabase.functions.invoke('zoho-crm')) ───

/**
 * Call the Zoho CRM endpoint.
 * Returns { data, error } to match the existing supabase.functions.invoke() shape.
 */
export async function callZoho(
  action: string,
  params: Record<string, unknown> = {}
): Promise<{ data: any; error: any }> {
  try {
    const res = await fetch(`${API_BASE}/api/zoho`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params }),
    });
    const data = await res.json();
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err.message || 'Network error' } };
  }
}

// ─── CSV Mapping AI (replaces supabase.functions.invoke('csv-mapping-ai')) ───

/**
 * Call the CSV mapping AI endpoint.
 * Returns { data, error } to match the existing supabase.functions.invoke() shape.
 */
export async function callCsvMapping(body: {
  columns: any[];
  providerName: string;
}): Promise<{ data: any; error: any }> {
  try {
    const res = await fetch(`${API_BASE}/api/csv-mapping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    // The CSV mapping endpoint returns the result directly (not wrapped in {success, data})
    // If there's an error field in the response, surface it
    if (data.error) {
      return { data, error: null }; // Let the caller handle data.error
    }
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err.message || 'Network error' } };
  }
}

// ─── Cache API (replaces supabase.from('table_name') calls) ───

async function cacheGet(path: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/cache${path}`);
  return res.json();
}

async function cachePost(path: string, body: any): Promise<any> {
  const res = await fetch(`${API_BASE}/api/cache${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function cachePut(path: string, body: any): Promise<any> {
  const res = await fetch(`${API_BASE}/api/cache${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function cacheDelete(path: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/cache${path}`, { method: 'DELETE' });
  return res.json();
}

export const cacheApi = {
  // ── Payments ──
  getPayments: () => cacheGet('/payments'),
  bulkUpsertPayments: (payments: any[]) => cachePost('/payments/bulk', { payments }),
  updatePayment: (id: string, data: any) => cachePut(`/payments/${id}`, data),
  deleteAllPayments: () => cacheDelete('/payments'),

  // ── Line Items ──
  getLineItems: (paymentId?: string) =>
    cacheGet(`/line-items${paymentId ? `?paymentId=${paymentId}` : ''}`),
  bulkUpsertLineItems: (lineItems: any[]) => cachePost('/line-items/bulk', { lineItems }),
  updateLineItem: (id: string, data: any) => cachePut(`/line-items/${id}`, data),
  deleteAllLineItems: () => cacheDelete('/line-items'),

  // ── Expectations ──
  getExpectations: () => cacheGet('/expectations'),
  bulkUpsertExpectations: (expectations: any[]) =>
    cachePost('/expectations/bulk', { expectations }),
  updateExpectation: (id: string, data: any) => cachePut(`/expectations/${id}`, data),
  deleteAllExpectations: () => cacheDelete('/expectations'),

  // ── Pending Matches ──
  getPendingMatches: () => cacheGet('/pending-matches'),
  createPendingMatch: (data: any) => cachePost('/pending-matches', data),
  bulkUpsertPendingMatches: (matches: any[]) =>
    cachePost('/pending-matches/bulk', { matches }),
  updatePendingMatch: (id: string, data: any) => cachePut(`/pending-matches/${id}`, data),
  deleteAllPendingMatches: () => cacheDelete('/pending-matches'),
  deleteSyncedPendingMatches: () => cacheDelete('/pending-matches?syncedOnly=true'),

  // ── Sync Status ──
  getSyncStatus: () => cacheGet('/sync-status'),
  updateSyncStatus: (data: any) => cachePut('/sync-status', data),
};
