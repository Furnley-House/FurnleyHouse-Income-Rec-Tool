import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Cache for access token (in-memory, resets on cold start)
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;
let refreshInFlight: Promise<string> | null = null;

interface ZohoTokenResponse {
  access_token: string;
  expires_in: number;
  api_domain: string;
  token_type: string;
  error?: string;
  error_description?: string;
  status?: string;
}

class ZohoRateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(message: string, retryAfterSeconds = 60) {
    super(message);
    this.name = "ZohoRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatZohoDateTime(date: Date = new Date()): string {
  // Zoho datetime commonly expects timezone offset format (no milliseconds)
  // e.g. 2026-02-03T12:34:56+00:00
  return date.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

function redactTokenLog(tokenData: ZohoTokenResponse) {
  const { access_token: _accessToken, ...rest } = tokenData;
  return rest;
}

function extractZohoApiError(payload: unknown): string | null {
  try {
    const p: any = payload;
    const first = p?.data?.[0];
    if (!first) return null;
    if (first.status === "error") {
      const apiName = first?.details?.api_name ? ` (${first.details.api_name})` : "";
      return `${first.message || "Zoho returned an error"}${apiName}`;
    }
    return null;
  } catch {
    return null;
  }
}

interface ZohoRecord {
  id: string;
  [key: string]: unknown;
}

interface ZohoListResponse {
  data?: ZohoRecord[];
  info?: {
    per_page: number;
    count: number;
    page: number;
    more_records: boolean;
    page_token?: string;  // Required for pagination beyond 2000 records in API v6
    next_page_token?: string;  // Alternative field name
  };
  status?: string;
  code?: string;
  message?: string;
}

interface ZohoField {
  api_name: string;
  field_label?: string;
}

interface ZohoFieldsResponse {
  fields?: ZohoField[];
  data?: ZohoField[];
}

const moduleFieldsCache = new Map<string, { fetchedAt: number; fields: ZohoField[] }>();
const MODULE_FIELDS_CACHE_TTL_MS = 10 * 60 * 1000;

async function getModuleFields(accessToken: string, module: string): Promise<ZohoField[]> {
  const cached = moduleFieldsCache.get(module);
  const now = Date.now();

  if (cached && now - cached.fetchedAt < MODULE_FIELDS_CACHE_TTL_MS) {
    return cached.fields;
  }

  const apiDomain = "https://www.zohoapis.eu";
  const url = `${apiDomain}/crm/v6/settings/fields?module=${encodeURIComponent(module)}`;

  console.log(`[Zoho] Loading field metadata for module: ${module}`);

  const response = await fetch(url, {
    headers: {
      "Authorization": `Zoho-oauthtoken ${accessToken}`,
    },
  });

  if (response.status === 429) {
    throw new ZohoRateLimitError("Zoho API rate limited", 60);
  }

  const payload: ZohoFieldsResponse & { status?: string; code?: string; message?: string } = await response.json();

  if ((payload as any)?.status === "error" || (payload as any)?.code) {
    throw new Error(`Zoho API error: ${(payload as any)?.message || (payload as any)?.code}`);
  }

  const fields = payload.fields || payload.data || [];
  moduleFieldsCache.set(module, { fetchedAt: now, fields });
  return fields;
}

function resolveFieldApiName(fields: ZohoField[], candidates: string[]): string | null {
  const normalizedCandidates = candidates.map((c) => c.toLowerCase());

  const byApi = fields.find((f) => normalizedCandidates.includes((f.api_name || "").toLowerCase()));
  if (byApi?.api_name) return byApi.api_name;

  const byLabel = fields.find((f) => normalizedCandidates.includes((f.field_label || "").toLowerCase()));
  if (byLabel?.api_name) return byLabel.api_name;

  return null;
}

// Get a valid access token, checking DB cache first to avoid redundant refreshes across cold starts
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  
  // Return in-memory cached token if still valid (with 5 min buffer)
  if (cachedAccessToken && tokenExpiresAt > now + 300000) {
    console.log("Using in-memory cached access token");
    return cachedAccessToken;
  }

  // If another request is already refreshing, await it (prevents stampede)
  if (refreshInFlight) {
    console.log("Awaiting in-flight token refresh");
    return await refreshInFlight;
  }

  refreshInFlight = (async () => {
    // Check DB-cached token first (shared across all edge function instances)
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const db = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: cached } = await db
        .from('zoho_token_cache')
        .select('access_token, expires_at')
        .eq('id', 'default')
        .single();
      
      if (cached?.access_token && cached?.expires_at) {
        const expiresAtMs = new Date(cached.expires_at).getTime();
        if (expiresAtMs > now + 300000) {
          console.log("Using DB-cached access token");
          cachedAccessToken = cached.access_token;
          tokenExpiresAt = expiresAtMs;
          return cachedAccessToken;
        }
      }
    } catch (dbErr) {
      console.warn("DB token cache read failed, will refresh:", dbErr);
    }

    console.log("Refreshing access token...");
  
