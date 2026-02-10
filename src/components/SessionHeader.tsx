import { useState, useEffect } from 'react';
import { useReconciliationStore } from '@/store/reconciliationStore';
import { useZohoData } from '@/hooks/useZohoData';
import { useCachedData } from '@/hooks/useCachedData';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { useZohoSync } from '@/hooks/useZohoSync';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  Calendar,
  Wallet,
  Settings,
  Cloud,
  Loader2,
  RefreshCw,
  Clock,
  Upload,
  Database,
  CheckCircle2
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DataImport } from './DataImport';
import { toast } from 'sonner';

export function SessionHeader() {
  const { 
    statistics, 
    tolerance, 
    setTolerance,
    selectedPaymentId,
    autoMatchCurrentPayment,
    isLoadingData,
    setZohoData,
    setLoadingState,
    payments,
    expectations,
    matches
  } = useReconciliationStore();
  
  const { loadZohoData, isLoading: isZohoLoading } = useZohoData();
  const { saveToCache, loadFromCache, getPendingMatches, markMatchesSynced, isLoading: isCacheLoading } = useCachedData();
  const { syncStatus, refresh: refreshSyncStatus, updateLastDownload, updateLastSync } = useSyncStatus();
  const { syncMatchBatch, updateRecordsBatch } = useZohoSync();
  
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  
  // Load pending match count on mount and when matches change
  useEffect(() => {
    const loadPendingCount = async () => {
      const pending = await getPendingMatches();
      setPendingCount(pending?.length || 0);
    };
    loadPendingCount();
    
    // Poll every 5s to catch async DB writes from MatchConfirmation
    const interval = setInterval(loadPendingCount, 5000);
    return () => clearInterval(interval);
  }, [getPendingMatches, matches]);
  
  // Countdown timer for rate limit
  useEffect(() => {
    if (countdown && countdown > 0) {
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [countdown]);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  const progressPercentage = statistics.totalPayments > 0 
    ? (statistics.reconciledPayments / statistics.totalPayments) * 100 
    : 0;
  
  // Download data from Zoho and save to cache
  const handleDownloadData = async () => {
    if (countdown && countdown > 0) {
      toast.warning(`Please wait ${countdown} seconds before retrying`);
      return;
    }
    
    // Check if there are pending matches
    if (pendingCount > 0) {
      toast.error(`Cannot download: ${pendingCount} pending matches need to be synced first`, {
        description: 'Please sync your changes to Zoho before downloading new data'
      });
      return;
    }
    
    setLoadingState(true);
    toast.info('Downloading unmatched data from Zoho CRM...');
    
    const result = await loadZohoData({ unmatchedOnly: true });
    
    // Handle rate limiting immediately
    if (result.rateLimitInfo?.isRateLimited) {
      setCountdown(result.rateLimitInfo.retryAfterSeconds);
      toast.error(`Zoho API rate limited. Please wait ${result.rateLimitInfo.retryAfterSeconds} seconds.`);
      setLoadingState(false, 'Rate limited');
      return;
    }
    
    if (result.data) {
      // Save to cache first
      const saved = await saveToCache(result.data.payments, result.data.expectations);
      if (saved) {
        await updateLastDownload();
        setZohoData(result.data.payments, result.data.expectations);
        toast.success(`Cached ${result.data.payments.length} payments and ${result.data.expectations.length} expectations`);
      } else {
        toast.error('Failed to cache data');
        setLoadingState(false, 'Cache error');
      }
    } else {
      setLoadingState(false, 'Failed to load Zoho data');
      toast.error('Failed to download data from Zoho CRM');
    }
  };
  
  // Load data from local cache
  const handleLoadFromCache = async () => {
    setLoadingState(true);
    toast.info('Loading from local cache...');
    
    const cached = await loadFromCache();
    if (cached && cached.payments.length > 0) {
      setZohoData(cached.payments, cached.expectations);
      toast.success(`Loaded ${cached.payments.length} payments from cache`);
    } else {
      toast.warning('No cached data found. Please download from Zoho.');
      setLoadingState(false);
    }
  };
  
  // Sync pending matches to Zoho using batch API (up to 100 per call)
  const handleSyncToZoho = async () => {
    const pending = await getPendingMatches();
    if (!pending || pending.length === 0) {
      toast.info('No pending matches to sync');
      return;
    }
    
    setIsSyncing(true);
    setSyncProgress({ done: 0, total: pending.length });
    toast.info(`Syncing ${pending.length} matches to Zoho in batches of 100...`);
    
    let totalSuccess = 0;
    let totalFailed = 0;
    const allSyncedIds: string[] = [];
    
    // Build batch records - pending matches already store Zoho IDs directly
    const batchItems = pending.map(match => {
      // The IDs in pending_matches ARE the Zoho record IDs (stored during cache download)
      const hasAllIds = match.paymentId && match.lineItemId && match.expectationId;
      
      return {
        match,
        resolved: hasAllIds ? {
          paymentZohoId: match.paymentId,
          lineItemZohoId: match.lineItemId,
          expectationZohoId: match.expectationId,
          matchedAmount: match.matchedAmount,
          variance: match.variance,
          variancePercentage: match.variancePercentage,
          matchType: 'full',
          matchMethod: 'manual',
          matchQuality: match.matchQuality || 'good',
          notes: match.notes || '',
        } : null,
      };
    });
    
    // Count unresolved
    const unresolved = batchItems.filter(b => !b.resolved);
    if (unresolved.length > 0) {
      console.warn(`[Sync] ${unresolved.length} matches have missing data, skipping`);
      totalFailed += unresolved.length;
    }
    
    const resolved = batchItems.filter(b => b.resolved);
    
    // Process in chunks of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < resolved.length; i += BATCH_SIZE) {
      const chunk = resolved.slice(i, i + BATCH_SIZE);
      
      try {
        const result = await syncMatchBatch(chunk.map(c => c.resolved!));
        
        totalSuccess += result.successCount;
        totalFailed += result.failedCount;
        
        // Mark successful matches for DB update
        result.results.forEach((r, idx) => {
          if (r.status === 'success') {
            allSyncedIds.push(chunk[idx].match.id);
          }
        });
        
        setSyncProgress({ done: totalSuccess + totalFailed + unresolved.length, total: pending.length });
        
      } catch (err: any) {
        if (err?.isRateLimit) {
          const retrySeconds = err.retryAfterSeconds || 60;
          setCountdown(retrySeconds);
          toast.error(`Zoho rate limited after ${totalSuccess} synced. Retry in ${retrySeconds}s.`, {
            description: `${pending.length - totalSuccess - totalFailed} matches remaining`,
          });
          break;
        }
        // Whole batch failed
        totalFailed += chunk.length;
        console.error('[Sync] Batch failed:', err);
      }
      
      // Small delay between batches (2s is plenty when doing 100 per call)
      if (i + BATCH_SIZE < resolved.length) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    // Mark synced matches in DB
    if (allSyncedIds.length > 0) {
      await markMatchesSynced(allSyncedIds);
      await updateLastSync();
      await refreshSyncStatus();
      
      // Post-sync: update Bank_Payment_Lines and Expectations statuses in Zoho
      // Collect the synced matches to build update payloads
      const syncedMatches = resolved
        .filter(b => allSyncedIds.includes(b.match.id))
        .map(b => b.resolved!);
      
      if (syncedMatches.length > 0) {
        toast.info('Updating line item and expectation statuses in Zoho...');
        
        try {
          // Update Bank_Payment_Lines: set status to 'matched' and link the expectation
          const lineItemUpdates = syncedMatches.map(m => ({
            id: m.lineItemZohoId,
            Status: 'matched',
            Matched_Expectation: { id: m.expectationZohoId },
          }));
          
          const lineResult = await updateRecordsBatch('Bank_Payment_Lines', lineItemUpdates);
          console.log(`[Sync] Line items updated: ${lineResult.successCount} success, ${lineResult.failedCount} failed`);
          
          // Small delay between module updates
          await new Promise(r => setTimeout(r, 2000));
          
          // Update Expectations: set status to 'matched' and allocated amount
          // De-duplicate by expectation ID (multiple line items may match same expectation)
          const expectationMap = new Map<string, { id: string; allocatedAmount: number }>();
          for (const m of syncedMatches) {
            const existing = expectationMap.get(m.expectationZohoId);
            expectationMap.set(m.expectationZohoId, {
              id: m.expectationZohoId,
              allocatedAmount: (existing?.allocatedAmount || 0) + m.matchedAmount,
            });
          }
          
          const expectationUpdates = Array.from(expectationMap.values()).map(e => ({
            id: e.id,
            Status: 'matched',
            Allocated_Amount: e.allocatedAmount,
            Remaining_Amount: 0,
          }));
          
          const expResult = await updateRecordsBatch('Expectations', expectationUpdates);
          console.log(`[Sync] Expectations updated: ${expResult.successCount} success, ${expResult.failedCount} failed`);
          
          if (lineResult.failedCount > 0 || expResult.failedCount > 0) {
            toast.warning(`Status updates: ${lineResult.failedCount} line items and ${expResult.failedCount} expectations failed to update`);
          } else {
            toast.success('Line items and expectations updated in Zoho');
          }
        } catch (statusErr: any) {
          if (statusErr?.isRateLimit) {
            toast.warning('Rate limited while updating statuses — matches were created but statuses need manual update');
          } else {
            console.error('[Sync] Status update error:', statusErr);
            toast.warning('Match records created but status updates failed — you may need to update statuses manually');
          }
        }
      }
    }
    
    // Update pending count
    const remainingPending = await getPendingMatches();
    setPendingCount(remainingPending?.length || 0);
    
    setIsSyncing(false);
    setSyncProgress(null);
    
    if (totalFailed === 0) {
      toast.success(`Synced ${totalSuccess} matches to Zoho`);
    } else {
      toast.warning(`Synced ${totalSuccess} matches, ${totalFailed} failed`);
    }
  };
  
  const isLoading = isLoadingData || isZohoLoading || isCacheLoading;
  const hasData = payments.length > 0;
  const hasPendingMatches = pendingCount > 0;
  
  return (
    <header className="h-auto min-h-[100px] bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between gap-6">
        {/* Left: Title and Period */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Payment Reconciliation
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <Calendar className="h-3.5 w-3.5" />
              December 2024
              {syncStatus?.lastDownloadAt && (
                <span className="ml-2 text-xs">
                  • Last sync: {new Date(syncStatus.lastDownloadAt).toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
        </div>
        
        {/* Center: Statistics Cards */}
        <div className="flex items-center gap-3">
          <StatCard 
            label="Total Payments"
            value={statistics.totalPayments.toString()}
            subValue={formatCurrency(statistics.totalPaymentAmount)}
            variant="default"
          />
          <StatCard 
            label="Reconciled"
            value={statistics.reconciledPayments.toString()}
            subValue={formatCurrency(statistics.totalReconciledAmount)}
            variant="success"
          />
          <StatCard 
            label="In Progress"
            value={statistics.inProgressPayments.toString()}
            variant="warning"
          />
          <StatCard 
            label="Unreconciled"
            value={statistics.unreconciledPayments.toString()}
            variant="danger"
          />
        </div>
        
        {/* Right: Data Sync Controls */}
        <div className="flex items-center gap-3">
          {/* Cache Status */}
          {hasData && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-md px-2 py-1">
              <Database className="h-3.5 w-3.5" />
              <span>Cached</span>
              {hasPendingMatches && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {pendingCount} pending
                </Badge>
              )}
            </div>
          )}
          
          {/* Load from Cache */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadFromCache}
            disabled={isLoading}
            className="gap-2"
            title="Load from local cache"
          >
            <Database className="h-4 w-4" />
            Cache
          </Button>
          
          {/* Download from Zoho */}
          <Button
            variant={countdown ? "destructive" : "outline"}
            size="sm"
            onClick={handleDownloadData}
            disabled={isLoading || (countdown !== null && countdown > 0) || hasPendingMatches}
            className="gap-2"
            title={hasPendingMatches ? 'Sync pending matches first' : 'Download unmatched data from Zoho'}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : countdown ? (
              <Clock className="h-4 w-4" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <Cloud className="h-4 w-4" />
            {countdown ? `Retry in ${countdown}s` : 'Download'}
          </Button>
          
          {/* Sync to Zoho */}
          <Button
            variant={hasPendingMatches ? "default" : "outline"}
            size="sm"
            onClick={handleSyncToZoho}
            disabled={isSyncing || !hasPendingMatches}
            className="gap-2"
            title="Sync matches to Zoho"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : hasPendingMatches ? (
              <Upload className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {isSyncing && syncProgress
              ? `${syncProgress.done}/${syncProgress.total}`
              : 'Sync'}
            {!isSyncing && hasPendingMatches && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {pendingCount}
              </Badge>
            )}
          </Button>
          
          {/* Overall Progress */}
          <div className="w-36">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Progress</span>
              <span className="text-xs font-semibold text-foreground">
                {progressPercentage.toFixed(0)}%
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
          
          {/* Tolerance Setting */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                {tolerance}%
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Match Tolerance</label>
                    <span className="text-sm text-muted-foreground">{tolerance}%</span>
                  </div>
                  <Slider
                    value={[tolerance]}
                    onValueChange={([value]) => setTolerance(value)}
                    min={0}
                    max={10}
                    step={0.5}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Allow matches within ±{tolerance}% variance
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Action Buttons */}
          <DataImport />
          
          <Button 
            onClick={autoMatchCurrentPayment}
            disabled={!selectedPaymentId}
            size="sm"
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Auto Match
          </Button>
          
          {/* User Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-medium text-primary">JS</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  variant: 'default' | 'success' | 'warning' | 'danger';
}

function StatCard({ label, value, subValue, variant }: StatCardProps) {
  const variantStyles = {
    default: 'bg-secondary/50 border-secondary',
    success: 'bg-success-light border-success/30',
    warning: 'bg-warning-light border-warning/30',
    danger: 'bg-danger-light border-danger/30'
  };
  
  const valueStyles = {
    default: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger'
  };
  
  return (
    <div className={`px-4 py-2 rounded-lg border ${variantStyles[variant]}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${valueStyles[variant]}`}>{value}</p>
      {subValue && (
        <p className="text-xs text-muted-foreground tabular-nums">{subValue}</p>
      )}
    </div>
  );
}
