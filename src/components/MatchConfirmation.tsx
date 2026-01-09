import { useState } from 'react';
import { useReconciliationStore } from '@/store/reconciliationStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  X,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Equal
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
  const [notes, setNotes] = useState('');
  
  const { 
    pendingMatchExpectationIds,
    expectations,
    getPendingMatchTotal,
    getVariance,
    getSelectedPayment,
    clearPendingSelections,
    confirmMatch,
    tolerance
  } = useReconciliationStore();
  
  const payment = getSelectedPayment();
  const selectedTotal = getPendingMatchTotal();
  const variance = getVariance();
  
  const selectedExpectations = expectations.filter(e => 
    pendingMatchExpectationIds.includes(e.id)
  );
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };
  
  const getVarianceIcon = () => {
    if (Math.abs(variance.percentage) < 0.1) {
      return <Equal className="h-4 w-4" />;
    }
    return variance.amount > 0 
      ? <TrendingUp className="h-4 w-4" />
      : <TrendingDown className="h-4 w-4" />;
  };
  
  const getVarianceColor = () => {
    switch (variance.quality) {
      case 'perfect':
        return 'text-success bg-success-light border-success/30';
      case 'good':
        return 'text-success bg-success-light border-success/30';
      case 'acceptable':
        return 'text-warning bg-warning-light border-warning/30';
      default:
        return 'text-danger bg-danger-light border-danger/30';
    }
  };
  
  const getQualityLabel = () => {
    switch (variance.quality) {
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
  
  const handleConfirm = () => {
    confirmMatch(notes);
    setNotes('');
    setIsDialogOpen(false);
  };
  
  const isWithinTolerance = Math.abs(variance.percentage) <= tolerance;
  
  return (
    <>
      {/* Bottom Bar */}
      <div className="bg-card border-t border-border p-4 animate-slide-in-right">
        <div className="flex items-center justify-between gap-6">
          {/* Left: Selection Summary */}
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-muted-foreground">
                {pendingMatchExpectationIds.length} expectation{pendingMatchExpectationIds.length !== 1 ? 's' : ''} selected
              </p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {formatCurrency(selectedTotal)}
              </p>
            </div>
            
            <div className="h-10 w-px bg-border" />
            
            <div>
              <p className="text-sm text-muted-foreground">Payment Target</p>
              <p className="text-lg font-semibold text-foreground tabular-nums">
                {formatCurrency(payment?.remainingAmount || payment?.amount || 0)}
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
                    {variance.amount >= 0 ? '+' : ''}{formatCurrency(variance.amount)}
                    <span className="text-xs ml-1">
                      ({variance.percentage >= 0 ? '+' : ''}{variance.percentage.toFixed(2)}%)
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={clearPendingSelections}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
            
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="gap-2"
              variant={isWithinTolerance ? "default" : "outline"}
            >
              {isWithinTolerance ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {isWithinTolerance ? 'Confirm Match' : 'Review Match'}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Confirmation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isWithinTolerance ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-warning" />
              )}
              Confirm Match
            </DialogTitle>
            <DialogDescription>
              Review the match details before confirming
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Payment Info */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Payment</p>
              <p className="font-semibold text-foreground">
                {payment?.providerName} • {payment?.paymentReference}
              </p>
              <p className="text-xl font-bold text-foreground tabular-nums">
                {formatCurrency(payment?.amount || 0)}
              </p>
            </div>
            
            {/* Selected Expectations */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Selected Expectations ({selectedExpectations.length})
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedExpectations.map(exp => (
                  <div key={exp.id} className="flex items-center justify-between bg-card rounded p-2 border">
                    <span className="text-sm text-foreground truncate">{exp.clientName}</span>
                    <span className="text-sm font-medium tabular-nums">{formatCurrency(exp.expectedAmount)}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">Selected Total</p>
                <p className="text-lg font-bold tabular-nums">{formatCurrency(selectedTotal)}</p>
              </div>
              <div className={cn("rounded-lg p-3 border", getVarianceColor())}>
                <p className="text-sm opacity-80">Variance</p>
                <p className="text-lg font-bold tabular-nums">
                  {variance.amount >= 0 ? '+' : ''}{formatCurrency(variance.amount)}
                  <span className="text-sm ml-1">({variance.percentage.toFixed(2)}%)</span>
                </p>
              </div>
            </div>
            
            {/* Warning if outside tolerance */}
            {!isWithinTolerance && (
              <div className="flex items-start gap-3 bg-warning-light rounded-lg p-3 border border-warning/30">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning text-sm">Outside Tolerance</p>
                  <p className="text-xs text-warning/80">
                    This match has a variance of {Math.abs(variance.percentage).toFixed(2)}%, which exceeds the {tolerance}% tolerance threshold.
                  </p>
                </div>
              </div>
            )}
            
            {/* Notes */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {isWithinTolerance ? 'Notes (optional)' : 'Approval Notes (required)'}
              </p>
              <Textarea
                placeholder={isWithinTolerance 
                  ? "Add any notes about this reconciliation..." 
                  : "Please provide justification for approving this out-of-tolerance match..."
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={cn("resize-none", !isWithinTolerance && !notes.trim() && "border-warning")}
                rows={2}
              />
              {!isWithinTolerance && !notes.trim() && (
                <p className="text-xs text-warning mt-1">Approval notes are required for out-of-tolerance matches</p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm} 
              className="gap-2"
              disabled={!isWithinTolerance && !notes.trim()}
            >
              <CheckCircle2 className="h-4 w-4" />
              {isWithinTolerance ? 'Confirm Match' : 'Approve Match'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
