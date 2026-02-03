import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Payment, PaymentLineItem, Expectation } from '@/types/reconciliation';

export type DataSource = 'mock' | 'zoho';

interface ZohoPayment {
  id: string;
  Name: string;
  Bank_Reference?: string;
  Payment_Date?: string;
  Total_Amount?: number;
  Provider?: { name: string; id: string };
  Status?: string;
}

interface ZohoLineItem {
  id: string;
  Name: string;
  Bank_Payment?: { name: string; id: string };
  Plan_Reference?: string;
  Client_Name?: string;
  Adviser_Name?: string;
  Amount?: number;
  Fee_Category?: string;
  Fee_Type?: string;
  Description?: string;
}

interface ZohoExpectation {
  id: string;
  Name: string;
  Plan_Policy_Reference?: string;
  Client_1?: { name: string; id: string };
  Expected_Amount?: number;
  Calculation_Date?: string;
  Fee_Category?: string;
  Fee_Type?: string;
  Provider?: { name: string; id: string };
  Adviser?: string;
  Superbia_Company?: string;
  Status?: string;
}

interface ZohoProvider {
  id: string;
  Name: string;
  Provider_Group?: string;
}

interface UseZohoDataReturn {
  isLoading: boolean;
  error: string | null;
  loadZohoData: () => Promise<{ payments: Payment[]; expectations: Expectation[] } | null>;
}

export function useZohoData(): UseZohoDataReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadZohoData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [paymentsRes, lineItemsRes, expectationsRes, providersRes] = await Promise.all([
        supabase.functions.invoke('zoho-crm', { body: { action: 'getPayments' } }),
        supabase.functions.invoke('zoho-crm', { body: { action: 'getPaymentLineItems' } }),
        supabase.functions.invoke('zoho-crm', { body: { action: 'getExpectations' } }),
        supabase.functions.invoke('zoho-crm', { body: { action: 'getProviders' } }),
      ]);

      if (paymentsRes.error) throw new Error(`Payments: ${paymentsRes.error.message}`);
      if (lineItemsRes.error) throw new Error(`Line Items: ${lineItemsRes.error.message}`);
      if (expectationsRes.error) throw new Error(`Expectations: ${expectationsRes.error.message}`);
      if (providersRes.error) throw new Error(`Providers: ${providersRes.error.message}`);

      const zohoPayments: ZohoPayment[] = paymentsRes.data?.data || [];
      const zohoLineItems: ZohoLineItem[] = lineItemsRes.data?.data || [];
      const zohoExpectations: ZohoExpectation[] = expectationsRes.data?.data || [];
      const zohoProviders: ZohoProvider[] = providersRes.data?.data || [];

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
        const providerName = zp.Provider?.id 
          ? providerMap.get(zp.Provider.id) || zp.Provider.name 
          : 'Unknown Provider';
        
        const paymentLineItems = lineItemsByPayment.get(zp.id) || [];
        
        const lineItems: PaymentLineItem[] = paymentLineItems.map(li => ({
          id: li.id,
          clientName: li.Client_Name || 'Unknown Client',
          planReference: li.Plan_Reference || '',
          agencyCode: undefined, // Not in Zoho yet
          adviserName: li.Adviser_Name,
          feeType: li.Fee_Type?.toLowerCase(),
          feeCategory: (li.Fee_Category?.toLowerCase() === 'initial' ? 'initial' : 'ongoing') as 'initial' | 'ongoing',
          amount: li.Amount || 0,
          description: li.Description || `${li.Fee_Category || 'Ongoing'} ${li.Fee_Type || 'fee'}`,
          status: 'unmatched' as const,
        }));

        const totalAmount = zp.Total_Amount || lineItems.reduce((sum, li) => sum + li.amount, 0);

        return {
          id: zp.id,
          providerName,
          paymentReference: zp.Name,
          amount: totalAmount,
          paymentDate: zp.Payment_Date || new Date().toISOString().split('T')[0],
          bankReference: zp.Bank_Reference || '',
          statementItemCount: lineItems.length,
          status: 'unreconciled' as const,
          reconciledAmount: 0,
          remainingAmount: totalAmount,
          matchedExpectationIds: [],
          notes: '',
          lineItems,
        };
      });

      // Transform expectations
      const expectations: Expectation[] = zohoExpectations.map(ze => {
        const providerName = ze.Provider?.id 
          ? providerMap.get(ze.Provider.id) || ze.Provider.name 
          : 'Unknown Provider';

        return {
          id: ze.id,
          clientName: ze.Client_1?.name || 'Unknown Client',
          planReference: ze.Plan_Policy_Reference || '',
          expectedAmount: ze.Expected_Amount || 0,
          calculationDate: ze.Calculation_Date || new Date().toISOString().split('T')[0],
          fundReference: '',
          feeCategory: (ze.Fee_Category?.toLowerCase() === 'initial' ? 'initial' : 'ongoing') as 'initial' | 'ongoing',
          feeType: (ze.Fee_Type?.toLowerCase() || 'management') as 'management' | 'performance' | 'advisory' | 'custody',
          description: `${ze.Fee_Category || 'Ongoing'} ${ze.Fee_Type || 'fee'}`,
          providerName,
          adviserName: ze.Adviser || '',
          superbiaCompany: ze.Superbia_Company || '',
          status: ze.Status?.toLowerCase() === 'matched' ? 'matched' : 'unmatched' as const,
          allocatedAmount: 0,
          remainingAmount: ze.Expected_Amount || 0,
          matchedToPayments: [],
        };
      });

      console.log(`[Zoho] Loaded ${payments.length} payments, ${expectations.length} expectations`);

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
