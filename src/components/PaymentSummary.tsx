import { useReconciliationStore } from '@/store/reconciliationStore';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export function PaymentSummary() {
  const { 
    getSelectedPayment, 
    autoMatchCurrentPayment,
    markPaymentReconciled 
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
  
  return (
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
            >
              <Sparkles className="h-3 w-3" />
              Auto Match
            </Button>
            
            <Button
              onClick={() => markPaymentReconciled(payment.id)}
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
  );
}