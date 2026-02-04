import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CSVColumn {
  header: string;
  sampleValues: string[];
}

interface MappingRequest {
  columns: CSVColumn[];
  paymentDateColumn: string;
  paymentReferenceColumn: string;
  providerName: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { columns, paymentDateColumn, paymentReferenceColumn, providerName }: MappingRequest = await req.json();

    // Build the analysis prompt
    const columnsDescription = columns.map(col => 
      `- "${col.header}": Sample values: [${col.sampleValues.slice(0, 3).map(v => `"${v}"`).join(", ")}]`
    ).join("\n");

    const systemPrompt = `You are an expert at analyzing bank statement and financial CSV files. Your task is to map CSV columns to internal payment fields and detect any structural issues.

INTERNAL FIELDS TO MAP TO:
- payment_date: Date of the payment (REQUIRED)
- amount: Payment amount, currency value (REQUIRED)  
- payment_reference: Unique reference number for the payment (REQUIRED)
- client_name: Name of the client/payee
- policy_reference: Policy or plan reference number (often starts with PF or similar)
- description: Transaction description or memo
- transaction_type: Type of transaction (credit, debit, fee, etc.)
- balance: Account balance after transaction
- fee_category: Category of fee (ongoing, initial, ad-hoc)
- adviser_name: Name of the adviser
- agency_code: Agency identifier code

IMPORTANT CONTEXT:
- The user has indicated that "${paymentDateColumn}" should be the payment date column
- The user has indicated that "${paymentReferenceColumn}" should be the payment reference column
- The provider/source is: ${providerName}

CONFIDENCE LEVELS:
- "high": Clear match based on header name and data patterns
- "medium": Likely match but some ambiguity
- "low": Uncertain, needs user verification

STRUCTURAL ISSUES TO DETECT:
- merged_headers: Multiple pieces of info in one column header
- split_headers: Header info spread across multiple columns
- unusual_format: Non-standard formatting patterns
- missing_headers: Expected columns not found
- row_offset: Data doesn't start on row 1 (e.g., title rows)`;

    const userPrompt = `Analyze this CSV structure and provide mappings:

CSV COLUMNS:
${columnsDescription}

Respond with a JSON object matching this exact structure:
{
  "mappings": [
    {
      "csvColumn": "exact column header from CSV",
      "targetField": "internal field name or 'ignore'",
      "confidence": "high" | "medium" | "low",
      "reasoning": "brief explanation"
    }
  ],
  "structuralIssues": [
    {
      "type": "issue type",
      "description": "what the issue is",
      "suggestedFix": "how to fix it",
      "affectedColumns": ["column names"]
    }
  ],
  "suggestedRowOffset": 0,
  "overallConfidence": "high" | "medium" | "low",
  "analysisNotes": "any important observations about this CSV format"
}

RULES:
1. Map every CSV column - use "ignore" for targetField if it shouldn't be imported
2. Respect the user's indicated date and reference columns with high confidence
3. Look for patterns in sample values to infer data types
4. Policy references often start with PF followed by numbers/letters
5. Amount columns have numeric values, possibly with currency symbols
6. Return ONLY valid JSON, no markdown or explanation outside the JSON`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON response from the AI
    let parsedResult;
    try {
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?|\n?```/g, '').trim();
      parsedResult = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI mapping response");
    }

    // Transform to match our expected format
    const result = {
      mappings: parsedResult.mappings.map((m: any) => ({
        csvColumn: m.csvColumn,
        targetField: m.targetField === 'ignore' ? '' : m.targetField,
        confidence: m.confidence,
        sampleValues: columns.find(c => c.header === m.csvColumn)?.sampleValues || [],
        ignored: m.targetField === 'ignore',
      })),
      structuralIssues: parsedResult.structuralIssues || [],
      suggestedRowOffset: parsedResult.suggestedRowOffset || 0,
      overallConfidence: parsedResult.overallConfidence || 'medium',
      analysisNotes: parsedResult.analysisNotes || '',
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("csv-mapping-ai error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
