import { callZoho } from '@/lib/api';
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
  /**
   * Sync a confirmed match to Zoho CRM
   * Creates a Payment_Matches record and updates related records
   */
  const syncMatch = async (matchData: MatchSyncData, skipSecondaryUpdates = false): Promise<boolean> => {
    console.log('[ZohoSync] Syncing match to Zoho:', matchData);

    try {
      // 1. Create the match record in Payment_Matches (the critical operation)
      const { data: matchResult, error: matchError } = await callZoho('createMatch', {
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
      });

      if (matchError) {
        console.error('[ZohoSync] Error creating match:', matchError);
        throw new Error(matchError.message);
      }

      if (!matchResult?.success) {
        console.error('[ZohoSync] Match creation failed:', matchResult);
        // Propagate rate limit info so callers can stop
        if (matchResult?.code === 'ZOHO_RATE_LIMIT') {
          const err = new Error(matchResult?.error || 'Rate limited');
          (err as any).isRateLimit = true;
          (err as any).retryAfterSeconds = matchResult?.retryAfterSeconds || 60;
          throw err;
        }
        throw new Error(matchResult?.error || 'Failed to create match record');
      }

      console.log('[ZohoSync] Match record created:', matchResult);

      // Skip secondary updates during batch sync to reduce API calls and avoid rate limits
      if (!skipSecondaryUpdates) {
        // 2. Update the line item status in Bank_Payment_Lines
        const { data: lineItemResult, error: lineItemError } = await callZoho('updateRecord', {
          module: 'Bank_Payment_Lines',
          recordId: matchData.lineItemZohoId,
          data: { Status: 'matched', Match_Notes: matchData.notes || null },
        });

        if (lineItemError) {
          console.warn('[ZohoSync] Warning: Failed to update line item status:', lineItemError);
        } else {
          console.log('[ZohoSync] Line item updated:', lineItemResult);
        }

        // 3. Update the expectation status
        const { data: expectationResult, error: expectationError } = await callZoho('updateRecord', {
          module: 'Expectations',
          recordId: matchData.expectationZohoId,
          data: { Status: 'matched', Allocated_Amount: matchData.matchedAmount, Remaining_Amount: 0 },
        });

        if (expectationError) {
          console.warn('[ZohoSync] Warning: Failed to update expectation status:', expectationError);
        } else {
          console.log('[ZohoSync] Expectation updated:', expectationResult);
        }
      }

      return true;
    } catch (error: any) {
      console.error('[ZohoSync] Match sync failed:', error);
      if (error?.isRateLimit) throw error; // Re-throw rate limits for caller handling
      return false;
    }
  };

  /**
   * Sync a batch of up to 100 matches in a single Zoho API call.
   * Returns per-record results so the caller can track which succeeded.
   */
  const syncMatchBatch = async (
    matches: Array<{
      paymentZohoId: string;
      lineItemZohoId: string;
      expectationZohoId?: string; // Optional for data-check matches
      matchedAmount: number;
      variance: number;
      variancePercentage: number;
      matchType: string;
      matchMethod: string;
      matchQuality: string;
      notes: string;
      reasonCode?: string; // For data-check matches
    }>
  ): Promise<{ successCount: number; failedCount: number; results: Array<{ index: number; status: string }> }> => {
    console.log(`[ZohoSync] Batch syncing ${matches.length} matches`);

    const { data, error } = await callZoho('createMatchBatch', {
      records: matches.map(m => ({
        paymentId: m.paymentZohoId,
        lineItemId: m.lineItemZohoId,
        expectationId: m.expectationZohoId || null,
        matchedAmount: m.matchedAmount,
        variance: m.variance,
        variancePercentage: m.variancePercentage,
        matchType: m.matchType,
        matchMethod: m.matchMethod,
        matchQuality: m.matchQuality,
        notes: m.notes,
        reasonCode: m.reasonCode || null,
      })),
    });

    if (error) {
      console.error('[ZohoSync] Batch sync error:', error);
      throw new Error(error.message);
    }

    if (!data?.success) {
      if (data?.code === 'ZOHO_RATE_LIMIT') {
        const err = new Error(data?.error || 'Rate limited');
        (err as any).isRateLimit = true;
        (err as any).retryAfterSeconds = data?.retryAfterSeconds || 60;
        throw err;
      }
      throw new Error(data?.error || 'Batch sync failed');
    }

    const batchData = data.data;
    return {
      successCount: batchData.successCount,
      failedCount: batchData.failedCount,
      results: batchData.batchResults || [],
    };
  };

  /**
   * Sync multiple matches at once (batch operation) - LEGACY, kept for compatibility
   */
  const syncMatches = async (matches: MatchSyncData[]): Promise<{ success: number; failed: number }> => {
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

      const { data, error } = await callZoho('updateRecord', {
        module: 'Bank_Payments',
        recordId: paymentZohoId,
        data: updateData,
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
    console.log('[ZohoSync] Syncing invalidation to Zoho:', data);

    try {
      const { data: result, error } = await callZoho('updateRecord', {
        module: 'Expectations',
        recordId: data.expectationZohoId,
        data: {
          Status: 'invalidated',
          Invalidated_At: new Date().toISOString(),
          Invalidated_By: 'Reconciliation Tool',
          Invalidation_Reason: data.reason,
        },
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

  /**
   * Batch-update records in a Zoho module (up to 100 per call).
   * Used post-sync to update Bank_Payment_Lines and Expectations statuses.
   */
  const updateRecordsBatch = async (
    module: string,
    records: Array<{ id: string; [key: string]: unknown }>
  ): Promise<{ successCount: number; failedCount: number }> => {
    console.log(`[ZohoSync] Batch updating ${records.length} records in ${module}`);
    console.log(`[ZohoSync] Sample record:`, JSON.stringify(records[0]));

    const BATCH_SIZE = 100;
    let totalSuccess = 0;
    let totalFailed = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const chunk = records.slice(i, i + BATCH_SIZE);

      console.log(`[ZohoSync] Sending batch ${Math.floor(i / BATCH_SIZE) + 1} with ${chunk.length} records to ${module}`);

      const { data, error } = await callZoho('updateRecordsBatch', { module, records: chunk });

      if (error) {
        console.error(`[ZohoSync] Edge function error for ${module}:`, error);
        totalFailed += chunk.length;
        continue;
      }

      console.log(`[ZohoSync] Raw response for ${module}:`, JSON.stringify(data));

      if (!data?.success) {
        if (data?.code === 'ZOHO_RATE_LIMIT') {
          const err = new Error(data?.error || 'Rate limited');
          (err as any).isRateLimit = true;
          (err as any).retryAfterSeconds = data?.retryAfterSeconds || 60;
          throw err;
        }
        console.error(`[ZohoSync] Batch update failed for ${module}:`, data);
        totalFailed += chunk.length;
        continue;
      }

      const batchResults = data.data?.batchResults || [];
      const batchSuccess = data.data?.successCount || 0;
      const batchFailed = data.data?.failedCount || 0;

      // Log any individual record failures with details
      const failures = batchResults.filter((r: any) => r.status !== 'success');
      if (failures.length > 0) {
        console.error(`[ZohoSync] ${module} per-record failures:`, JSON.stringify(failures.slice(0, 5)));
      }

      totalSuccess += batchSuccess;
      totalFailed += batchFailed;

      // Delay between batches
      if (i + BATCH_SIZE < records.length) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    console.log(`[ZohoSync] ${module} batch update complete: ${totalSuccess} success, ${totalFailed} failed`);
    return { successCount: totalSuccess, failedCount: totalFailed };
  };

  return {
    syncMatch,
    syncMatchBatch,
    syncMatches,
    syncPaymentStatus,
    syncInvalidation,
    updateRecordsBatch,
  };
}
