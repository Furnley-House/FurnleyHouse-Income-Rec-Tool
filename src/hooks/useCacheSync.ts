import { supabase } from '@/integrations/supabase/client';

/**
 * Standalone cache sync utilities (no hooks, pure async functions).
 * Used by the zustand store to persist match confirmations to the Supabase cache.
 */

export async function syncLineItemStatusToCache(
  lineItemId: string,
  status: string,
  matchedExpectationId?: string,
  matchNotes?: string
): Promise<void> {
  const { error } = await supabase
    .from('cached_line_items')
    .update({
      status,
      matched_expectation_id: matchedExpectationId || null,
      match_notes: matchNotes || null,
    })
    .eq('id', lineItemId);

  if (error) {
    console.warn('[CacheSync] Failed to update line item:', lineItemId, error.message);
  }
}

export async function syncExpectationStatusToCache(
  expectationId: string,
  status: string,
  allocatedAmount: number,
  remainingAmount: number
): Promise<void> {
  const { error } = await supabase
    .from('cached_expectations')
    .update({
      status,
      allocated_amount: allocatedAmount,
      remaining_amount: remainingAmount,
    })
    .eq('id', expectationId);

  if (error) {
    console.warn('[CacheSync] Failed to update expectation:', expectationId, error.message);
  }
}

export async function syncPaymentStatusToCache(
  paymentId: string,
  status: string,
  reconciledAmount: number,
  remainingAmount: number
): Promise<void> {
  const { error } = await supabase
    .from('cached_payments')
    .update({
      status,
      reconciled_amount: reconciledAmount,
      remaining_amount: remainingAmount,
    })
    .eq('id', paymentId);

  if (error) {
    console.warn('[CacheSync] Failed to update payment:', paymentId, error.message);
  }
}

/**
 * Batch-sync all changes from a match confirmation to the cache.
 * Fire-and-forget — errors are logged but don't block the UI.
 */
export async function syncMatchConfirmationToCache(params: {
  paymentId: string;
  paymentStatus: string;
  reconciledAmount: number;
  remainingAmount: number;
  matchedLineItems: Array<{
    id: string;
    matchedExpectationId: string;
    notes: string;
  }>;
  matchedExpectations: Array<{
    id: string;
    allocatedAmount: number;
  }>;
}): Promise<void> {
  console.log('[CacheSync] Syncing match confirmation to cache...');

  try {
    await Promise.all([
      // Update payment
      syncPaymentStatusToCache(
        params.paymentId,
        params.paymentStatus,
        params.reconciledAmount,
        params.remainingAmount
      ),
      // Update line items
      ...params.matchedLineItems.map(li =>
        syncLineItemStatusToCache(li.id, 'matched', li.matchedExpectationId, li.notes)
      ),
      // Update expectations
      ...params.matchedExpectations.map(e =>
        syncExpectationStatusToCache(e.id, 'matched', e.allocatedAmount, 0)
      ),
    ]);

    console.log('[CacheSync] Match confirmation synced to cache');
  } catch (err) {
    console.error('[CacheSync] Error syncing to cache:', err);
  }
}
