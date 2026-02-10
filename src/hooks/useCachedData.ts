import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Payment, PaymentLineItem, Expectation } from '@/types/reconciliation';

interface CachedPaymentRow {
  id: string;
  provider_name: string;
  payment_reference: string | null;
  amount: number;
  payment_date: string | null;
  period_start: string | null;
  period_end: string | null;
  status: string;
  reconciled_amount: number;
  remaining_amount: number;
  notes: string | null;
  zoho_record_id: string | null;
}

interface CachedLineItemRow {
  id: string;
  payment_id: string;
  client_name: string | null;
  plan_reference: string | null;
  adviser_name: string | null;
  amount: number;
  fee_category: string | null;
  status: string;
  matched_expectation_id: string | null;
  match_notes: string | null;
  zoho_record_id: string | null;
}

interface CachedExpectationRow {
  id: string;
  provider_name: string;
  client_name: string | null;
  plan_reference: string | null;
  adviser_name: string | null;
  expected_amount: number;
  calculation_date: string | null;
  fee_category: string | null;
  status: string;
  allocated_amount: number;
  remaining_amount: number;
  zoho_record_id: string | null;
}

interface UseCachedDataReturn {
  isLoading: boolean;
  error: string | null;
  loadFromCache: () => Promise<{ payments: Payment[]; expectations: Expectation[] } | null>;
  saveToCache: (payments: Payment[], expectations: Expectation[]) => Promise<boolean>;
  clearCache: () => Promise<boolean>;
  updateLineItemStatus: (lineItemId: string, status: string, matchedExpectationId?: string, notes?: string) => Promise<boolean>;
  updateExpectationStatus: (expectationId: string, status: string, allocatedAmount?: number) => Promise<boolean>;
  updatePaymentStatus: (paymentId: string, status: string, reconciledAmount: number, remainingAmount: number) => Promise<boolean>;
  savePendingMatch: (match: {
    paymentId: string;
    lineItemId: string;
    expectationId: string;
    matchedAmount: number;
    variance: number;
    variancePercentage: number;
    matchQuality?: string;
    notes?: string;
  }) => Promise<boolean>;
  getPendingMatches: () => Promise<Array<{
    id: string;
    paymentId: string;
    lineItemId: string;
    expectationId: string;
    matchedAmount: number;
    variance: number;
    variancePercentage: number;
    matchQuality: string | null;
    notes: string | null;
    matchedAt: string;
    syncedToZoho: boolean;
  }> | null>;
  markMatchesSynced: (matchIds: string[]) => Promise<boolean>;
}

