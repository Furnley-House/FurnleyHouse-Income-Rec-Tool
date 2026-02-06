import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Payment, PaymentLineItem, Expectation } from '@/types/reconciliation';

export type DataSource = 'mock' | 'zoho';

interface ZohoPayment {
  id: string;
  Payment_Reference?: string;
  Bank_Reference?: string;
  Payment_Date?: string;
  Amount?: unknown;
  Payment_Provider?: { name: string; id: string }; // Correct Zoho field name
  Status?: string;
  Reconciled_Amount?: unknown;
  Remaining_Amount?: unknown;
  Notes?: string;
}

interface ZohoLineItem {
  id: string;
  Bank_Payment?: { name: string; id: string };
  Plan_Reference?: string;
  Client_Name?: string;
  Adviser_Name?: string;
  Amount?: unknown;
  Fee_Category?: string;
  Fee_Type?: string;
  Description?: string;
  Status?: string;
  Matched_Expectation?: { name: string; id: string };
  Match_Notes?: string;
}

interface ZohoExpectation {
  id: string;
  Plan_Policy_Reference?: string;
  Client_1?: { name: string; id: string };
  Expected_Fee_Amount?: unknown;
  Calculation_Date?: string;
  Fee_Category?: string;
  Fee_Type?: string;
  // Provider is a lookup field to Providers module (returns {name, id})
  Provider?: { name: string; id: string };
  Adviser_Name?: string;
  Superbia_Company?: string;
  Status?: string;
  Allocated_Amount?: unknown;
  Remaining_Amount?: unknown;
}

function coerceCurrency(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const n = Number.parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  if (value && typeof value === 'object') {
    const maybeValue = (value as any).value;
    if (maybeValue !== undefined) return coerceCurrency(maybeValue);
  }
  return 0;
}

interface ZohoProvider {
  id: string;
  Name: string;
  Provider_Group?: string;
}

interface UseZohoDataReturn {
  isLoading: boolean;
  error: string | null;
  isRateLimited: boolean;
  retryAfterSeconds: number | null;
  loadZohoData: () => Promise<{ payments: Payment[]; expectations: Expectation[] } | null>;
}

