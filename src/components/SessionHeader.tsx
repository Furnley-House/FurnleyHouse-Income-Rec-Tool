import { useState, useEffect } from 'react';
import { useReconciliationStore } from '@/store/reconciliationStore';
import { useZohoData } from '@/hooks/useZohoData';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, 
  Calendar,
  Wallet,
  Settings,
  Cloud,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Clock
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
    payments
  } = useReconciliationStore();
  
  const { loadZohoData, isLoading: isZohoLoading, isRateLimited, retryAfterSeconds } = useZohoData();
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Countdown timer for rate limit
  useEffect(() => {
    if (isRateLimited && retryAfterSeconds) {
      setCountdown(retryAfterSeconds);
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
  }, [isRateLimited, retryAfterSeconds]);
  
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
  
  const handleRefreshData = async () => {
    if (countdown && countdown > 0) {
      toast.warning(`Please wait ${countdown} seconds before retrying`);
      return;
    }
    
    setLoadingState(true);
    toast.info('Loading data from Zoho CRM...');
    const data = await loadZohoData();
    if (data) {
      setZohoData(data.payments, data.expectations);
      toast.success(`Loaded ${data.payments.length} payments and ${data.expectations.length} expectations from Zoho`);
    } else {
      setLoadingState(false, 'Failed to load Zoho data');
      // Don't show generic error toast if rate limited - the button will show the countdown
    }
  };
  
  const isLoading = isLoadingData || isZohoLoading;
  const hasData = payments.length > 0;
  
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
        
        {/* Right: Progress and Actions */}
        <div className="flex items-center gap-4">
          {/* Zoho Data Status & Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshData}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <Cloud className="h-4 w-4 text-primary" />
            {hasData ? 'Refresh' : 'Load Data'}
          </Button>
          
          {/* Overall Progress */}
          <div className="w-48">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Overall Progress</span>
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
                Tolerance: {tolerance}%
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
