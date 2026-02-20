import { getAccessToken, ZohoRateLimitError } from './zohoAuth';

/**
 * Shared Zoho CRM API utilities — direct port of the Edge Function helpers.
 */

const API_DOMAIN = process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.eu';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- Module field metadata cache ----------

interface ZohoField {
  api_name: string;
  field_label?: string;
}

const moduleFieldsCache = new Map<string, { fetchedAt: number; fields: ZohoField[] }>();
const CACHE_TTL = 10 * 60 * 1000;

export async function getModuleFields(module: string): Promise<ZohoField[]> {
  const cached = moduleFieldsCache.get(module);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.fields;

  const token = await getAccessToken();
  const res = await fetch(`${API_DOMAIN}/crm/v6/settings/fields?module=${encodeURIComponent(module)}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  if (res.status === 429) throw new ZohoRateLimitError('Rate limited', 60);

  const payload = await res.json() as any;
  const fields = payload.fields || payload.data || [];
  moduleFieldsCache.set(module, { fetchedAt: Date.now(), fields });
  return fields;
}

export function resolveFieldApiName(fields: ZohoField[], candidates: string[]): string | null {
  const lower = candidates.map((c) => c.toLowerCase());
  const byApi = fields.find((f) => lower.includes((f.api_name || '').toLowerCase()));
  if (byApi) return byApi.api_name;
  const byLabel = fields.find((f) => lower.includes((f.field_label || '').toLowerCase()));
  return byLabel?.api_name || null;
}

// ---------- COQL ----------

export async function queryWithCOQL(query: string, maxIterations = 100): Promise<any[]> {
  const token = await getAccessToken();
  const allRecords: any[] = [];
  let offset = 0;
  const limit = 200;

  for (let i = 0; i < maxIterations; i++) {
    const paginatedQuery = `${query} limit ${limit} offset ${offset}`;
    const res = await fetch(`${API_DOMAIN}/crm/v6/coql`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ select_query: paginatedQuery }),
    });

    if (res.status === 429) throw new ZohoRateLimitError('Rate limited', 60);
    if (res.status === 204) break;

    const data = await res.json() as any;
    if (data.code === 'NODATA') break;
    if (data.status === 'error') throw new Error(`COQL error: ${data.message || data.code}`);

    const records = data.data || [];
    allRecords.push(...records);
    if (records.length < limit) break;

    offset += limit;
    await sleep(100);
  }

  return allRecords;
}

// ---------- Record fetching ----------

export async function fetchAllRecords(module: string, params: Record<string, string> = {}): Promise<any[]> {
  const token = await getAccessToken();
  const allRecords: any[] = [];
  let pageToken: string | null = null;

  for (let i = 0; i < 100; i++) {
    const qp = new URLSearchParams({ ...params, per_page: '200' });
    if (pageToken) qp.set('page_token', pageToken);
    else if (i > 0) break;

    const res = await fetch(`${API_DOMAIN}/crm/v6/${module}?${qp}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    if (res.status === 429) throw new ZohoRateLimitError('Rate limited', 60);

    const data = await res.json() as any;
    if (data.code === 'NODATA') break;
    if (data.status === 'error') throw new Error(`Zoho API error: ${data.message || data.code}`);

    if (data.data) allRecords.push(...data.data);
    pageToken = data.info?.next_page_token || data.info?.page_token || null;
    if (!data.info?.more_records || !pageToken) break;
  }

  return allRecords;
}

export async function hydrateRecordsById(module: string, ids: string[], batchSize = 100): Promise<any[]> {
  const token = await getAccessToken();
  const records: any[] = [];

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const res = await fetch(`${API_DOMAIN}/crm/v6/${module}?ids=${batch.join(',')}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    if (res.status === 429) throw new ZohoRateLimitError('Rate limited', 60);

    const data = await res.json() as any;
    if (data.code === 'NODATA') continue;
    if (data.status === 'error') throw new Error(`Zoho hydration error: ${data.message}`);
    if (data.data) records.push(...data.data);

    if (i + batchSize < ids.length) await sleep(200);
  }

  return records;
}

// ---------- Record creation / update ----------

export async function createRecords(module: string, records: any[]): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${API_DOMAIN}/crm/v6/${module}`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: records, trigger: [] }),
  });
  if (res.status === 429) throw new ZohoRateLimitError('Rate limited', 60);
  return res.json();
}

export async function updateRecord(module: string, recordId: string, data: any): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${API_DOMAIN}/crm/v6/${module}/${recordId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: [data] }),
  });
  if (res.status === 429) throw new ZohoRateLimitError('Rate limited', 60);
  return res.json();
}

export async function updateRecordsBatch(module: string, records: any[]): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${API_DOMAIN}/crm/v6/${module}`, {
    method: 'PUT',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: records.map(({ id, ...fields }: any) => ({ id, ...fields })),
      trigger: [],
    }),
  });
  if (res.status === 429) throw new ZohoRateLimitError('Rate limited', 60);
  return res.json();
}