    const clientId = Deno.env.get("ZOHO_CLIENT_ID");
    const clientSecret = Deno.env.get("ZOHO_CLIENT_SECRET");
    const refreshToken = Deno.env.get("ZOHO_REFRESH_TOKEN");

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error("Missing Zoho credentials. Please configure ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN.");
    }

    // Use EU accounts endpoint
    const tokenUrl = "https://accounts.zoho.eu/oauth/v2/token";

    // Retry a few times on Zoho throttling
    const backoffMs = [500, 1500, 3000];
    let lastError: string | null = null;

    for (let attempt = 0; attempt < backoffMs.length; attempt++) {
      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
      });

      const tokenData: ZohoTokenResponse = await tokenResponse.json();
      console.log("Token refresh response:", JSON.stringify(redactTokenLog(tokenData), null, 2));

      if (tokenData.error) {
        lastError = tokenData.error_description || tokenData.error;

        // Zoho sometimes returns Access Denied when rate-limited
        const isRateLimited =
          tokenData.error === "Access Denied" &&
          (tokenData.error_description || "").toLowerCase().includes("too many requests");

        if (isRateLimited && attempt < backoffMs.length - 1) {
          console.warn(`Zoho token refresh rate-limited. Backing off ${backoffMs[attempt]}ms...`);
          await sleep(backoffMs[attempt]);
          continue;
        }

        if (isRateLimited) {
          throw new ZohoRateLimitError(
            `Token refresh rate-limited: ${tokenData.error_description || tokenData.error}`,
            60
          );
        }

        throw new Error(`Token refresh failed: ${tokenData.error}${tokenData.error_description ? ` (${tokenData.error_description})` : ""}`);
      }

      cachedAccessToken = tokenData.access_token;
      tokenExpiresAt = now + tokenData.expires_in * 1000;
      
      // Persist to DB so other instances can reuse
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const db = createClient(supabaseUrl, supabaseServiceKey);
        
        await db
          .from('zoho_token_cache')
          .upsert({
            id: 'default',
            access_token: cachedAccessToken,
            expires_at: new Date(tokenExpiresAt).toISOString(),
            updated_at: new Date().toISOString(),
          });
        console.log("Access token cached to DB");
      } catch (dbErr) {
        console.warn("Failed to cache token to DB:", dbErr);
      }
      
      return cachedAccessToken;
    }

    // Shouldn't reach here, but just in case
    throw new Error(`Token refresh failed: ${lastError || "Unknown error"}`);
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

// Fetch records from a Zoho CRM module
async function fetchModule(
  accessToken: string, 
  module: string, 
  params: Record<string, string> = {}
): Promise<ZohoRecord[]> {
  const apiDomain = "https://www.zohoapis.eu";
  const queryParams = new URLSearchParams(params);
  const url = `${apiDomain}/crm/v6/${module}?${queryParams}`;
  
  console.log(`Fetching ${module}:`, url);

  const response = await fetch(url, {
    headers: {
      "Authorization": `Zoho-oauthtoken ${accessToken}`,
    },
  });

  const data: ZohoListResponse = await response.json();
  
  if (data.status === "error" || data.code) {
    console.error(`Error fetching ${module}:`, data);
    throw new Error(`Zoho API error: ${data.message || data.code}`);
  }

  return data.data || [];
}

// Fetch records with pagination using page_token (required for >2000 records in API v6)
async function fetchAllRecords(
  accessToken: string,
  module: string,
  params: Record<string, string> = {},
  maxIterations: number = 100  // Safety limit to prevent infinite loops
): Promise<ZohoRecord[]> {
  const allRecords: ZohoRecord[] = [];
  let pageToken: string | null = null;
  let iteration = 0;

  while (iteration < maxIterations) {
    const apiDomain = "https://www.zohoapis.eu";
    const queryParams = new URLSearchParams({ ...params, per_page: "200" });
    
    // Use page_token for subsequent requests (required for >2000 records)
    if (pageToken) {
      queryParams.set("page_token", pageToken);
    } else if (iteration > 0) {
      // If we don't have a page_token but this isn't the first request, we're done
      break;
    }
    
    const url = `${apiDomain}/crm/v6/${module}?${queryParams}`;
    
    console.log(`Fetching ${module} iteration ${iteration + 1}:`, url);

    const response = await fetch(url, {
      headers: {
        "Authorization": `Zoho-oauthtoken ${accessToken}`,
      },
    });

    const data: ZohoListResponse = await response.json();
    
    if (data.status === "error" || data.code) {
      // NODATA is not an error - just means empty result
      if (data.code === "NODATA") {
        console.log(`No data found for ${module}`);
        break;
      }
      console.error(`Error fetching ${module}:`, data);
      throw new Error(`Zoho API error: ${data.message || data.code}`);
    }

    if (data.data) {
      allRecords.push(...data.data);
      console.log(`Fetched ${data.data.length} records, total so far: ${allRecords.length}`);
    }

    // Get next page token - check both possible field names
    pageToken = data.info?.next_page_token || data.info?.page_token || null;
    
    // Check if there are more records
    if (!data.info?.more_records || !pageToken) {
      console.log(`No more records for ${module}`);
      break;
    }
    
    iteration++;
  }

  console.log(`Fetched ${allRecords.length} total records from ${module}`);
  return allRecords;
}

