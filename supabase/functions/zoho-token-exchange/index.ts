//zoho-token-exchange/index.ts

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, accountsUrl = "https://accounts.zoho.com" } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Authorization code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientId = Deno.env.get("ZOHO_CLIENT_ID");
    const clientSecret = Deno.env.get("ZOHO_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      console.error("Missing Zoho credentials");
      return new Response(
        JSON.stringify({ error: "Zoho credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Exchanging authorization code for tokens...");

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(`${accountsUrl}/oauth/v2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log("Token exchange response:", JSON.stringify(tokenData, null, 2));

    if (tokenData.error) {
      return new Response(
        JSON.stringify({ 
          error: tokenData.error,
          message: tokenData.error === "invalid_code" 
            ? "The authorization code has expired. Please generate a new code in Zoho API Console."
            : tokenData.error
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return the tokens (most importantly the refresh_token)
    return new Response(
      JSON.stringify({
        success: true,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        api_domain: tokenData.api_domain,
        message: tokenData.refresh_token 
          ? "Success! Copy the refresh_token value and share it."
          : "Warning: No refresh_token returned. Make sure your scope includes offline_access or the code was generated with 'Access Type: Offline'."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in zoho-token-exchange:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
