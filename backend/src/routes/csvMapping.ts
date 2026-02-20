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

    const apiKey = process.env.AI_API_KEY;
    const apiUrl = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
    const model = process.env.AI_MODEL || 'gpt-4o-mini';

    if (!apiKey) {
      return res.status(500).json({ error: 'AI_API_KEY not configured' });
    }

    const columnsDescription = columns
      .map((col: any) => `- "${col.header}": Sample values: [${col.sampleValues.slice(0, 3).map((v: string) => `"${v}"`).join(', ')}]`)
      .join('\n');

    const systemPrompt = `You are an expert at analyzing bank statement and financial CSV files. Your task is to map CSV columns to internal payment fields and detect any structural issues.

INTERNAL FIELDS TO MAP TO:
- payment_date, amount, payment_reference, client_name, policy_reference, description, transaction_type, balance, fee_category, adviser_name, agency_code

CONFIDENCE LEVELS: high, medium, low

Respond with JSON: { mappings: [...], structuralIssues: [...], suggestedRowOffset: 0, overallConfidence: "...", analysisNotes: "..." }`;

    const userPrompt = `Analyze this CSV from provider "${providerName}":\n\n${columnsDescription}\n\nReturn ONLY valid JSON.`;

    const aiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!aiRes.ok) {
      return res.status(aiRes.status).json({ error: `AI API error: ${aiRes.status}` });
    }

    const aiData = await aiRes.json() as any;
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content in AI response');

    const jsonContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(jsonContent);

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
