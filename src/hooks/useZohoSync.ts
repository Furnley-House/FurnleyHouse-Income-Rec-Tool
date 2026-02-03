import { supabase } from "@/integrations/supabase/client";
import { useReconciliationStore } from "@/store/reconciliationStore";
import { toast } from "sonner";

interface MatchSyncData {
  paymentId: string;
  paymentZohoId: string;
  lineItemId: string;
  lineItemZohoId: string;
  expectationId: string;
  expectationZohoId: string;
  matchedAmount: number;
  variance: number;
  variancePercentage: number;
  matchType: 'full' | 'partial' | 'multi';
  matchMethod: 'auto' | 'manual' | 'ai-suggested';
  matchQuality: 'perfect' | 'good' | 'acceptable' | 'warning';
  notes: string;
}

interface InvalidationSyncData {
  expectationZohoId: string;
  reason: string;
}

/**
 * Hook for syncing reconciliation data back to Zoho CRM
 */
export function useZohoSync() {
  const { dataSource } = useReconciliationStore();

  /**
   * Sync a confirmed match to Zoho CRM
   * Creates a Payment_Matches record and updates related records
   */
  const syncMatch = async (matchData: MatchSyncData): Promise<boolean> => {
    if (dataSource !== 'zoho') {
      console.log('[ZohoSync] Skipping sync - not using Zoho data source');
      return true; // Not an error, just skip
    }

    console.log('[ZohoSync] Syncing match to Zoho:', matchData);

    try {
      // 1. Create the match record in Payment_Matches
      const { data: matchResult, error: matchError } = await supabase.functions.invoke('zoho-crm', {
        body: {
          action: 'createMatch',
          params: {
            paymentId: matchData.paymentZohoId,
            lineItemId: matchData.lineItemZohoId,
            expectationId: matchData.expectationZohoId,
            matchedAmount: matchData.matchedAmount,
            variance: matchData.variance,
            variancePercentage: matchData.variancePercentage,
            matchType: matchData.matchType,
            matchMethod: matchData.matchMethod,
            matchQuality: matchData.matchQuality,
            notes: matchData.notes,
          }
        }
      });

      if (matchError) {
        console.error('[ZohoSync] Error creating match:', matchError);
        throw new Error(matchError.message);
      }

      if (!matchResult?.success) {
        console.error('[ZohoSync] Match creation failed:', matchResult);
        throw new Error(matchResult?.error || 'Failed to create match record');
      }

      console.log('[ZohoSync] Match record created:', matchResult);

      // 2. Update the line item status in Bank_Payment_Lines
      const { data: lineItemResult, error: lineItemError } = await supabase.functions.invoke('zoho-crm', {
        body: {
          action: 'updateRecord',
          params: {
            module: 'Bank_Payment_Lines',
            recordId: matchData.lineItemZohoId,
            data: {
              Status: 'matched',
              Matched_Expectation: matchData.expectationZohoId,
              Match_Notes: matchData.notes || null,
            }
          }
        }
      });

      if (lineItemError) {
        console.warn('[ZohoSync] Warning: Failed to update line item status:', lineItemError);
      } else {
        console.log('[ZohoSync] Line item updated:', lineItemResult);
      }

      // 3. Update the expectation status
      const { data: expectationResult, error: expectationError } = await supabase.functions.invoke('zoho-crm', {
        body: {
          action: 'updateRecord',
          params: {
            module: 'Expectations',
            recordId: matchData.expectationZohoId,
            data: {
              Status: 'matched',
              Allocated_Amount: matchData.matchedAmount,
              Remaining_Amount: 0,
            }
          }
        }
      });

      if (expectationError) {
        console.warn('[ZohoSync] Warning: Failed to update expectation status:', expectationError);
      } else {
        console.log('[ZohoSync] Expectation updated:', expectationResult);
      }

      return true;
    } catch (error) {
      console.error('[ZohoSync] Match sync failed:', error);
      return false;
    }
  };

  /**
   * Sync multiple matches at once (batch operation)
   */
  const syncMatches = async (matches: MatchSyncData[]): Promise<{ success: number; failed: number }> => {
    if (dataSource !== 'zoho') {
      console.log('[ZohoSync] Skipping batch sync - not using Zoho data source');
      return { success: matches.length, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    for (const match of matches) {
      const result = await syncMatch(match);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    if (failed > 0) {
      toast.error(`${failed} match(es) failed to sync to Zoho`, {
        description: `${success} match(es) synced successfully`,
      });
    } else if (success > 0) {
      toast.success(`${success} match(es) synced to Zoho`);
    }

    return { success, failed };
  };

  /**
   * Update payment status in Zoho after reconciliation progress
   */
  const syncPaymentStatus = async (
    paymentZohoId: string,
    status: 'unreconciled' | 'in_progress' | 'reconciled',
    reconciledAmount: number,
    remainingAmount: number,
    notes?: string
  ): Promise<boolean> => {
    if (dataSource !== 'zoho') {
      return true;
    }

    console.log('[ZohoSync] Updating payment status:', { paymentZohoId, status });

    try {
      const updateData: Record<string, unknown> = {
        Status: status,
        Reconciled_Amount: reconciledAmount,
        Remaining_Amount: remainingAmount,
      };

      if (status === 'reconciled') {
        updateData.Reconciled_At = new Date().toISOString();
        updateData.Reconciled_By = 'Reconciliation Tool';
      }

      if (notes) {
        updateData.Notes = notes;
      }

      const { data, error } = await supabase.functions.invoke('zoho-crm', {
        body: {
          action: 'updateRecord',
          params: {
            module: 'Bank_Payments',
            recordId: paymentZohoId,
            data: updateData,
          }
        }
      });

      if (error) {
        console.error('[ZohoSync] Failed to update payment status:', error);
        return false;
      }

      console.log('[ZohoSync] Payment status updated:', data);
      return true;
    } catch (error) {
      console.error('[ZohoSync] Payment status sync failed:', error);
      return false;
    }
  };

  /**
   * Sync expectation invalidation to Zoho CRM
   */
  const syncInvalidation = async (data: InvalidationSyncData): Promise<boolean> => {
    if (dataSource !== 'zoho') {
      console.log('[ZohoSync] Skipping invalidation sync - not using Zoho data source');
      return true;
    }

    console.log('[ZohoSync] Syncing invalidation to Zoho:', data);

    try {
      const { data: result, error } = await supabase.functions.invoke('zoho-crm', {
        body: {
          action: 'updateRecord',
          params: {
            module: 'Expectations',
            recordId: data.expectationZohoId,
            data: {
              Status: 'invalidated',
              Invalidated_At: new Date().toISOString(),
              Invalidated_By: 'Reconciliation Tool',
              Invalidation_Reason: data.reason,
            }
          }
        }
      });

      if (error) {
        console.error('[ZohoSync] Invalidation sync error:', error);
        toast.error('Failed to sync invalidation to Zoho', {
          description: error.message,
        });
        return false;
      }

      if (!result?.success) {
        console.error('[ZohoSync] Invalidation sync failed:', result);
        toast.error('Failed to sync invalidation to Zoho', {
          description: result?.error || 'Unknown error',
        });
        return false;
      }

      console.log('[ZohoSync] Invalidation synced:', result);
      toast.success('Expectation marked as invalid in Zoho');
      return true;
    } catch (error) {
      console.error('[ZohoSync] Invalidation sync failed:', error);
      toast.error('Failed to sync invalidation to Zoho');
      return false;
    }
  };

  return {
    syncMatch,
    syncMatches,
    syncPaymentStatus,
    syncInvalidation,
  };
}
