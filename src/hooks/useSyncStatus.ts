import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SyncStatus {
  lastDownloadAt: string | null;
  lastSyncAt: string | null;
  pendingMatchCount: number;
  isLocked: boolean;
  lockReason: string | null;
}

interface UseSyncStatusReturn {
  syncStatus: SyncStatus | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lockForDownload: () => Promise<boolean>;
  unlockAfterSync: () => Promise<boolean>;
  updateLastDownload: () => Promise<boolean>;
  updateLastSync: () => Promise<boolean>;
}

export function useSyncStatus(): UseSyncStatusReturn {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('sync_status')
        .select('*')
        .eq('id', 'current')
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setSyncStatus({
        lastDownloadAt: data.last_download_at,
        lastSyncAt: data.last_sync_at,
        pendingMatchCount: data.pending_match_count,
        isLocked: data.is_locked,
        lockReason: data.lock_reason,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch sync status';
      setError(message);
      console.error('[SyncStatus] Error:', message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const lockForDownload = useCallback(async (): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('sync_status')
        .update({
          is_locked: true,
          lock_reason: 'Downloading data from Zoho',
        })
        .eq('id', 'current');

      if (updateError) throw new Error(updateError.message);
      await refresh();
      return true;
    } catch (err) {
      console.error('[SyncStatus] Failed to lock:', err);
      return false;
    }
  }, [refresh]);

  const unlockAfterSync = useCallback(async (): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('sync_status')
        .update({
          is_locked: false,
          lock_reason: null,
        })
        .eq('id', 'current');

      if (updateError) throw new Error(updateError.message);
      await refresh();
      return true;
    } catch (err) {
      console.error('[SyncStatus] Failed to unlock:', err);
      return false;
    }
  }, [refresh]);

  const updateLastDownload = useCallback(async (): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('sync_status')
        .update({
          last_download_at: new Date().toISOString(),
          is_locked: false,
          lock_reason: null,
        })
        .eq('id', 'current');

      if (updateError) throw new Error(updateError.message);
      await refresh();
      return true;
    } catch (err) {
      console.error('[SyncStatus] Failed to update last download:', err);
      return false;
    }
  }, [refresh]);

  const updateLastSync = useCallback(async (): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('sync_status')
        .update({
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', 'current');

      if (updateError) throw new Error(updateError.message);
      await refresh();
      return true;
    } catch (err) {
      console.error('[SyncStatus] Failed to update last sync:', err);
      return false;
    }
  }, [refresh]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    syncStatus,
    isLoading,
    error,
    refresh,
    lockForDownload,
    unlockAfterSync,
    updateLastDownload,
    updateLastSync,
  };
}
