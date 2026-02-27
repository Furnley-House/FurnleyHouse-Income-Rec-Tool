//backend/src/routes/csvMapping.ts
// [GAP 2 FIX] Switched from generic OpenAI to Azure OpenAI.
// Uses deployment-based URL and 'api-key' header per Azure's API format.
// Restored the full system+user prompts from the Edge Function.

import { Router, Request, Response } from 'express';

export const csvMappingRouter = Router();

/**
 * AI-powered CSV column mapping — mirrors csv-mapping-ai edge function.
 * POST /api/csv-mapping  { columns, providerName }
 */
csvMappingRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { columns, providerName } = req.body;
    if (!columns || !providerName) {
      return res.status(400).json({ error: 'columns and providerName are required' });
    }

    // Azure OpenAI configuration
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';

    if (!endpoint || !apiKey || !deployment) {
      return res.status(500).json({
        error: 'Azure OpenAI not configured. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT.',
      });
    }

    // Azure OpenAI URL format: {endpoint}/openai/deployments/{deployment}/chat/completions?api-version={version}
    const apiUrl = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    // Build column description for the prompt
    const columnsDescription = columns
      .map((col: any) =>
        `- "${col.header}": Sample values: [${col.sampleValues.slice(0, 3).map((v: string) => `"${v}"`).join(', ')}]`
      )
      .join('\n');

    // Full system prompt — restored from Edge Function (not condensed)
    const systemPrompt = `You are an expert at analyzing bank statement and financial CSV files. Your task is to map CSV columns to internal payment fields and detect any structural issues.

INTERNAL FIELDS TO MAP TO:
- payment_date: Date of the payment (REQUIRED) - Note: this may also be inherited from a payment header, so mark as medium confidence if unsure
- amount: Payment amount, currency value (REQUIRED)  
- payment_reference: Unique reference number for the payment or policy/plan reference (REQUIRED)
- client_name: Name of the client/payee
- policy_reference: Policy or plan reference number (often starts with PF or similar)
- description: Transaction description or memo
- transaction_type: Type of transaction (credit, debit, fee, etc.)
- balance: Account balance after transaction
- fee_category: Category of fee (ongoing, initial, ad-hoc)
- adviser_name: Name of the adviser
- agency_code: Agency identifier code

CONTEXT:
- The provider/source is: ${providerName}
- The user can set defaults for fields like payment_date from a payment header, so if no clear date column exists, that's OK

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

    // Full user prompt — restored from Edge Function
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
2. Look for patterns in sample values to infer data types
3. Policy references often start with PF followed by numbers/letters
4. Amount columns have numeric values, possibly with currency symbols
5. Return ONLY valid JSON, no markdown or explanation outside the JSON`;

    // Call Azure OpenAI — uses 'api-key' header (not Authorization: Bearer)
    const aiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please try again in a moment.' });
      }
      const errorText = await aiRes.text();
      console.error('Azure OpenAI error:', aiRes.status, errorText);
      return res.status(aiRes.status).json({ error: `Azure OpenAI error: ${aiRes.status}` });
    }

    const aiData = await aiRes.json() as any;
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content in AI response');

    // Parse the JSON response from the AI
    const jsonContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(jsonContent);

    // Transform to match expected format (same as Edge Function)
    const result = {
      mappings: parsed.mappings.map((m: any) => ({
        csvColumn: m.csvColumn,
        targetField: m.targetField === 'ignore' ? '' : m.targetField,
        confidence: m.confidence,
        sampleValues: columns.find((c: any) => c.header === m.csvColumn)?.sampleValues || [],
        ignored: m.targetField === 'ignore',
      })),
      structuralIssues: parsed.structuralIssues || [],
      suggestedRowOffset: parsed.suggestedRowOffset || 0,
      overallConfidence: parsed.overallConfidence || 'medium',
      analysisNotes: parsed.analysisNotes || '',
    };

    return res.json(result);
  } catch (error: any) {
    console.error('CSV mapping error:', error);
    return res.status(500).json({ error: error.message || 'Unknown error' });
  }
});