// Helper to add delay between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function useZohoData(): UseZohoDataReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);

  const loadZohoData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsRateLimited(false);
    setRetryAfterSeconds(null);

    try {
      // Fetch data SEQUENTIALLY with delays to avoid Zoho rate limiting
      // Each call can take time due to pagination, so we stagger them
      
      console.log('[Zoho] Starting sequential data load to avoid rate limits...');
      
      // Helper to check for rate limit errors in response
      const checkRateLimit = (res: any, context: string) => {
        if (res.error) throw new Error(`${context}: ${res.error.message}`);
        if (!res.data?.success) {
          // Check for rate limit error
          if (res.data?.code === 'ZOHO_RATE_LIMIT') {
            const retrySeconds = res.data?.retryAfterSeconds || 60;
            throw { 
              isRateLimit: true, 
              retryAfterSeconds: retrySeconds,
              message: `Zoho API rate limited. Please wait ${retrySeconds} seconds before retrying.`
            };
          }
          throw new Error(`${context}: ${res.data?.error || 'Unknown error'}`);
        }
        return res.data?.data || [];
      };

      // 1. Fetch providers first (smallest dataset, needed for mapping)
      console.log('[Zoho] Loading providers...');
      const providersRes = await supabase.functions.invoke('zoho-crm', { 
        body: { action: 'getProviders' } 
      });
      const zohoProviders: ZohoProvider[] = checkRateLimit(providersRes, 'Providers');
      console.log(`[Zoho] Loaded ${zohoProviders.length} providers`);
      
      await delay(500); // 500ms delay between calls
      
      // 2. Fetch payments
      console.log('[Zoho] Loading payments...');
      const paymentsRes = await supabase.functions.invoke('zoho-crm', { 
        body: { action: 'getPayments' } 
      });
      const zohoPayments: ZohoPayment[] = checkRateLimit(paymentsRes, 'Payments');
      console.log(`[Zoho] Loaded ${zohoPayments.length} payments`);
      console.log(`[Zoho] Loaded ${zohoPayments.length} payments`);
      
      await delay(500);
      
      // 3. Fetch line items (largest dataset, may take longer)
      console.log('[Zoho] Loading payment line items...');
      const lineItemsRes = await supabase.functions.invoke('zoho-crm', { 
        body: { action: 'getPaymentLineItems' } 
      });
      const zohoLineItems: ZohoLineItem[] = checkRateLimit(lineItemsRes, 'Line Items');
      console.log(`[Zoho] Loaded ${zohoLineItems.length} line items`);
      console.log(`[Zoho] Loaded ${zohoLineItems.length} line items`);
      
      await delay(500);
      
      // 4. Fetch expectations
      console.log('[Zoho] Loading expectations...');
      const expectationsRes = await supabase.functions.invoke('zoho-crm', { 
        body: { action: 'getExpectations' } 
      });
      const zohoExpectations: ZohoExpectation[] = checkRateLimit(expectationsRes, 'Expectations');
      console.log(`[Zoho] Loaded ${zohoExpectations.length} expectations`);
      console.log(`[Zoho] Loaded ${zohoExpectations.length} expectations`);

      // DEBUG: Verify raw keys + expected amount presence
      if (zohoExpectations[0]) {
        console.log('[Zoho] DEBUG - Expectation record keys (first record):', Object.keys(zohoExpectations[0] as any));
      }

      const rawExpectedAmounts = zohoExpectations
        .slice(0, 50)
        .map(e => coerceCurrency(e.Expected_Fee_Amount))
        .filter(n => n > 0);
      console.log(`[Zoho] DEBUG - Non-zero Expected_Fee_Amount count in first 50 expectations: ${rawExpectedAmounts.length}`);

      // Find a matching plan reference and compare amounts
      const sampleLineItem = zohoLineItems.find(li => li.Plan_Reference && li.Plan_Reference.trim() !== '');
      if (sampleLineItem) {
        const matchingExp = zohoExpectations.find(e => e.Plan_Policy_Reference === sampleLineItem.Plan_Reference);
        if (matchingExp) {
          const liAmount = coerceCurrency(sampleLineItem.Amount);
          const expAmount = coerceCurrency(matchingExp.Expected_Fee_Amount);
          console.log('[Zoho] DEBUG - SAMPLE MATCH COMPARISON:');
          console.log(`  Plan Reference: ${sampleLineItem.Plan_Reference}`);
          console.log(`  Line Item Amount: £${liAmount.toFixed(2)}`);
          console.log(`  Expected Fee Amount: £${expAmount.toFixed(2)}`);
          console.log(`  Are they equal? ${Math.abs(liAmount - expAmount) < 0.005}`);
        }
      }
      // Build provider lookup (id -> name with group resolution)
      const providerMap = new Map<string, string>();
      zohoProviders.forEach(p => {
        // Use Provider_Group if available, otherwise use Name
        providerMap.set(p.id, p.Provider_Group || p.Name);
      });

      // Group line items by payment
      const lineItemsByPayment = new Map<string, ZohoLineItem[]>();
      zohoLineItems.forEach(li => {
        const paymentId = li.Bank_Payment?.id;
        if (paymentId) {
          const existing = lineItemsByPayment.get(paymentId) || [];
          existing.push(li);
          lineItemsByPayment.set(paymentId, existing);
        }
      });

      // Transform payments
      const payments: Payment[] = zohoPayments.map(zp => {
        // Payment_Provider is a lookup - use the name directly for matching with expectations
        // Expectations use Provider_ID (picklist) which returns the provider name directly
        const providerName = zp.Payment_Provider?.name || 'Unknown Provider';
        
        const paymentLineItems = lineItemsByPayment.get(zp.id) || [];
        
        const lineItems: PaymentLineItem[] = paymentLineItems.map(li => ({
          id: li.id,
          zohoId: li.id, // Store Zoho ID for sync operations
          clientName: li.Client_Name || 'Unknown Client',
          planReference: li.Plan_Reference || '',
          agencyCode: undefined, // Not in Zoho yet
          adviserName: li.Adviser_Name,
          feeCategory: (li.Fee_Category?.toLowerCase() === 'initial' ? 'initial' : 'ongoing') as 'initial' | 'ongoing',
          amount: coerceCurrency(li.Amount),
          description: li.Description || `${li.Fee_Category || 'Ongoing'} ${li.Fee_Type || 'fee'}`,
          status: (li.Status?.toLowerCase() === 'matched'
            ? 'matched'
            : li.Status?.toLowerCase() === 'approved_unmatched'
              ? 'approved_unmatched'
              : 'unmatched') as 'unmatched' | 'matched' | 'approved_unmatched',
          matchedExpectationId: li.Matched_Expectation?.id,
          matchNotes: li.Match_Notes,
        }));

        const totalAmount = coerceCurrency(zp.Amount) || lineItems.reduce((sum, li) => sum + li.amount, 0);

        return {
          id: zp.id,
          zohoId: zp.id, // Store Zoho ID for sync operations
          providerName,
          // Use Payment_Reference if present, otherwise fall back to Bank_Reference
          paymentReference: zp.Payment_Reference || zp.Bank_Reference || 'Unknown Payment',
          amount: totalAmount,
          paymentDate: zp.Payment_Date || new Date().toISOString().split('T')[0],
          bankReference: zp.Bank_Reference || '',
          statementItemCount: lineItems.length,
          status: (zp.Status?.toLowerCase() === 'reconciled'
            ? 'reconciled'
            : zp.Status?.toLowerCase() === 'in_progress'
              ? 'in_progress'
              : 'unreconciled') as 'unreconciled' | 'in_progress' | 'reconciled',
          reconciledAmount: coerceCurrency(zp.Reconciled_Amount) || 0,
          remainingAmount: coerceCurrency(zp.Remaining_Amount) || totalAmount,
          matchedExpectationIds: [],
          notes: zp.Notes || '',
          lineItems,
        };
      });

      // Transform expectations
      const expectations: Expectation[] = zohoExpectations.map(ze => {
        // Provider is a lookup field - use the name for display and matching
        const providerName = ze.Provider?.name || 'Unknown Provider';

        const expectedAmount = coerceCurrency(ze.Expected_Fee_Amount);
        const allocatedAmount = coerceCurrency(ze.Allocated_Amount);
        const remainingAmount = coerceCurrency(ze.Remaining_Amount) || expectedAmount;

        return {
          id: ze.id,
          zohoId: ze.id, // Store Zoho ID for sync operations
          clientName: ze.Client_1?.name || 'Unknown Client',
          planReference: ze.Plan_Policy_Reference || '',
          expectedAmount,
          calculationDate: ze.Calculation_Date || new Date().toISOString().split('T')[0],
          fundReference: '',
          feeCategory: (ze.Fee_Category?.toLowerCase() === 'initial' ? 'initial' : 'ongoing') as 'initial' | 'ongoing',
          feeType: (ze.Fee_Type?.toLowerCase() || 'management') as 'management' | 'performance' | 'advisory' | 'custody',
          description: `${ze.Fee_Category || 'Ongoing'} ${ze.Fee_Type || 'fee'}`,
          providerName,
          adviserName: ze.Adviser_Name || '',
          superbiaCompany: ze.Superbia_Company || '',
          status: (ze.Status?.toLowerCase() === 'matched'
            ? 'matched'
            : ze.Status?.toLowerCase() === 'partial'
              ? 'partial'
              : ze.Status?.toLowerCase() === 'invalidated'
                ? 'invalidated'
                : 'unmatched') as 'unmatched' | 'partial' | 'matched' | 'invalidated',
          allocatedAmount,
          remainingAmount,
        matchedToPayments: [],
      };
    });

    // Count total line items across all payments
    const totalLineItems = payments.reduce((sum, p) => sum + p.lineItems.length, 0);
    
    // Sample provider names for debugging
    const paymentProviders = [...new Set(payments.map(p => p.providerName))].slice(0, 10);
    const expectationProviders = [...new Set(expectations.map(e => e.providerName))].slice(0, 10);
    
    console.log(`[Zoho] Loaded ${payments.length} payments with ${totalLineItems} total line items`);
    console.log(`[Zoho] Loaded ${expectations.length} expectations`);
    console.log(`[Zoho] Payment providers (sample):`, paymentProviders);
    console.log(`[Zoho] Expectation providers (sample):`, expectationProviders);
    
    // Sample calculation dates for debugging
    const sampleCalcDates = expectations.slice(0, 5).map(e => ({ client: e.clientName, date: e.calculationDate, provider: e.providerName }));
    console.log(`[Zoho] Sample expectations:`, sampleCalcDates);

    return { payments, expectations };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load Zoho data';
      console.error('[Zoho] Error:', message);
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, error, loadZohoData };
}
