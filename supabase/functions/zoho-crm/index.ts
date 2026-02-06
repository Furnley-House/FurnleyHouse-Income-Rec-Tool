import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

// Get a valid access token, refreshing if necessary
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  
  // Return cached token if still valid (with 5 min buffer)
  if (cachedAccessToken && tokenExpiresAt > now + 300000) {
    console.log("Using cached access token");
    return cachedAccessToken;
  }

  // If another request is already refreshing, await it (prevents stampede)
  if (refreshInFlight) {
    console.log("Awaiting in-flight token refresh");
    return await refreshInFlight;
  }

  refreshInFlight = (async () => {
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

// Use COQL for complex queries with filters
async function queryWithCOQL(
  accessToken: string,
  query: string
): Promise<ZohoRecord[]> {
  const apiDomain = "https://www.zohoapis.eu";
  const url = `${apiDomain}/crm/v6/coql`;
  
  console.log("Executing COQL query:", query);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ select_query: query }),
  });

  if (response.status === 429) {
    throw new ZohoRateLimitError("Zoho API rate limited", 60);
  }

  // Zoho sometimes returns 204 No Content for empty COQL results
  if (response.status === 204) {
    console.log("COQL query returned 204 (no content)");
    return [];
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
      console.log("COQL query returned no data");
      return [];
    }
    console.error("COQL error:", data);
    throw new Error(`COQL error: ${(data as any).message || (data as any).code}`);
  }

  return data.data || [];
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
  options: { delayMs?: number; maxRecords?: number } = {}
): Promise<ZohoRecord[]> {
  const delayMs = options.delayMs ?? 120;
  const maxRecords = options.maxRecords ?? 2000;

  const limitedIds = ids.slice(0, maxRecords);
  const records: ZohoRecord[] = [];

  for (let i = 0; i < limitedIds.length; i++) {
    const recordId = limitedIds[i];
    const record = await fetchRecordById(accessToken, module, recordId);
    if (record) records.push(record);

    // Small delay to reduce rate-limit risk
    if (delayMs > 0 && i < limitedIds.length - 1) {
      await sleep(delayMs);
    }
  }

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
          result = await fetchAllRecords(accessToken, "Expectations");
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
            Bank_Payment_Ref_Match: params.paymentId,
            Payment_Line_Match: params.lineItemId,
            Expectation: params.expectationId,
            Matched_Amount: params.matchedAmount,
            Variance: params.variance || 0,
            Variance_Percentage: params.variancePercentage || 0,
            Match_Type: params.matchType || "full",
            Match_Method: params.matchMethod || "manual",
            Match_Quality: params.matchQuality || "good",
            Notes: params.notes || "",
            Matched_By: "Reconciliation Tool",
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
