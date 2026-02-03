import { useState } from 'react';
import { useReconciliationStore } from '@/store/reconciliationStore';
import { useZohoSync } from '@/hooks/useZohoSync';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  X,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Equal,
  Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';

export function MatchConfirmation() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notes, setNotes] = useState('');
  
  const { 
    pendingMatches,
    expectations,
    getPendingMatchSummary,
    getSelectedPayment,
    clearPendingMatches,
    confirmPendingMatches,
    tolerance,
    dataSource
  } = useReconciliationStore();
  
  const { syncMatches, syncPaymentStatus } = useZohoSync();
  
  const payment = getSelectedPayment();
  const summary = getPendingMatchSummary();
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };
  
  const getVarianceIcon = () => {
    if (Math.abs(summary.variancePercentage) < 0.1) {
      return <Equal className="h-4 w-4" />;
    }
    return summary.variance > 0 
      ? <TrendingUp className="h-4 w-4" />
      : <TrendingDown className="h-4 w-4" />;
  };
  
  const getQuality = () => {
    const absVariance = Math.abs(summary.variancePercentage);
    if (absVariance < 0.1) return 'perfect';
    if (absVariance <= 2) return 'good';
    if (absVariance <= tolerance) return 'acceptable';
    return 'warning';
  };
  
  const quality = getQuality();
  
  const getVarianceColor = () => {
    switch (quality) {
      case 'perfect':
      case 'good':
        return 'text-success bg-success-light border-success/30';
      case 'acceptable':
        return 'text-warning bg-warning-light border-warning/30';
      default:
        return 'text-danger bg-danger-light border-danger/30';
    }
  };
  
  const getQualityLabel = () => {
    switch (quality) {
      case 'perfect':
        return 'Perfect Match';
      case 'good':
        return 'Good Match';
      case 'acceptable':
        return 'Acceptable';
      default:
        return 'Review Required';
    }
  };
  
  const handleConfirm = async () => {
    if (!payment) return;
    
    setIsSyncing(true);
    
    try {
      // First, confirm matches locally
      confirmPendingMatches(notes);
      
      // If using Zoho, sync to CRM
      if (dataSource === 'zoho') {
        // Build sync data for each pending match
        const matchSyncData = pendingMatches.map(pm => {
          const lineItem = payment.lineItems.find(li => li.id === pm.lineItemId);
          const expectation = expectations.find(e => e.id === pm.expectationId);
          
          // Determine match quality based on variance
          let matchQuality: 'perfect' | 'good' | 'acceptable' | 'warning' = 'warning';
          const absVariance = Math.abs(pm.variancePercentage);
          if (absVariance < 0.1) matchQuality = 'perfect';
          else if (absVariance <= 2) matchQuality = 'good';
          else if (absVariance <= tolerance) matchQuality = 'acceptable';
          
          return {
            paymentId: payment.id,
            paymentZohoId: payment.zohoId || payment.id,
            lineItemId: pm.lineItemId,
            lineItemZohoId: lineItem?.zohoId || pm.lineItemId,
            expectationId: pm.expectationId,
            expectationZohoId: expectation?.zohoId || pm.expectationId,
            matchedAmount: pm.lineItemAmount,
            variance: pm.variance,
            variancePercentage: pm.variancePercentage,
            matchType: 'full' as const,
            matchMethod: 'manual' as const,
            matchQuality,
            notes: notes,
          };
        });
        
        // Sync matches to Zoho
        await syncMatches(matchSyncData);
        
        // Update payment status in Zoho
        const newReconciledAmount = payment.reconciledAmount + summary.totalLineItemAmount;
        const newRemainingAmount = payment.amount - newReconciledAmount;
        const allMatched = payment.lineItems.every(li => 
          li.status === 'matched' || pendingMatches.some(pm => pm.lineItemId === li.id)
        );
        const newStatus = allMatched ? 'reconciled' : 'in_progress';
        
        await syncPaymentStatus(
          payment.zohoId || payment.id,
          newStatus,
          newReconciledAmount,
          newRemainingAmount,
          notes
        );
      }
    } finally {
      setIsSyncing(false);
    }
    
    setNotes('');
    setIsDialogOpen(false);
  };
  
  const allWithinTolerance = summary.allWithinTolerance;
  const hasOutOfTolerance = pendingMatches.some(pm => !pm.isWithinTolerance);
  
  // Get matched expectations for display
  const matchedExpectations = pendingMatches.map(pm => {
    const exp = expectations.find(e => e.id === pm.expectationId);
    return { ...pm, expectation: exp };
  });
  
  return (
    <>
      {/* Bottom Bar */}
      <div className="bg-card border-t border-border p-4 animate-slide-in-right">
        <div className="flex items-center justify-between gap-6">
          {/* Left: Selection Summary */}
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-muted-foreground">
                {pendingMatches.length} match{pendingMatches.length !== 1 ? 'es' : ''} pending
              </p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {formatCurrency(summary.totalLineItemAmount)}
              </p>
            </div>
            
            <div className="h-10 w-px bg-border" />
            
            <div>
              <p className="text-sm text-muted-foreground">Expected Total</p>
              <p className="text-lg font-semibold text-foreground tabular-nums">
                {formatCurrency(summary.totalExpectedAmount)}
              </p>
            </div>
            
            <div className="h-10 w-px bg-border" />
            
            {/* Variance */}
            <div className={cn("px-3 py-1.5 rounded-lg border", getVarianceColor())}>
              <div className="flex items-center gap-2">
                {getVarianceIcon()}
                <div>
                  <p className="text-xs opacity-80">{getQualityLabel()}</p>
                  <p className="font-semibold tabular-nums">
                    {summary.variance >= 0 ? '+' : ''}{formatCurrency(summary.variance)}
                    <span className="text-xs ml-1">
                      ({summary.variancePercentage >= 0 ? '+' : ''}{summary.variancePercentage.toFixed(2)}%)
                    </span>
                  </p>
                </div>
              </div>
            </div>
            
            {/* Out of tolerance warning */}
            {hasOutOfTolerance && (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {pendingMatches.filter(pm => !pm.isWithinTolerance).length} out of tolerance
              </Badge>
            )}
          </div>
          
          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={clearPendingMatches}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
            
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="gap-2"
              variant={allWithinTolerance ? "default" : "outline"}
            >
              {allWithinTolerance ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {allWithinTolerance ? 'Confirm Matches' : 'Review & Confirm'}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Confirmation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {allWithinTolerance ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-warning" />
              )}
              Confirm {pendingMatches.length} Match{pendingMatches.length !== 1 ? 'es' : ''}
            </DialogTitle>
            <DialogDescription>
              Review the pending matches before confirming
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Payment Info */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Payment</p>
              <p className="font-semibold text-foreground">
                {payment?.providerName} • {payment?.paymentReference}
              </p>
            </div>
            
            {/* Pending Matches */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Pending Matches ({matchedExpectations.length})
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {matchedExpectations.map(({ lineItemId, expectation, lineItemAmount, expectedAmount, variancePercentage, isWithinTolerance }) => (
                  <div key={lineItemId} className={cn(
                    "flex items-center justify-between bg-card rounded p-2 border",
                    !isWithinTolerance && "border-warning/50"
                  )}>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground truncate block">{expectation?.clientName}</span>
                      <span className="text-xs text-muted-foreground">{expectation?.planReference}</span>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="text-sm font-medium tabular-nums block">{formatCurrency(lineItemAmount)}</span>
                      <span className={cn(
                        "text-xs tabular-nums",
                        isWithinTolerance ? "text-success" : "text-warning"
                      )}>
                        {variancePercentage >= 0 ? '+' : ''}{variancePercentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">Total Allocated</p>
                <p className="text-lg font-bold tabular-nums">{formatCurrency(summary.totalLineItemAmount)}</p>
              </div>
              <div className={cn("rounded-lg p-3 border", getVarianceColor())}>
                <p className="text-sm opacity-80">Overall Variance</p>
                <p className="text-lg font-bold tabular-nums">
                  {summary.variance >= 0 ? '+' : ''}{formatCurrency(summary.variance)}
                  <span className="text-sm ml-1">({summary.variancePercentage.toFixed(2)}%)</span>
                </p>
              </div>
            </div>
            
            {/* Warning if any outside tolerance */}
            {hasOutOfTolerance && (
              <div className="flex items-start gap-3 bg-warning-light rounded-lg p-3 border border-warning/30">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning text-sm">Some matches outside tolerance</p>
                  <p className="text-xs text-warning/80">
                    {pendingMatches.filter(pm => !pm.isWithinTolerance).length} match(es) exceed the {tolerance}% tolerance threshold.
                  </p>
                </div>
              </div>
            )}
            
            {/* Notes */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {hasOutOfTolerance ? 'Approval Notes (required for out-of-tolerance)' : 'Notes (optional)'}
              </p>
              <Textarea
                placeholder={hasOutOfTolerance 
                  ? "Please provide justification for approving these matches..." 
                  : "Add any notes about this reconciliation..."
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={cn("resize-none", hasOutOfTolerance && !notes.trim() && "border-warning")}
                rows={2}
              />
              {hasOutOfTolerance && !notes.trim() && (
                <p className="text-xs text-warning mt-1">Notes are required when approving out-of-tolerance matches</p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isSyncing}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm} 
              className="gap-2"
              disabled={(hasOutOfTolerance && !notes.trim()) || isSyncing}
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing to Zoho...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {allWithinTolerance ? 'Confirm Matches' : 'Approve & Confirm'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
