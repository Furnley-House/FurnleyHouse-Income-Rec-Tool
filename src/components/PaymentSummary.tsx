import { useState } from 'react';
import { useReconciliationStore } from '@/store/reconciliationStore';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Building2, 
  Calendar, 
  Hash,
  CheckCircle2,
  FileText,
  Sparkles,
  StickyNote,
  ChevronDown,
  ChevronUp,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function PaymentSummary() {
  const [isLineItemsExpanded, setIsLineItemsExpanded] = useState(false);
  
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
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };
  
  const progressPercentage = payment.amount > 0 
    ? (payment.reconciledAmount / payment.amount) * 100 
    : 0;
  
  const getStatusBadge = () => {
    switch (payment.status) {
      case 'reconciled':
        return <Badge className="bg-success text-success-foreground">Reconciled</Badge>;
      case 'in_progress':
        return <Badge className="bg-warning text-warning-foreground">In Progress</Badge>;
      default:
        return <Badge variant="destructive">Unreconciled</Badge>;
    }
  };
  
  return (
    <div className="bg-card border-b border-border animate-fade-in">
      <div className="p-6">
        <div className="flex items-start justify-between gap-6">
          {/* Left: Payment Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{payment.providerName}</h2>
                <p className="text-sm text-muted-foreground">{payment.paymentReference}</p>
              </div>
              {getStatusBadge()}
            </div>
            
            {/* Amount */}
            <div className="mb-4">
              <p className="text-4xl font-bold text-foreground tabular-nums">
                {formatCurrency(payment.amount)}
              </p>
            </div>
            
            {/* Meta info */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formatDate(payment.paymentDate)}
              </div>
              <div className="flex items-center gap-1.5">
                <Hash className="h-4 w-4" />
                {payment.bankReference}
              </div>
              <div className="flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                {payment.statementItemCount} items in statement
              </div>
            </div>
          </div>
          
          {/* Center: Progress */}
          <div className="w-64 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Reconciliation Progress</span>
              <span className="font-semibold text-foreground">{progressPercentage.toFixed(0)}%</span>
            </div>
            
            <Progress value={progressPercentage} className="h-3" />
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Reconciled</p>
                <p className="font-semibold text-success tabular-nums">
                  {formatCurrency(payment.reconciledAmount)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Remaining</p>
                <p className="font-semibold text-foreground tabular-nums">
                  {formatCurrency(payment.remainingAmount)}
                </p>
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground">
              {payment.matchedExpectationIds.length} expectations matched
            </div>
          </div>
          
          {/* Right: Actions */}
          <div className="flex flex-col gap-2">
            <Button 
              onClick={autoMatchCurrentPayment}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Auto Match
            </Button>
            
            <Button
              onClick={() => markPaymentReconciled(payment.id)}
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={payment.status === 'reconciled'}
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark Complete
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <StickyNote className="h-4 w-4" />
              Add Note
            </Button>
          </div>
        </div>
      </div>
      
      {/* Expandable Line Items Section */}
      <Collapsible open={isLineItemsExpanded} onOpenChange={setIsLineItemsExpanded}>
        <CollapsibleTrigger asChild>
          <button className="w-full px-6 py-3 border-t border-border flex items-center justify-between text-sm hover:bg-muted/50 transition-colors">
            <span className="font-medium text-muted-foreground">
              Payment Statement Details ({payment.lineItems.length} items)
            </span>
            {isLineItemsExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border bg-muted/30">
            <ScrollArea className="max-h-64">
              <div className="p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="pb-2 font-medium">Client</th>
                      <th className="pb-2 font-medium">Plan Reference</th>
                      <th className="pb-2 font-medium">Description</th>
                      <th className="pb-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payment.lineItems.map((item, idx) => (
                      <tr 
                        key={item.id} 
                        className={cn(
                          "border-b border-border/50 last:border-0",
                          idx % 2 === 0 ? "bg-transparent" : "bg-muted/20"
                        )}
                      >
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate max-w-[200px]">{item.clientName}</span>
                          </div>
                        </td>
                        <td className="py-2 text-muted-foreground">{item.planReference}</td>
                        <td className="py-2 text-muted-foreground">{item.description}</td>
                        <td className="py-2 text-right font-medium tabular-nums">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border">
                      <td colSpan={3} className="py-2 font-semibold">Total</td>
                      <td className="py-2 text-right font-bold tabular-nums">
                        {formatCurrency(payment.amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </ScrollArea>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}