// Use COQL for complex queries with filters - now with pagination support
async function queryWithCOQL(
  accessToken: string,
  query: string,
  maxIterations: number = 100  // Safety limit
): Promise<ZohoRecord[]> {
  const apiDomain = "https://www.zohoapis.eu";
  const allRecords: ZohoRecord[] = [];
  let offset = 0;
  const limit = 200; // COQL max per page
  let iteration = 0;

  console.log("Executing COQL query with pagination:", query);

  while (iteration < maxIterations) {
    // COQL uses LIMIT and OFFSET for pagination
    const paginatedQuery = `${query} limit ${limit} offset ${offset}`;
    const url = `${apiDomain}/crm/v6/coql`;

    console.log(`COQL iteration ${iteration + 1}: offset ${offset}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ select_query: paginatedQuery }),
    });

    if (response.status === 429) {
      throw new ZohoRateLimitError("Zoho API rate limited", 60);
    }

    // Zoho sometimes returns 204 No Content for empty COQL results
    if (response.status === 204) {
      console.log("COQL query returned 204 (no content) - no more records");
      break;
    }

    const raw = await response.text();
    if (!raw) {
      console.error("COQL empty response", {
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`COQL error: empty response (HTTP ${response.status})`);
    }

    let data: ZohoListResponse;
    try {
      data = JSON.parse(raw) as ZohoListResponse;
    } catch {
      console.error("COQL non-JSON response", {
        status: response.status,
        statusText: response.statusText,
        bodyPreview: raw.slice(0, 400),
      });
      throw new Error(`COQL error: non-JSON response (HTTP ${response.status})`);
    }

    if ((data as any).status === "error" || (data as any).code) {
      if ((data as any).code === "NODATA") {
        console.log("COQL query returned no data - pagination complete");
        break;
      }
      console.error("COQL error:", data);
      throw new Error(`COQL error: ${(data as any).message || (data as any).code}`);
    }

    const records = data.data || [];
    allRecords.push(...records);
    console.log(`COQL fetched ${records.length} records, total so far: ${allRecords.length}`);

    // If we got fewer than limit, we've reached the end
    if (records.length < limit) {
      console.log("COQL pagination complete - received fewer than limit");
      break;
    }

    offset += limit;
    iteration++;

    // Small delay to avoid rate limiting
    await sleep(100);
  }

  console.log(`COQL total records fetched: ${allRecords.length}`);
  return allRecords;
}

async function fetchRecordById(
  accessToken: string,
  module: string,
  recordId: string
): Promise<ZohoRecord | null> {
  const apiDomain = "https://www.zohoapis.eu";
  const url = `${apiDomain}/crm/v6/${module}/${recordId}`;

  const response = await fetch(url, {
    headers: {
      "Authorization": `Zoho-oauthtoken ${accessToken}`,
    },
  });

  if (response.status === 429) {
    throw new ZohoRateLimitError("Zoho API rate limited", 60);
  }

  const payload: ZohoListResponse = await response.json();

  if (payload.status === "error" || payload.code) {
    // NODATA is not an error - just means no result
    if (payload.code === "NODATA") return null;
    throw new Error(`Zoho API error: ${payload.message || payload.code}`);
  }

  const apiErr = extractZohoApiError(payload);
  if (apiErr) throw new Error(`Zoho API error: ${apiErr}`);

  return payload.data?.[0] || null;
}

async function hydrateRecordsById(
  accessToken: string,
  module: string,
  ids: string[],
  options: { delayMs?: number; maxRecords?: number; batchSize?: number } = {}
): Promise<ZohoRecord[]> {
  const delayMs = options.delayMs ?? 200;
  const maxRecords = options.maxRecords ?? 10000;
  const batchSize = options.batchSize ?? 100; // Zoho supports up to 100 IDs per GET request

  const limitedIds = ids.slice(0, maxRecords);
  const records: ZohoRecord[] = [];
  const apiDomain = "https://www.zohoapis.eu";

  console.log(`[Zoho] Hydrating ${limitedIds.length} records from ${module} in batches of ${batchSize}`);

  for (let i = 0; i < limitedIds.length; i += batchSize) {
    const batchIds = limitedIds.slice(i, i + batchSize);
    const idsParam = batchIds.join(",");
    const url = `${apiDomain}/crm/v6/${module}?ids=${idsParam}`;

    const response = await fetch(url, {
      headers: {
        "Authorization": `Zoho-oauthtoken ${accessToken}`,
      },
    });

    if (response.status === 429) {
      throw new ZohoRateLimitError("Zoho API rate limited during hydration", 60);
    }

    const payload: ZohoListResponse = await response.json();

    if (payload.status === "error" || payload.code) {
      if (payload.code === "NODATA") {
        console.log(`[Zoho] No data for batch starting at ${i}`);
        continue;
      }
      throw new Error(`Zoho API error during hydration: ${payload.message || payload.code}`);
    }

    if (payload.data) {
      records.push(...payload.data);
    }

    console.log(`[Zoho] Hydrated batch ${Math.floor(i / batchSize) + 1}: ${records.length}/${limitedIds.length} records`);

    // Small delay between batches to avoid rate limiting
    if (delayMs > 0 && i + batchSize < limitedIds.length) {
      await sleep(delayMs);
    }
  }

  console.log(`[Zoho] Hydration complete: ${records.length} records from ${module}`);
  return records;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, params = {} } = await req.json();

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Action is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getAccessToken();

    let result: unknown;

    switch (action) {
      case "test": {
        // Simple test to verify connection
        const org = await fetch("https://www.zohoapis.eu/crm/v6/org", {
          headers: { "Authorization": `Zoho-oauthtoken ${accessToken}` },
        });
        result = await org.json();
        break;
      }

      case "getPayments": {
        // Fetch Bank_Payments with optional status filter
        // Important: COQL is strict about field API names. We resolve the actual API name for
        // fields like "Status" first, then hydrate full records by id.

        if (params.status) {
          const moduleFields = await getModuleFields(accessToken, "Bank_Payments");
          const statusField = resolveFieldApiName(moduleFields, ["Status"]);
          if (!statusField) {
            throw new Error("Could not resolve Bank_Payments status field (expected label/api_name 'Status')");
          }

          const statusFilter = Array.isArray(params.status)
            ? params.status.map((s: string) => `'${s}'`).join(", ")
            : `'${params.status}'`;

          const query = `select id from Bank_Payments where ${statusField} in (${statusFilter})`;
          console.log("[Zoho] COQL query:", query);

          const hits = await queryWithCOQL(accessToken, query);
          const ids = hits.map((r) => String(r.id)).filter(Boolean);
          result = await hydrateRecordsById(accessToken, "Bank_Payments", ids);
        } else {
          result = await fetchAllRecords(accessToken, "Bank_Payments");
        }
        break;
      }

      case "getPaymentLineItems": {
        // Fetch Bank_Payment_Lines with optional filters
        // Same approach as payments: resolve field API names for COQL filters -> hydrate full records.

        const moduleFields = await getModuleFields(accessToken, "Bank_Payment_Lines");
        const statusField = resolveFieldApiName(moduleFields, ["Status"]);
        const paymentLookupField = resolveFieldApiName(moduleFields, ["Bank_Payment", "Bank Payment"]);

        if (params.paymentId) {
          if (!paymentLookupField) {
            throw new Error("Could not resolve Bank_Payment_Lines payment lookup field (expected label/api_name 'Bank_Payment')");
          }

          const query = `select id from Bank_Payment_Lines where ${paymentLookupField} = '${params.paymentId}'`;
          console.log("[Zoho] COQL query:", query);

          const hits = await queryWithCOQL(accessToken, query);
          const ids = hits.map((r) => String(r.id)).filter(Boolean);
          result = await hydrateRecordsById(accessToken, "Bank_Payment_Lines", ids);
        } else if (params.status) {
          if (!statusField) {
            throw new Error("Could not resolve Bank_Payment_Lines status field (expected label/api_name 'Status')");
          }

          const statusFilter = Array.isArray(params.status)
            ? params.status.map((s: string) => `'${s}'`).join(", ")
            : `'${params.status}'`;

          const query = `select id from Bank_Payment_Lines where ${statusField} in (${statusFilter})`;
          console.log("[Zoho] COQL query:", query);

          const hits = await queryWithCOQL(accessToken, query);
          const ids = hits.map((r) => String(r.id)).filter(Boolean);
          result = await hydrateRecordsById(accessToken, "Bank_Payment_Lines", ids);
        } else {
          result = await fetchAllRecords(accessToken, "Bank_Payment_Lines");
        }
        break;
      }

      case "getExpectations": {
        // Fetch Expectations with flexible filtering
        // Resolve field API names (Zoho can differ per org) -> COQL filter -> hydrate full records.

        const moduleFields = await getModuleFields(accessToken, "Expectations");
        const statusApi = resolveFieldApiName(moduleFields, ["Status", "Expectation_Status", "Expectation Status"]);
        const providerApi = resolveFieldApiName(moduleFields, ["Provider", "Provider_Name", "Provider Name"]);
        const superbiaApi = resolveFieldApiName(moduleFields, ["Superbia_Company", "Superbia Company"]);
        const calcDateApi = resolveFieldApiName(moduleFields, ["Calculation_Date", "Calculation Date"]);

        const conditions: string[] = [];

        if (params.status) {
          if (!statusApi) {
            throw new Error("Could not resolve Expectations status field (label/api_name like 'Status')");
          }

          const statusFilter = Array.isArray(params.status)
            ? params.status.map((s: string) => `'${s}'`).join(", ")
            : `'${params.status}'`;
          conditions.push(`${statusApi} in (${statusFilter})`);
        }

        if (params.providerId) {
          if (providerApi) {
            conditions.push(`${providerApi} = '${params.providerId}'`);
          } else {
            console.warn("[Zoho] providerId filter requested but Provider field could not be resolved; skipping filter");
          }
        }

        if (params.superbiaCompany) {
          if (superbiaApi) {
            const companies = Array.isArray(params.superbiaCompany)
              ? params.superbiaCompany.map((c: string) => `'${c}'`).join(", ")
              : `'${params.superbiaCompany}'`;
            conditions.push(`${superbiaApi} in (${companies})`);
          } else {
            console.warn("[Zoho] superbiaCompany filter requested but field could not be resolved; skipping filter");
          }
        }

        if (params.dateFrom) {
          if (calcDateApi) {
            conditions.push(`${calcDateApi} >= '${params.dateFrom}'`);
          } else {
            console.warn("[Zoho] dateFrom filter requested but Calculation Date field could not be resolved; skipping filter");
          }
        }

        if (params.dateTo) {
          if (calcDateApi) {
            conditions.push(`${calcDateApi} <= '${params.dateTo}'`);
          } else {
            console.warn("[Zoho] dateTo filter requested but Calculation Date field could not be resolved; skipping filter");
          }
        }

        if (conditions.length > 0) {
          const query = `select id from Expectations where ${conditions.join(" and ")}`;
          console.log("[Zoho] COQL query:", query);

          const hits = await queryWithCOQL(accessToken, query);
          const ids = hits.map((r) => String(r.id)).filter(Boolean);
          result = await hydrateRecordsById(accessToken, "Expectations", ids);
        } else {
          // Some Zoho orgs require the `fields` parameter for module list endpoints.
          // Fetch only the fields we need for reconciliation to keep payloads small.
          const fields =
            "id,Plan_Policy_Reference,Client_1,Expected_Fee_Amount,Calculation_Date,Fee_Category,Fee_Type,Provider,Adviser_Name,Superbia_Company,Status,Allocated_Amount,Remaining_Amount";
          result = await fetchAllRecords(accessToken, "Expectations", { fields });
        }
        break;
      }

      case "getProviders": {
        // Fetch Providers
        const fields = "Provider_ID,Name,Provider_Code,Provider_Group,Is_Payment_Source,Active";
        result = await fetchAllRecords(accessToken, "Providers", { fields });
        break;
      }

      case "getMatches": {
        // Fetch Payment_Matches
        // Note: "id" is the record identifier.
        const fields = "id,Bank_Payment_Ref_Match,Payment_Line_Match,Expectation,Matched_Amount,Variance,Variance_Percentage,Match_Type,Match_Method,Match_Quality,Notes,Matched_By,Matched_At,Confirmed";
        
        if (params.paymentId) {
          const query = `select ${fields} from Payment_Matches where Bank_Payment_Ref_Match = '${params.paymentId}'`;
          result = await queryWithCOQL(accessToken, query);
        } else {
          result = await fetchAllRecords(accessToken, "Payment_Matches", { fields });
        }
        break;
      }

      case "createMatch": {
        // Create a new Match record
        const apiDomain = "https://www.zohoapis.eu";
        const matchData = {
          data: [{
            Name: `Match-${Date.now()}`,
            Bank_Payment_Ref_Match: { id: params.paymentId },
            Payment_Line_Match: { id: params.lineItemId },
            Expectation: { id: params.expectationId },
            Matched_Amount: params.matchedAmount,
            Variance: params.variance || 0,
            Variance_Percentage: params.variancePercentage || 0,
            Match_Type: params.matchType || "full",
            Match_Method: params.matchMethod || "manual",
            Match_Quality: params.matchQuality || "good",
            Notes: params.notes || "",
            Matched_At: formatZohoDateTime(new Date()),
            Confirmed: true,
          }]
        };

        const createResponse = await fetch(`${apiDomain}/crm/v6/Payment_Matches`, {
          method: "POST",
          headers: {
            "Authorization": `Zoho-oauthtoken ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(matchData),
        });

        const payload = await createResponse.json();
        const apiErr = extractZohoApiError(payload);
        if (apiErr) {
          result = { success: false, error: apiErr, data: payload };
        } else {
          result = payload;
        }
        break;
      }

      case "createMatchBatch": {
        // Create up to 100 match records in a single Zoho API call
        const apiDomain = "https://www.zohoapis.eu";
        const records = params.records;

        if (!Array.isArray(records) || records.length === 0) {
          throw new Error("records array is required for createMatchBatch");
        }

        if (records.length > 100) {
          throw new Error("Maximum 100 records per batch (Zoho API limit)");
        }

        const now = formatZohoDateTime(new Date());
        const batchData = {
          data: records.map((r: any, idx: number) => {
            const record: Record<string, unknown> = {
              Name: `Match-${Date.now()}-${idx}`,
              Bank_Payment_Ref_Match: { id: r.paymentId },
              Payment_Line_Match: { id: r.lineItemId },
              Matched_Amount: r.matchedAmount,
              Variance: r.variance || 0,
              Variance_Percentage: r.variancePercentage || 0,
              Match_Type: r.matchType || "full",
              Match_Method: r.matchMethod || "manual",
              Match_Quality: r.matchQuality || "good",
              Notes: r.notes || "",
              Matched_At: now,
              Confirmed: true,
            };
            // Only include Expectation if provided (data-check matches have none)
            if (r.expectationId) {
              record.Expectation = { id: r.expectationId };
            }
            // Include No_Match_Reason_Code if provided (for data-check approved items)
            if (r.reasonCode) {
              record.No_Match_Reason_Code = r.reasonCode;
            }
            return record;
          }),
          trigger: [] // Skip workflow triggers for batch performance
        };

        console.log(`[Zoho] Creating batch of ${records.length} match records`);

        const batchResponse = await fetch(`${apiDomain}/crm/v6/Payment_Matches`, {
          method: "POST",
          headers: {
            "Authorization": `Zoho-oauthtoken ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(batchData),
        });

        if (batchResponse.status === 429) {
          throw new ZohoRateLimitError("Zoho API rate limited during batch insert", 60);
        }

        const batchPayload = await batchResponse.json();
        console.log(`[Zoho] Batch response:`, JSON.stringify(batchPayload, null, 2));

        // Parse per-record results
        const results = (batchPayload?.data || []).map((item: any, idx: number) => ({
          index: idx,
          status: item?.status || "error",
          id: item?.details?.id || null,
          code: item?.code || null,
          message: item?.message || null,
          details: item?.details || null,
        }));

        const successCount = results.filter((r: any) => r.status === "success").length;
        const failedCount = results.length - successCount;

        console.log(`[Zoho] Batch result: ${successCount} success, ${failedCount} failed out of ${records.length}`);

        result = {
          batchResults: results,
          successCount,
          failedCount,
          totalRequested: records.length,
        };
        break;
      }

      case "updateRecord": {
        // Generic update for any module
        const { module, recordId, data } = params;
        if (!module || !recordId || !data) {
          throw new Error("module, recordId, and data are required for updateRecord");
        }

        const apiDomain = "https://www.zohoapis.eu";
        const updateResponse = await fetch(`${apiDomain}/crm/v6/${module}/${recordId}`, {
          method: "PUT",
          headers: {
            "Authorization": `Zoho-oauthtoken ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: [data] }),
        });

        const payload = await updateResponse.json();
        const apiErr = extractZohoApiError(payload);
        if (apiErr) {
          result = { success: false, error: apiErr, data: payload };
        } else {
          result = payload;
        }
        break;
      }

      case "updateRecordsBatch": {
        // Batch update up to 100 records in a single module
        const { module: batchModule, records: batchRecords } = params;
        if (!batchModule || !Array.isArray(batchRecords) || batchRecords.length === 0) {
          throw new Error("module and records array are required for updateRecordsBatch");
        }
        if (batchRecords.length > 100) {
          throw new Error("Maximum 100 records per batch (Zoho API limit)");
        }

        const apiDomain = "https://www.zohoapis.eu";
        console.log(`[Zoho] Batch updating ${batchRecords.length} records in ${batchModule}`);

        const updatePayload = {
          data: batchRecords.map((r: any) => {
            const { id, ...fields } = r;
            return { id, ...fields };
          }),
          trigger: [] // Skip workflow triggers for batch performance
        };

        const batchUpdateResponse = await fetch(`${apiDomain}/crm/v6/${batchModule}`, {
          method: "PUT",
          headers: {
            "Authorization": `Zoho-oauthtoken ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatePayload),
        });

        if (batchUpdateResponse.status === 429) {
          throw new ZohoRateLimitError("Zoho API rate limited during batch update", 60);
        }

        const batchUpdatePayload = await batchUpdateResponse.json();
        console.log(`[Zoho] Batch update response:`, JSON.stringify(batchUpdatePayload, null, 2));

        const updateResults = (batchUpdatePayload?.data || []).map((item: any, idx: number) => ({
          index: idx,
          status: item?.status || "error",
          id: item?.details?.id || null,
          code: item?.code || null,
          message: item?.message || null,
          details: item?.details || null,
        }));

        // Log first few errors with details for debugging
        const firstErrors = updateResults.filter((r: any) => r.status !== "success").slice(0, 3);
        if (firstErrors.length > 0) {
          console.log(`[Zoho] First ${firstErrors.length} update errors:`, JSON.stringify(firstErrors, null, 2));
        }

        const updateSuccessCount = updateResults.filter((r: any) => r.status === "success").length;
        const updateFailedCount = updateResults.length - updateSuccessCount;

        console.log(`[Zoho] Batch update: ${updateSuccessCount} success, ${updateFailedCount} failed`);

        result = {
          batchResults: updateResults,
          successCount: updateSuccessCount,
          failedCount: updateFailedCount,
          totalRequested: batchRecords.length,
        };
        break;
      }

      case "createPaymentWithLineItems": {
        // Create a Bank_Payment header record, then batch-create its Bank_Payment_Lines
        // Uses the same rate-limit handling and batch patterns as match sync
        const { payment, lineItems } = params;
        if (!payment || !Array.isArray(lineItems) || lineItems.length === 0) {
          throw new Error("payment object and lineItems array are required for createPaymentWithLineItems");
        }

        const apiDomain = "https://www.zohoapis.eu";

        // Phase 1: Create the Bank_Payment header
        console.log(`[Zoho] Creating Bank_Payment: ${payment.Payment_Reference}`);

        // Only include Payment_Provider if it looks like a valid Zoho record ID (numeric string)
        const providerLookup = payment.Payment_Provider && /^\d+$/.test(String(payment.Payment_Provider))
          ? { id: String(payment.Payment_Provider) }
          : undefined;

        const paymentPayload = {
          data: [{
            Name: payment.Payment_Reference || `Payment-${Date.now()}`,
            Payment_Reference: payment.Payment_Reference,
            Bank_Reference: payment.Bank_Reference || payment.Payment_Reference,
            Payment_Date: payment.Payment_Date,
            Amount: payment.Amount,
            ...(providerLookup ? { Payment_Provider: providerLookup } : {}),
            Status: "unreconciled",
            Reconciled_Amount: 0,
            Remaining_Amount: payment.Amount,
            Notes: payment.Notes || "",
            Reconciled_By: "Reconciliation Tool",
          }],
          trigger: [],
        };

        const paymentRes = await fetch(`${apiDomain}/crm/v6/Bank_Payments`, {
          method: "POST",
          headers: {
            "Authorization": `Zoho-oauthtoken ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(paymentPayload),
        });

        if (paymentRes.status === 429) {
          throw new ZohoRateLimitError("Zoho API rate limited while creating payment", 60);
        }

        const paymentResult = await paymentRes.json();
        console.log(`[Zoho] Bank_Payment create response:`, JSON.stringify(paymentResult, null, 2));
        const paymentRecord = paymentResult?.data?.[0];

        if (!paymentRecord || paymentRecord.status !== "success") {
          const errMsg = paymentRecord?.message || "Failed to create Bank_Payment";
          const errDetails = paymentRecord?.details ? ` Details: ${JSON.stringify(paymentRecord.details)}` : "";
          throw new Error(`Bank_Payment creation failed: ${errMsg}${errDetails}`);
        }

        const newPaymentId = paymentRecord.details.id;
        console.log(`[Zoho] Created Bank_Payment ${newPaymentId}`);

        // Phase 2: Batch-create line items (max 100 per call, with delays)
        await sleep(2000); // Respect rate limits between phases

        const allLineItemResults: any[] = [];
        const batchSize = 100;

        for (let i = 0; i < lineItems.length; i += batchSize) {
          const batch = lineItems.slice(i, i + batchSize);

          const lineItemPayload = {
            data: batch.map((li: any, idx: number) => ({
              Name: li.Client_Name || li.Plan_Reference || `Line-${i + idx + 1}`,
              Bank_Payment: { id: newPaymentId },
              Client_Name: li.Client_Name || "",
              Plan_Reference: li.Plan_Reference || "",
              Amount: li.Amount || 0,
              Fee_Category: li.Fee_Category || "ongoing",
              Fee_Type: li.Fee_Type || "",
              Description: li.Description || "",
              Adviser_Name: li.Adviser_Name || "",
              Status: "unmatched",
            })),
            trigger: [],
          };

          console.log(`[Zoho] Creating line items batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`);

          const liRes = await fetch(`${apiDomain}/crm/v6/Bank_Payment_Lines`, {
            method: "POST",
            headers: {
              "Authorization": `Zoho-oauthtoken ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(lineItemPayload),
          });

          if (liRes.status === 429) {
            // Return partial success so the frontend knows the payment was created
            throw new ZohoRateLimitError(
              `Rate limited after creating payment and ${allLineItemResults.length} line items. Payment ID: ${newPaymentId}`,
              60
            );
          }

          const liResult = await liRes.json();
          
          // Log first batch response for debugging
          if (i === 0) {
            console.log(`[Zoho] First batch response sample:`, JSON.stringify(liResult?.data?.slice(0, 2), null, 2));
          }

          const batchResults = (liResult?.data || []).map((item: any, idx: number) => ({
            index: i + idx,
            status: item?.status || "error",
            id: item?.details?.id || null,
            message: item?.message || null,
            details: item?.details || null,
          }));

          allLineItemResults.push(...batchResults);

          // Delay between batches
          if (i + batchSize < lineItems.length) {
            await sleep(2000);
          }
        }

        const liSuccessCount = allLineItemResults.filter((r: any) => r.status === "success").length;
        const liFailedCount = allLineItemResults.length - liSuccessCount;

        console.log(`[Zoho] Line items: ${liSuccessCount} success, ${liFailedCount} failed`);

        result = {
          paymentId: newPaymentId,
          lineItemResults: allLineItemResults,
          successCount: liSuccessCount,
          failedCount: liFailedCount,
          totalRequested: lineItems.length,
        };
        break;
      }

      case "dataCheck": {
        // Live Zoho check for data conditions on payment line items
        // Takes an array of policy references, checks:
        // 1. Which ones exist in the Plans module (Policy_Ref field)
        // 2. For found plans, which ones have associated Fees records
        const { policyReferences } = params;
        if (!Array.isArray(policyReferences) || policyReferences.length === 0) {
          throw new Error("policyReferences array is required for dataCheck");
        }

        console.log(`[Zoho] Data check for ${policyReferences.length} policy references`);

        // Deduplicate
        const uniqueRefs = [...new Set(policyReferences.map((r: string) => r.trim()).filter(Boolean))];

        // Step 1: Query Plans module for each policy reference
        // Use COQL to batch-check: find all plans whose Policy_Ref matches any of our references
        // Also fetch the valuation field to detect zero-valuation plans
        const foundPlans: Map<string, string> = new Map(); // policyRef -> planId
        const planValuations: Map<string, number> = new Map(); // policyRef -> valuation amount
        const batchSize = 50; // COQL IN clause limit

        // Resolve the valuation field name dynamically
        let valuationFieldName: string | null = null;
        try {
          const planModuleFields = await getModuleFields(accessToken, "Plans");
          valuationFieldName = resolveFieldApiName(planModuleFields, [
            "Valuation", "Current_Valuation", "Plan_Valuation", "Total_Valuation", "Fund_Value", "Current_Value"
          ]);
          if (!valuationFieldName) {
            console.warn("[Zoho] Could not resolve valuation field in Plans module");
          }
        } catch (err: any) {
          console.warn("[Zoho] Failed to get Plans module fields for valuation:", err.message);
        }

        const selectFields = valuationFieldName 
          ? `id, Policy_Ref, ${valuationFieldName}` 
          : `id, Policy_Ref`;

        for (let i = 0; i < uniqueRefs.length; i += batchSize) {
          const batch = uniqueRefs.slice(i, i + batchSize);
          const inClause = batch.map((r: string) => `'${r.replace(/'/g, "\\'")}'`).join(", ");
          const query = `select ${selectFields} from Plans where Policy_Ref in (${inClause})`;
          
          try {
            const plans = await queryWithCOQL(accessToken, query);
            for (const plan of plans) {
              const policyRef = String(plan.Policy_Ref || "").trim();
              if (policyRef) {
                foundPlans.set(policyRef, String(plan.id));
                // Store valuation if available
                if (valuationFieldName && plan[valuationFieldName] !== undefined) {
                  const val = parseFloat(String(plan[valuationFieldName] || "0"));
                  planValuations.set(policyRef, isNaN(val) ? 0 : val);
                }
              }
            }
          } catch (err: any) {
            console.warn(`[Zoho] Plans query batch failed:`, err.message);
            // If COQL fails (e.g., module doesn't exist), continue with empty results
          }

          if (i + batchSize < uniqueRefs.length) {
            await sleep(500);
          }
        }

        console.log(`[Zoho] Found ${foundPlans.size} plans out of ${uniqueRefs.length} policy references`);

        // Step 2: For found plans, check if they have Fees records
        const planIds = [...foundPlans.values()];
        const plansWithFees = new Set<string>(); // planIds that have fees

        if (planIds.length > 0) {
          // Query Fees module - look for records linked to these plan IDs
          // Fees are likely linked to Plans via a lookup field
          for (let i = 0; i < planIds.length; i += batchSize) {
            const batch = planIds.slice(i, i + batchSize);
            const inClause = batch.map((id: string) => `'${id}'`).join(", ");
            
            // Try common field names for the plan lookup in Fees
            const feeModuleFields = await getModuleFields(accessToken, "Fees");
            const planLookupField = resolveFieldApiName(feeModuleFields, [
              "Plan", "Plan_Name", "Plans", "Related_Plan", "Plan_ID"
            ]);

            if (!planLookupField) {
              console.warn("[Zoho] Could not resolve plan lookup field in Fees module");
              break;
            }

            const query = `select id, ${planLookupField} from Fees where ${planLookupField} in (${inClause})`;
            
            try {
              const fees = await queryWithCOQL(accessToken, query);
              for (const fee of fees) {
                const planRef = fee[planLookupField];
                const planId = typeof planRef === "object" && planRef !== null 
                  ? String((planRef as any).id || planRef)
                  : String(planRef || "");
                if (planId) {
                  plansWithFees.add(planId);
                }
              }
            } catch (err: any) {
              console.warn(`[Zoho] Fees query batch failed:`, err.message);
            }

            if (i + batchSize < planIds.length) {
              await sleep(500);
            }
          }
        }

        console.log(`[Zoho] ${plansWithFees.size} plans have fee records out of ${planIds.length} found plans`);

        // Build results per policy reference
        const checkResults: Record<string, { planFound: boolean; hasFees: boolean; zeroValuation: boolean; planId?: string }> = {};
        for (const ref of uniqueRefs) {
          const planId = foundPlans.get(ref);
          const valuation = planValuations.get(ref);
          checkResults[ref] = {
            planFound: !!planId,
            hasFees: planId ? plansWithFees.has(planId) : false,
            zeroValuation: planId ? (valuation !== undefined && valuation === 0) : false,
            planId: planId || undefined,
          };
        }

        result = {
          totalChecked: uniqueRefs.length,
          plansFound: foundPlans.size,
          plansWithFees: plansWithFees.size,
          results: checkResults,
        };
        break;
      }

      case "query": {
        // Execute custom COQL query
        if (!params.query) {
          throw new Error("query parameter is required");
        }
        result = await queryWithCOQL(accessToken, params.query);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // If an action returned an embedded error result, pass it through as {success:false}
    const maybeErr = (result as any)?.success === false;
    if (maybeErr) {
      return new Response(
        JSON.stringify({ success: false, error: (result as any).error, data: (result as any).data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in zoho-crm function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Return 200 so the client can read the body (supabase-js throws on non-2xx)
    if (error instanceof ZohoRateLimitError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          code: "ZOHO_RATE_LIMIT",
          retryAfterSeconds: error.retryAfterSeconds,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
