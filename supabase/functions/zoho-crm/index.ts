import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache for access token (in-memory, resets on cold start)
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

interface ZohoTokenResponse {
  access_token: string;
  expires_in: number;
  api_domain: string;
  token_type: string;
  error?: string;
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

// Get a valid access token, refreshing if necessary
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  
  // Return cached token if still valid (with 5 min buffer)
  if (cachedAccessToken && tokenExpiresAt > now + 300000) {
    console.log("Using cached access token");
    return cachedAccessToken;
  }

  console.log("Refreshing access token...");
  
  const clientId = Deno.env.get("ZOHO_CLIENT_ID");
  const clientSecret = Deno.env.get("ZOHO_CLIENT_SECRET");
  const refreshToken = Deno.env.get("ZOHO_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Zoho credentials. Please configure ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN.");
  }

  // Use EU accounts endpoint
  const tokenResponse = await fetch("https://accounts.zoho.eu/oauth/v2/token", {
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
  console.log("Token refresh response:", JSON.stringify(tokenData, null, 2));

  if (tokenData.error) {
    throw new Error(`Token refresh failed: ${tokenData.error}`);
  }

  cachedAccessToken = tokenData.access_token;
  tokenExpiresAt = now + (tokenData.expires_in * 1000);
  
  return cachedAccessToken;
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

  const data: ZohoListResponse = await response.json();
  
  if (data.status === "error" || data.code) {
    if (data.code === "NODATA") {
      console.log("COQL query returned no data");
      return [];
    }
    console.error("COQL error:", data);
    throw new Error(`COQL error: ${data.message || data.code}`);
  }

  return data.data || [];
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
        const fields = "Payment_ID,Provider_Name,Payment_Reference,Amount,Payment_Date,Bank_Reference,Status,Reconciled_Amount,Remaining_Amount,Notes";
        const fetchParams: Record<string, string> = { fields };
        
        if (params.status) {
          // Use COQL for filtering
          const statusFilter = Array.isArray(params.status) 
            ? params.status.map((s: string) => `'${s}'`).join(", ")
            : `'${params.status}'`;
          const query = `SELECT ${fields} FROM Bank_Payments WHERE Status IN (${statusFilter})`;
          result = await queryWithCOQL(accessToken, query);
        } else {
          result = await fetchAllRecords(accessToken, "Bank_Payments", fetchParams);
        }
        break;
      }

      case "getPaymentLineItems": {
        // Fetch Bank_Payment_Lines for a specific payment
        const fields = "Line_Item_ID,Bank_Payment,Client_Name,Plan_Reference,Adviser_Name,Fee_Category,Amount,Description,Status,Matched_Expectation,Match_Notes";
        
        if (params.paymentId) {
          const query = `SELECT ${fields} FROM Bank_Payment_Lines WHERE Bank_Payment = '${params.paymentId}'`;
          result = await queryWithCOQL(accessToken, query);
        } else {
          result = await fetchAllRecords(accessToken, "Bank_Payment_Lines", { fields });
        }
        break;
      }

      case "getExpectations": {
        // Fetch Expectations with flexible filtering
        const fields = "Expectation_ID,Client_1,Plan_Policy_Reference,Expected_Fee_Amount,Calculation_Date,Fund_Reference,Fee_Category,Fee_Type,Description,Provider_Name,Adviser_Name,Superbia_Company,Status,Allocated_Amount,Remaining_Amount";
        
        const conditions: string[] = [];
        
        if (params.status) {
          const statusFilter = Array.isArray(params.status)
            ? params.status.map((s: string) => `'${s}'`).join(", ")
            : `'${params.status}'`;
          conditions.push(`Status IN (${statusFilter})`);
        }
        
        if (params.providerId) {
          conditions.push(`Provider_Name = '${params.providerId}'`);
        }
        
        if (params.superbiaCompany) {
          const companies = Array.isArray(params.superbiaCompany)
            ? params.superbiaCompany.map((c: string) => `'${c}'`).join(", ")
            : `'${params.superbiaCompany}'`;
          conditions.push(`Superbia_Company IN (${companies})`);
        }
        
        if (params.dateFrom) {
          conditions.push(`Calculation_Date >= '${params.dateFrom}'`);
        }
        
        if (params.dateTo) {
          conditions.push(`Calculation_Date <= '${params.dateTo}'`);
        }

        if (conditions.length > 0) {
          const query = `SELECT ${fields} FROM Expectations WHERE ${conditions.join(" AND ")}`;
          result = await queryWithCOQL(accessToken, query);
        } else {
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
        const fields = "Payment_Match_ID,Bank_Payment_Ref_Match,Payment_Line_Match,Expectation,Matched_Amount,Variance,Variance_Percentage,Match_Type,Match_Method,Match_Quality,Notes,Matched_By,Matched_At,Confirmed";
        
        if (params.paymentId) {
          const query = `SELECT ${fields} FROM Payment_Matches WHERE Bank_Payment_Ref_Match = '${params.paymentId}'`;
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
            Matched_At: new Date().toISOString(),
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

        result = await createResponse.json();
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

        result = await updateResponse.json();
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

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in zoho-crm function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
