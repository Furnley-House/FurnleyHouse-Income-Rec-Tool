import { useState } from 'react';
import { useReconciliationStore } from '@/store/reconciliationStore';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Building2, 
  CheckCircle2,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function PaymentSummary() {
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeNotes, setCompleteNotes] = useState('');
  
  const { 
    getSelectedPayment, 
    autoMatchCurrentPayment,
    markPaymentFullyReconciled 
  } = useReconciliationStore();
  
  const payment = getSelectedPayment();
  
  if (!payment) return null;
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };
  
  const progressPercentage = payment.amount > 0 
    ? (payment.reconciledAmount / payment.amount) * 100 
    : 0;
  
  const unmatchedLineItems = payment.lineItems.filter(li => li.status === 'unmatched');
  const hasUnmatchedItems = unmatchedLineItems.length > 0;
  
  const getStatusBadge = () => {
    switch (payment.status) {
      case 'reconciled':
        return <Badge className="bg-success text-success-foreground text-xs">Reconciled</Badge>;
      case 'in_progress':
        return <Badge className="bg-warning text-warning-foreground text-xs">In Progress</Badge>;
      default:
        return <Badge variant="destructive" className="text-xs">Unreconciled</Badge>;
    }
  };
  
  const handleCompleteClick = () => {
    if (hasUnmatchedItems) {
      setCompleteNotes('');
      setCompleteDialogOpen(true);
    } else {
      markPaymentFullyReconciled('');
    }
  };
  
  const handleConfirmComplete = () => {
    markPaymentFullyReconciled(completeNotes);
    setCompleteDialogOpen(false);
    setCompleteNotes('');
  };
  
  return (
    <>
      <div className="bg-card border-b border-border animate-fade-in">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Provider & Amount */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground">{payment.providerName}</span>
                <span className="text-muted-foreground text-sm">•</span>
                <span className="text-sm text-muted-foreground">{payment.paymentReference}</span>
              </div>
              <span className="text-xl font-bold text-foreground tabular-nums">
                {formatCurrency(payment.amount)}
              </span>
              {getStatusBadge()}
            </div>
            
            {/* Center: Progress */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Reconciled:</span>
                <span className="font-semibold text-success tabular-nums">{formatCurrency(payment.reconciledAmount)}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-muted-foreground tabular-nums">{formatCurrency(payment.remainingAmount)} left</span>
              </div>
              <Progress value={progressPercentage} className="h-2 w-24" />
              <span className="text-xs font-medium text-muted-foreground">{progressPercentage.toFixed(0)}%</span>
            </div>
            
            {/* Right: Actions */}
            <div className="flex items-center gap-1">
              <Button 
                onClick={autoMatchCurrentPayment}
                variant="outline"
                size="sm"
                className="gap-1 h-7 text-xs"
                disabled={payment.status === 'reconciled'}
              >
                <Sparkles className="h-3 w-3" />
                Auto Match
              </Button>
              
              <Button
                onClick={handleCompleteClick}
                variant="outline"
                size="sm"
                className="gap-1 h-7 text-xs"
                disabled={payment.status === 'reconciled'}
              >
                <CheckCircle2 className="h-3 w-3" />
                Complete
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Complete with unmatched items dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Complete with Unmatched Items
            </DialogTitle>
            <DialogDescription>
              This payment has {unmatchedLineItems.length} unmatched line item{unmatchedLineItems.length !== 1 ? 's' : ''} 
              that will be marked as "Approved Unmatched".
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-warning/10 rounded-lg p-3 border border-warning/30">
              <p className="text-sm font-medium text-warning mb-2">Unmatched Items:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {unmatchedLineItems.map(li => (
                  <div key={li.id} className="flex items-center justify-between text-xs">
                    <span className="text-foreground truncate">{li.clientName}</span>
                    <span className="font-medium tabular-nums">{formatCurrency(li.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground mb-2">Approval Notes (required)</p>
              <Textarea
                placeholder="Please explain why these items are being approved without matching..."
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmComplete}
              disabled={!completeNotes.trim()}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve & Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
