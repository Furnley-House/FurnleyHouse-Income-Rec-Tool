import { useState, useEffect, useCallback } from 'react';
import { cacheApi } from '@/lib/api';

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
      const resp = await cacheApi.getSyncStatus();
      const data = resp.data || resp;

      if (!data) throw new Error('No sync status data returned');

      setSyncStatus({
        lastDownloadAt: data.lastDownloadAt ?? data.last_download_at,
        lastSyncAt: data.lastSyncAt ?? data.last_sync_at,
        pendingMatchCount: data.pendingMatchCount ?? data.pending_match_count ?? 0,
        isLocked: data.isLocked ?? data.is_locked ?? false,
        lockReason: data.lockReason ?? data.lock_reason ?? null,
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
      await cacheApi.updateSyncStatus({ isLocked: true, lockReason: 'Downloading data from Zoho' });
      await refresh();
      return true;
    } catch (err) {
      console.error('[SyncStatus] Failed to lock:', err);
      return false;
    }
  }, [refresh]);

  const unlockAfterSync = useCallback(async (): Promise<boolean> => {
    try {
      await cacheApi.updateSyncStatus({ isLocked: false, lockReason: null });
      await refresh();
      return true;
    } catch (err) {
      console.error('[SyncStatus] Failed to unlock:', err);
      return false;
    }
  }, [refresh]);

  const updateLastDownload = useCallback(async (): Promise<boolean> => {
    try {
      await cacheApi.updateSyncStatus({
        lastDownloadAt: new Date().toISOString(),
        isLocked: false,
        lockReason: null,
      });
      await refresh();
      return true;
    } catch (err) {
      console.error('[SyncStatus] Failed to update last download:', err);
      return false;
    }
  }, [refresh]);

  const updateLastSync = useCallback(async (): Promise<boolean> => {
    try {
      await cacheApi.updateSyncStatus({ lastSyncAt: new Date().toISOString() });
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
