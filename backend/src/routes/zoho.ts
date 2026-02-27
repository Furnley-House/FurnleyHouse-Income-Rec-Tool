//backend/src/routes/zoho.ts

import { Router, Request, Response } from 'express';
import { getAccessToken, formatZohoDateTime, ZohoRateLimitError } from '../lib/zohoAuth';
import {
  getModuleFields,
  resolveFieldApiName,
  queryWithCOQL,
  fetchAllRecords,
  hydrateRecordsById,
  createRecords,
  updateRecord,
  updateRecordsBatch,
} from '../lib/zohoApi';

export const zohoRouter = Router();

/**
 * Main Zoho CRM endpoint — mirrors the Edge Function's action-based dispatch.
 * POST /api/zoho  { action: string, params: {} }
 */
zohoRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { action, params = {} } = req.body;
    if (!action) return res.status(400).json({ error: 'Action is required' });

    // Ensure we have a valid token before proceeding
    await getAccessToken();

    let result: unknown;

    switch (action) {
      // ---- test ----
      case 'test': {
        const token = await getAccessToken();
        const org = await fetch('https://www.zohoapis.eu/crm/v6/org', {
          headers: { Authorization: `Zoho-oauthtoken ${token}` },
        });
        result = await org.json();
        break;
      }

      // ---- getPayments ----
      case 'getPayments': {
        if (params.status) {
          const fields = await getModuleFields('Bank_Payments');
          const statusField = resolveFieldApiName(fields, ['Status']);
          if (!statusField) throw new Error("Cannot resolve Bank_Payments Status field");
          const filter = Array.isArray(params.status)
            ? params.status.map((s: string) => `'${s}'`).join(', ')
            : `'${params.status}'`;
          const hits = await queryWithCOQL(`select id from Bank_Payments where ${statusField} in (${filter})`);
          result = await hydrateRecordsById('Bank_Payments', hits.map((r: any) => String(r.id)));
        } else {
          result = await fetchAllRecords('Bank_Payments');
        }
        break;
      }

      // ---- getPaymentLineItems ----
      case 'getPaymentLineItems': {
        const fields = await getModuleFields('Bank_Payment_Lines');
        const statusField = resolveFieldApiName(fields, ['Status']);
        const paymentLookup = resolveFieldApiName(fields, ['Bank_Payment', 'Bank Payment']);

        if (params.paymentId) {
          if (!paymentLookup) throw new Error("Cannot resolve Bank_Payment_Lines payment lookup");
          const hits = await queryWithCOQL(`select id from Bank_Payment_Lines where ${paymentLookup} = '${params.paymentId}'`);
          result = await hydrateRecordsById('Bank_Payment_Lines', hits.map((r: any) => String(r.id)));
        } else if (params.status) {
          if (!statusField) throw new Error("Cannot resolve Bank_Payment_Lines Status field");
          const filter = Array.isArray(params.status)
            ? params.status.map((s: string) => `'${s}'`).join(', ')
            : `'${params.status}'`;
          const hits = await queryWithCOQL(`select id from Bank_Payment_Lines where ${statusField} in (${filter})`);
          result = await hydrateRecordsById('Bank_Payment_Lines', hits.map((r: any) => String(r.id)));
        } else {
          result = await fetchAllRecords('Bank_Payment_Lines');
        }
        break;
      }

      // ---- getExpectations ----
      case 'getExpectations': {
        const fields = await getModuleFields('Expectations');
        const statusApi = resolveFieldApiName(fields, ['Status', 'Expectation_Status']);
        const providerApi = resolveFieldApiName(fields, ['Provider', 'Provider_Name']);
        const superbiaApi = resolveFieldApiName(fields, ['Superbia_Company']);
        const calcDateApi = resolveFieldApiName(fields, ['Calculation_Date']);

        const conditions: string[] = [];
        if (params.status && statusApi) {
          const f = Array.isArray(params.status) ? params.status.map((s: string) => `'${s}'`).join(', ') : `'${params.status}'`;
          conditions.push(`${statusApi} in (${f})`);
        }
        if (params.providerId && providerApi) conditions.push(`${providerApi} = '${params.providerId}'`);
        if (params.superbiaCompany && superbiaApi) {
          const c = Array.isArray(params.superbiaCompany) ? params.superbiaCompany.map((s: string) => `'${s}'`).join(', ') : `'${params.superbiaCompany}'`;
          conditions.push(`${superbiaApi} in (${c})`);
        }
        if (params.dateFrom && calcDateApi) conditions.push(`${calcDateApi} >= '${params.dateFrom}'`);
        if (params.dateTo && calcDateApi) conditions.push(`${calcDateApi} <= '${params.dateTo}'`);

        if (conditions.length > 0) {
          const hits = await queryWithCOQL(`select id from Expectations where ${conditions.join(' and ')}`);
          result = await hydrateRecordsById('Expectations', hits.map((r: any) => String(r.id)));
        } else {
          result = await fetchAllRecords('Expectations', {
            fields: 'id,Plan_Policy_Reference,Client_1,Expected_Fee_Amount,Calculation_Date,Fee_Category,Fee_Type,Provider,Adviser_Name,Superbia_Company,Status,Allocated_Amount,Remaining_Amount',
          });
        }
        break;
      }

      // ---- getProviders ----
      case 'getProviders': {
        result = await fetchAllRecords('Providers', {
          fields: 'Provider_ID,Name,Provider_Code,Provider_Group,Is_Payment_Source,Active',
        });
        break;
      }

      // ---- getMatches ----
      // [GAP 3 FIX] Added missing action — mirrors Edge Function getMatches
      case 'getMatches': {
        const fields = 'id,Bank_Payment_Ref_Match,Payment_Line_Match,Expectation,Matched_Amount,Variance,Variance_Percentage,Match_Type,Match_Method,Match_Quality,Notes,Matched_By,Matched_At,Confirmed';

        if (params.paymentId) {
          // Filter matches by payment ID using COQL
          const query = `select ${fields} from Payment_Matches where Bank_Payment_Ref_Match = '${params.paymentId}'`;
          result = await queryWithCOQL(query);
        } else {
          // Fetch all matches with field selection
          result = await fetchAllRecords('Payment_Matches', { fields });
        }
        break;
      }

      // ---- createMatch ----
      case 'createMatch': {
        const record: Record<string, unknown> = {
          Name: `Match-${Date.now()}`,
          Bank_Payment_Ref_Match: { id: params.paymentId },
          Payment_Line_Match: { id: params.lineItemId },
          Matched_Amount: params.matchedAmount,
          Variance: params.variance || 0,
          Variance_Percentage: params.variancePercentage || 0,
          Match_Type: params.matchType || 'full',
          Match_Method: params.matchMethod || 'manual',
          Match_Quality: params.matchQuality || 'good',
          Notes: params.notes || '',
          Matched_At: formatZohoDateTime(),
          Confirmed: true,
        };
        if (params.expectationId) record.Expectation = { id: params.expectationId };
        const payload = await createRecords('Payment_Matches', [record]);
        result = payload;
        break;
      }

      // ---- createMatchBatch ----
      case 'createMatchBatch': {
        const records = params.records;
        if (!Array.isArray(records) || records.length === 0) throw new Error('records required');
        if (records.length > 100) throw new Error('Max 100 records per batch');

        const now = formatZohoDateTime();
        const batchData = records.map((r: any, idx: number) => {
          const rec: Record<string, unknown> = {
            Name: `Match-${Date.now()}-${idx}`,
            Bank_Payment_Ref_Match: { id: r.paymentId },
            Payment_Line_Match: { id: r.lineItemId },
            Matched_Amount: r.matchedAmount,
            Variance: r.variance || 0,
            Variance_Percentage: r.variancePercentage || 0,
            Match_Type: r.matchType || 'full',
            Match_Method: r.matchMethod || 'manual',
            Match_Quality: r.matchQuality || 'good',
            Notes: r.notes || '',
            Matched_At: now,
            Confirmed: true,
          };
          if (r.expectationId) rec.Expectation = { id: r.expectationId };
          if (r.reasonCode) rec.No_Match_Reason_Code = r.reasonCode;
          return rec;
        });

        const payload = await createRecords('Payment_Matches', batchData);
        const results = (payload?.data || []).map((item: any, idx: number) => ({
          index: idx,
          status: item?.status || 'error',
          id: item?.details?.id || null,
        }));
        result = {
          batchResults: results,
          successCount: results.filter((r: any) => r.status === 'success').length,
          failedCount: results.filter((r: any) => r.status !== 'success').length,
        };
        break;
      }

      // ---- updateRecord ----
      case 'updateRecord': {
        const { module, recordId, data } = params;
        if (!module || !recordId || !data) throw new Error('module, recordId, data required');
        const payload = await updateRecord(module, recordId, data);
        result = payload;
        break;
      }

      // ---- updateRecordsBatch ----
      case 'updateRecordsBatch': {
        const { module, records: batchRecords } = params;
        if (!module || !Array.isArray(batchRecords)) throw new Error('module and records required');
        if (batchRecords.length > 100) throw new Error('Max 100 per batch');
        const payload = await updateRecordsBatch(module, batchRecords);
        const results = (payload?.data || []).map((item: any, idx: number) => ({
          index: idx,
          status: item?.status || 'error',
          id: item?.details?.id || null,
        }));
        result = {
          batchResults: results,
          successCount: results.filter((r: any) => r.status === 'success').length,
          failedCount: results.filter((r: any) => r.status !== 'success').length,
        };
        break;
      }

      // ---- createPaymentWithLineItems ----
      case 'createPaymentWithLineItems': {
        const { payment, lineItems } = params;
        if (!payment || !Array.isArray(lineItems)) throw new Error('payment and lineItems required');

        const providerLookup = payment.Payment_Provider && /^\d+$/.test(String(payment.Payment_Provider))
          ? { id: String(payment.Payment_Provider) } : undefined;

        const paymentPayload = await createRecords('Bank_Payments', [{
          Name: payment.Payment_Reference || `Payment-${Date.now()}`,
          Payment_Reference: payment.Payment_Reference,
          Bank_Reference: payment.Bank_Reference || payment.Payment_Reference,
          Payment_Date: payment.Payment_Date,
          Amount: payment.Amount,
          ...(providerLookup ? { Payment_Provider: providerLookup } : {}),
          Status: 'unreconciled',
          Reconciled_Amount: 0,
          Remaining_Amount: payment.Amount,
          Notes: payment.Notes || '',
        }]);

        const paymentRecord = paymentPayload?.data?.[0];
        if (!paymentRecord || paymentRecord.status !== 'success') {
          throw new Error(`Payment creation failed: ${paymentRecord?.message || 'Unknown'}`);
        }
        const newPaymentId = paymentRecord.details.id;

        // Batch line items with delays
        await new Promise((r) => setTimeout(r, 2000));
        const allResults: any[] = [];
        const BS = 100;
        for (let i = 0; i < lineItems.length; i += BS) {
          const batch = lineItems.slice(i, i + BS).map((li: any, idx: number) => ({
            Name: li.Client_Name || li.Plan_Reference || `Line-${i + idx + 1}`,
            Bank_Payment: { id: newPaymentId },
            Client_Name: li.Client_Name || '',
            Plan_Reference: li.Plan_Reference || '',
            Amount: li.Amount || 0,
            Fee_Category: li.Fee_Category || 'ongoing',
            Fee_Type: li.Fee_Type || '',
            Adviser_Name: li.Adviser_Name || '',
            Status: 'unmatched',
          }));
          const payload = await createRecords('Bank_Payment_Lines', batch);
          const batchResults = (payload?.data || []).map((item: any, idx: number) => ({
            index: i + idx, status: item?.status || 'error', id: item?.details?.id || null,
          }));
          allResults.push(...batchResults);
          if (i + BS < lineItems.length) await new Promise((r) => setTimeout(r, 2000));
        }

        result = {
          paymentId: newPaymentId,
          lineItemResults: allResults,
          successCount: allResults.filter((r: any) => r.status === 'success').length,
          failedCount: allResults.filter((r: any) => r.status !== 'success').length,
        };
        break;
      }

      // ---- dataCheck ----
      // [GAP 1 FIX] Complete re-implementation matching the Edge Function.
      // Now queries both Plans (with valuation) and Fees (with percentage checks).
      case 'dataCheck': {
        const { policyReferences } = params;
        if (!Array.isArray(policyReferences) || policyReferences.length === 0) {
          throw new Error('policyReferences array is required for dataCheck');
        }

        console.log(`[Zoho] Data check for ${policyReferences.length} policy references`);

        // Deduplicate
        const uniqueRefs = [...new Set(policyReferences.map((r: string) => r.trim()).filter(Boolean))];

        // Step 1: Query Plans module — also fetch the valuation field
        const foundPlans = new Map<string, string>();      // policyRef -> planId
        const planValuations = new Map<string, number>();   // policyRef -> valuation
        const BS = 50;

        // Resolve the valuation field name dynamically (varies per Zoho org)
        let valuationFieldName: string | null = null;
        try {
          const planModuleFields = await getModuleFields('Plans');
          valuationFieldName = resolveFieldApiName(planModuleFields, [
            'Valuation', 'Current_Valuation', 'Plan_Valuation', 'Total_Valuation', 'Fund_Value', 'Current_Value',
          ]);
          if (!valuationFieldName) {
            console.warn('[Zoho] Could not resolve valuation field in Plans module');
          }
        } catch (err: any) {
          console.warn('[Zoho] Failed to get Plans module fields for valuation:', err.message);
        }

        const selectFields = valuationFieldName
          ? `id, Policy_Ref, ${valuationFieldName}`
          : 'id, Policy_Ref';

        for (let i = 0; i < uniqueRefs.length; i += BS) {
          const batch = uniqueRefs.slice(i, i + BS);
          const inClause = batch.map((r) => `'${r.replace(/'/g, "\\'")}'`).join(', ');
          const query = `select ${selectFields} from Plans where Policy_Ref in (${inClause})`;

          try {
            const plans = await queryWithCOQL(query);
            for (const plan of plans) {
              const policyRef = String(plan.Policy_Ref || '').trim();
              if (policyRef) {
                foundPlans.set(policyRef, String(plan.id));
                // Store valuation if available
                if (valuationFieldName && plan[valuationFieldName] !== undefined) {
                  const val = parseFloat(String(plan[valuationFieldName] || '0'));
                  planValuations.set(policyRef, isNaN(val) ? 0 : val);
                }
              }
            }
          } catch (err: any) {
            console.warn('[Zoho] Plans query batch failed:', err.message);
          }

          if (i + BS < uniqueRefs.length) await new Promise((r) => setTimeout(r, 500));
        }

        console.log(`[Zoho] Found ${foundPlans.size} plans out of ${uniqueRefs.length} policy references`);

        // Step 2: For found plans, check Fees module for hasFees & ongoingFeeZeroPercent
        const planIds = [...foundPlans.values()];
        const plansWithFees = new Set<string>();
        const plansWithOngoingFeeZeroPercent = new Set<string>();

        if (planIds.length > 0) {
          const feeModuleFields = await getModuleFields('Fees');
          const planLookupField = resolveFieldApiName(feeModuleFields, [
            'Plan', 'Plan_Name', 'Plans', 'Related_Plan', 'Plan_ID',
          ]);

          if (!planLookupField) {
            console.warn('[Zoho] Could not resolve plan lookup field in Fees module');
          } else {
            // Resolve fee percentage and category fields
            const feePercentField = resolveFieldApiName(feeModuleFields, [
              'Fee_Percentage', 'Percentage', 'Fee_Percent', 'Ongoing_Fee_Percentage', 'Fee_%',
            ]);
            const feeCategoryField = resolveFieldApiName(feeModuleFields, [
              'Fee_Category', 'Category', 'Fee_Type', 'Type',
            ]);

            const selectFeeFields = ['id', planLookupField];
            if (feePercentField) selectFeeFields.push(feePercentField);
            if (feeCategoryField) selectFeeFields.push(feeCategoryField);

            for (let i = 0; i < planIds.length; i += BS) {
              const batch = planIds.slice(i, i + BS);
              const inClause = batch.map((id: string) => `'${id}'`).join(', ');
              const query = `select ${selectFeeFields.join(', ')} from Fees where ${planLookupField} in (${inClause})`;

              try {
                const fees = await queryWithCOQL(query);
                for (const fee of fees) {
                  const planRef = fee[planLookupField];
                  const planId = typeof planRef === 'object' && planRef !== null
                    ? String((planRef as any).id || planRef)
                    : String(planRef || '');
                  if (planId) {
                    plansWithFees.add(planId);

                    // Check for ongoing fee with zero percentage
                    if (feePercentField && feeCategoryField) {
                      const category = String(fee[feeCategoryField] || '').toLowerCase();
                      const isOngoing = category.includes('ongoing') || category.includes('recurring') || category.includes('trail');
                      const pct = parseFloat(String(fee[feePercentField] || '0'));
                      if (isOngoing && (isNaN(pct) || pct === 0)) {
                        plansWithOngoingFeeZeroPercent.add(planId);
                      }
                    }
                  }
                }
              } catch (err: any) {
                console.warn('[Zoho] Fees query batch failed:', err.message);
              }

              if (i + BS < planIds.length) await new Promise((r) => setTimeout(r, 500));
            }
          }
        }

        console.log(`[Zoho] ${plansWithFees.size} plans have fee records, ${plansWithOngoingFeeZeroPercent.size} have ongoing fee at 0%`);

        // Build per-reference results
        const checkResults: Record<string, {
          planFound: boolean; hasFees: boolean; zeroValuation: boolean;
          ongoingFeeZeroPercent: boolean; planId?: string;
        }> = {};
        for (const ref of uniqueRefs) {
          const planId = foundPlans.get(ref);
          const valuation = planValuations.get(ref);
          checkResults[ref] = {
            planFound: !!planId,
            hasFees: planId ? plansWithFees.has(planId) : false,
            zeroValuation: planId ? (valuation !== undefined && valuation === 0) : false,
            ongoingFeeZeroPercent: planId ? plansWithOngoingFeeZeroPercent.has(planId) : false,
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

      // ---- query ----
      case 'query': {
        if (!params.query) throw new Error('query required');
        result = await queryWithCOQL(params.query);
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Zoho route error:', error);
    if (error instanceof ZohoRateLimitError) {
      return res.json({ success: false, error: error.message, code: 'ZOHO_RATE_LIMIT', retryAfterSeconds: error.retryAfterSeconds });
    }
    return res.json({ success: false, error: error.message || 'Unknown error' });
  }
});

/**
 * Token exchange endpoint — mirrors zoho-token-exchange edge function
 * POST /api/zoho/token-exchange  { code, accountsUrl? }
 */
zohoRouter.post('/token-exchange', async (req: Request, res: Response) => {
  try {
    const { code, accountsUrl = 'https://accounts.zoho.com' } = req.body;
    if (!code) return res.status(400).json({ error: 'Authorization code is required' });

    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    if (!clientId || !clientSecret) return res.status(500).json({ error: 'Zoho credentials not configured' });

    const tokenRes = await fetch(`${accountsUrl}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, code }),
    });
    const tokenData = await tokenRes.json() as any;

    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error, message: tokenData.error === 'invalid_code' ? 'Code expired. Generate a new one.' : tokenData.error });
    }

    return res.json({ success: true, access_token: tokenData.access_token, refresh_token: tokenData.refresh_token, expires_in: tokenData.expires_in });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});