export function useCachedData(): UseCachedDataReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFromCache = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Helper to fetch all rows with pagination (Supabase default limit is 1000)
      const fetchPaginated = async (table: 'cached_payments' | 'cached_line_items' | 'cached_expectations') => {
        const rows: any[] = [];
        const batchSize = 1000;
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error: fetchError } = await supabase
            .from(table)
            .select('*')
            .range(offset, offset + batchSize - 1);
          if (fetchError) throw new Error(`${table}: ${fetchError.message}`);
          if (data && data.length > 0) {
            rows.push(...data);
            offset += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }
        return rows;
      };

      // Fetch all data with pagination
      const paymentsData = await fetchPaginated('cached_payments') as CachedPaymentRow[];
      const lineItemsData = await fetchPaginated('cached_line_items') as CachedLineItemRow[];
      const expectationsData = await fetchPaginated('cached_expectations') as CachedExpectationRow[];

      // Group line items by payment
      const lineItemsByPayment = new Map<string, CachedLineItemRow[]>();
      lineItemsData.forEach(li => {
        const existing = lineItemsByPayment.get(li.payment_id) || [];
        existing.push(li);
        lineItemsByPayment.set(li.payment_id, existing);
      });

      // Transform to app types
      const payments: Payment[] = paymentsData.map(p => {
        const lineItems: PaymentLineItem[] = (lineItemsByPayment.get(p.id) || []).map(li => ({
          id: li.id,
          zohoId: li.zoho_record_id || undefined,
          clientName: li.client_name || 'Unknown Client',
          planReference: li.plan_reference || '',
          adviserName: li.adviser_name || undefined,
          feeCategory: (li.fee_category?.toLowerCase() === 'initial' ? 'initial' : 'ongoing') as 'initial' | 'ongoing',
          amount: Number(li.amount) || 0,
          description: `${li.fee_category || 'Ongoing'} fee`,
          status: li.status as 'unmatched' | 'matched' | 'approved_unmatched',
          matchedExpectationId: li.matched_expectation_id || undefined,
          matchNotes: li.match_notes || undefined,
        }));

        return {
          id: p.id,
          zohoId: p.zoho_record_id || undefined,
          providerName: p.provider_name,
          paymentReference: p.payment_reference || 'Unknown Payment',
          amount: Number(p.amount) || 0,
          paymentDate: p.payment_date || new Date().toISOString().split('T')[0],
          bankReference: '',
          statementItemCount: lineItems.length,
          status: p.status as 'unreconciled' | 'in_progress' | 'reconciled',
          reconciledAmount: Number(p.reconciled_amount) || 0,
          remainingAmount: Number(p.remaining_amount) || Number(p.amount) || 0,
          matchedExpectationIds: [],
          notes: p.notes || '',
          lineItems,
        };
      });

      const expectations: Expectation[] = expectationsData.map(e => ({
        id: e.id,
        zohoId: e.zoho_record_id || undefined,
        clientName: e.client_name || 'Unknown Client',
        planReference: e.plan_reference || '',
        expectedAmount: Number(e.expected_amount) || 0,
        calculationDate: e.calculation_date || new Date().toISOString().split('T')[0],
        fundReference: '',
        feeCategory: (e.fee_category?.toLowerCase() === 'initial' ? 'initial' : 'ongoing') as 'initial' | 'ongoing',
        feeType: 'management' as const,
        description: `${e.fee_category || 'Ongoing'} fee`,
        providerName: e.provider_name,
        adviserName: e.adviser_name || '',
        superbiaCompany: '',
        status: e.status as 'unmatched' | 'partial' | 'matched' | 'invalidated',
        allocatedAmount: Number(e.allocated_amount) || 0,
        remainingAmount: Number(e.remaining_amount) || Number(e.expected_amount) || 0,
        matchedToPayments: [],
      }));

      console.log(`[Cache] Loaded ${payments.length} payments with ${lineItemsData.length} line items, ${expectations.length} expectations`);
      return { payments, expectations };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load from cache';
      setError(message);
      console.error('[Cache] Error:', message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveToCache = useCallback(async (payments: Payment[], expectations: Expectation[]): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      // Clear existing cache first
      await supabase.from('cached_line_items').delete().neq('id', '');
      await supabase.from('cached_payments').delete().neq('id', '');
      await supabase.from('cached_expectations').delete().neq('id', '');

      // Insert payments
      if (payments.length > 0) {
        const paymentRows = payments.map(p => ({
          id: p.id,
          provider_name: p.providerName,
          payment_reference: p.paymentReference,
          amount: p.amount,
          payment_date: p.paymentDate,
          period_start: p.dateRangeStart || null,
          period_end: p.dateRangeEnd || null,
          status: p.status,
          reconciled_amount: p.reconciledAmount,
          remaining_amount: p.remainingAmount,
          notes: p.notes || null,
          zoho_record_id: p.zohoId || p.id,
        }));

        const { error: paymentsError } = await supabase
          .from('cached_payments')
          .insert(paymentRows);

        if (paymentsError) throw new Error(`Payments: ${paymentsError.message}`);

        // Insert line items
        const lineItemRows = payments.flatMap(p =>
          p.lineItems.map(li => ({
            id: li.id,
            payment_id: p.id,
            client_name: li.clientName,
            plan_reference: li.planReference,
            adviser_name: li.adviserName || null,
            amount: li.amount,
            fee_category: li.feeCategory,
            status: li.status,
            matched_expectation_id: li.matchedExpectationId || null,
            match_notes: li.matchNotes || null,
            zoho_record_id: li.zohoId || li.id,
          }))
        );

        if (lineItemRows.length > 0) {
          const { error: lineItemsError } = await supabase
            .from('cached_line_items')
            .insert(lineItemRows);

          if (lineItemsError) throw new Error(`Line Items: ${lineItemsError.message}`);
        }
      }

      // Insert expectations
      if (expectations.length > 0) {
        const expectationRows = expectations.map(e => ({
          id: e.id,
          provider_name: e.providerName,
          client_name: e.clientName,
          plan_reference: e.planReference,
          adviser_name: e.adviserName || null,
          expected_amount: e.expectedAmount,
          calculation_date: e.calculationDate,
          fee_category: e.feeCategory,
          status: e.status,
          allocated_amount: e.allocatedAmount,
          remaining_amount: e.remainingAmount,
          zoho_record_id: e.zohoId || e.id,
        }));

        const { error: expectationsError } = await supabase
          .from('cached_expectations')
          .insert(expectationRows);

        if (expectationsError) throw new Error(`Expectations: ${expectationsError.message}`);
      }

      console.log(`[Cache] Saved ${payments.length} payments, ${expectations.length} expectations`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save to cache';
      setError(message);
      console.error('[Cache] Save error:', message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCache = useCallback(async (): Promise<boolean> => {
    try {
      await supabase.from('pending_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('cached_line_items').delete().neq('id', '');
      await supabase.from('cached_payments').delete().neq('id', '');
      await supabase.from('cached_expectations').delete().neq('id', '');
      console.log('[Cache] Cleared');
      return true;
    } catch (err) {
      console.error('[Cache] Clear error:', err);
      return false;
    }
  }, []);

  const updateLineItemStatus = useCallback(async (
    lineItemId: string,
    status: string,
    matchedExpectationId?: string,
    notes?: string
  ): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('cached_line_items')
        .update({
          status,
          matched_expectation_id: matchedExpectationId || null,
          match_notes: notes || null,
        })
        .eq('id', lineItemId);

      if (updateError) throw new Error(updateError.message);
      return true;
    } catch (err) {
      console.error('[Cache] Update line item error:', err);
      return false;
    }
  }, []);

  const updateExpectationStatus = useCallback(async (
    expectationId: string,
    status: string,
    allocatedAmount?: number
  ): Promise<boolean> => {
    try {
      const updateData: Record<string, unknown> = { status };
      if (allocatedAmount !== undefined) {
        updateData.allocated_amount = allocatedAmount;
        updateData.remaining_amount = 0;
      }

      const { error: updateError } = await supabase
        .from('cached_expectations')
        .update(updateData)
        .eq('id', expectationId);

      if (updateError) throw new Error(updateError.message);
      return true;
    } catch (err) {
      console.error('[Cache] Update expectation error:', err);
      return false;
    }
  }, []);

  const updatePaymentStatus = useCallback(async (
    paymentId: string,
    status: string,
    reconciledAmount: number,
    remainingAmount: number
  ): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('cached_payments')
        .update({
          status,
          reconciled_amount: reconciledAmount,
          remaining_amount: remainingAmount,
        })
        .eq('id', paymentId);

      if (updateError) throw new Error(updateError.message);
      return true;
    } catch (err) {
      console.error('[Cache] Update payment error:', err);
      return false;
    }
  }, []);

  const savePendingMatch = useCallback(async (match: {
    paymentId: string;
    lineItemId: string;
    expectationId: string;
    matchedAmount: number;
    variance: number;
    variancePercentage: number;
    matchQuality?: string;
    notes?: string;
  }): Promise<boolean> => {
    try {
      const { error: insertError } = await supabase
        .from('pending_matches')
        .insert({
          payment_id: match.paymentId,
          line_item_id: match.lineItemId,
          expectation_id: match.expectationId,
          matched_amount: match.matchedAmount,
          variance: match.variance,
          variance_percentage: match.variancePercentage,
          match_quality: match.matchQuality || null,
          notes: match.notes || null,
          synced_to_zoho: false,
        });

      if (insertError) throw new Error(insertError.message);
      return true;
    } catch (err) {
      console.error('[Cache] Save pending match error:', err);
      return false;
    }
  }, []);

  const getPendingMatches = useCallback(async () => {
    try {
      const result: Array<{
        id: string;
        payment_id: string;
        line_item_id: string;
        expectation_id: string;
        matched_amount: number;
        variance: number;
        variance_percentage: number;
        match_quality: string | null;
        notes: string | null;
        matched_at: string;
        synced_to_zoho: boolean;
      }> = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error: fetchError } = await supabase
          .from('pending_matches')
          .select('*')
          .eq('synced_to_zoho', false)
          .range(offset, offset + batchSize - 1);

        if (fetchError) throw new Error(fetchError.message);

        if (data && data.length > 0) {
          result.push(...data);
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`[Cache] Fetched ${result.length} pending matches (paginated)`);

      return result.map(m => ({
        id: m.id,
        paymentId: m.payment_id,
        lineItemId: m.line_item_id,
        expectationId: m.expectation_id,
        matchedAmount: Number(m.matched_amount),
        variance: Number(m.variance),
        variancePercentage: Number(m.variance_percentage),
        matchQuality: m.match_quality,
        notes: m.notes,
        matchedAt: m.matched_at,
        syncedToZoho: m.synced_to_zoho,
      }));
    } catch (err) {
      console.error('[Cache] Get pending matches error:', err);
      return null;
    }
  }, []);

  const markMatchesSynced = useCallback(async (matchIds: string[]): Promise<boolean> => {
    try {
      // Chunk updates to avoid PostgREST URL length limits
      const CHUNK_SIZE = 100;
      for (let i = 0; i < matchIds.length; i += CHUNK_SIZE) {
        const chunk = matchIds.slice(i, i + CHUNK_SIZE);
        const { error: updateError } = await supabase
          .from('pending_matches')
          .update({
            synced_to_zoho: true,
            synced_at: new Date().toISOString(),
          })
          .in('id', chunk);

        if (updateError) throw new Error(updateError.message);
      }
      return true;
    } catch (err) {
      console.error('[Cache] Mark matches synced error:', err);
      return false;
    }
  }, []);

  return {
    isLoading,
    error,
    loadFromCache,
    saveToCache,
    clearCache,
    updateLineItemStatus,
    updateExpectationStatus,
    updatePaymentStatus,
    savePendingMatch,
    getPendingMatches,
    markMatchesSynced,
  };
}
