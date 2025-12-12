import { useReconciliationStore } from '@/store/reconciliationStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Building2,
  Calendar,
  FileText,
  ChevronRight,
  Filter
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';

export function PaymentList() {
  const { 
    payments, 
    selectedPaymentId, 
    selectPayment,
    paymentFilters,
    setPaymentFilters 
  } = useReconciliationStore();
  
  // Filter payments
  const filteredPayments = payments.filter(payment => {
    if (paymentFilters.searchTerm) {
      const term = paymentFilters.searchTerm.toLowerCase();
      if (!payment.providerName.toLowerCase().includes(term) &&
          !payment.paymentReference.toLowerCase().includes(term)) {
        return false;
      }
    }
    if (paymentFilters.status !== 'all' && payment.status !== paymentFilters.status) {
      return false;
    }
    if (paymentFilters.provider && payment.providerName !== paymentFilters.provider) {
      return false;
    }
    return true;
  });
  
  // Get unique providers for filter
  const providers = [...new Set(payments.map(p => p.providerName))].sort();
  
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
      month: 'short',
      year: 'numeric'
    });
  };
  
  const getStatusBadge = (status: string, matchedCount: number, totalCount: number) => {
    switch (status) {
      case 'reconciled':
        return <Badge className="bg-success text-success-foreground text-xs">Reconciled</Badge>;
      case 'in_progress':
        return <Badge className="bg-warning text-warning-foreground text-xs">{matchedCount}/{totalCount} matched</Badge>;
      default:
        return <Badge variant="destructive" className="text-xs">Unreconciled</Badge>;
    }
  };
  
  const getBorderColor = (status: string) => {
    switch (status) {
      case 'reconciled':
        return 'border-l-success';
      case 'in_progress':
        return 'border-l-warning';
      default:
        return 'border-l-danger';
    }
  };
  
  return (
    <div className="w-full h-full flex flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Payments</h2>
          <span className="text-xs text-muted-foreground">
            {filteredPayments.length} of {payments.length}
          </span>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search payments..."
            value={paymentFilters.searchTerm}
            onChange={(e) => setPaymentFilters({ searchTerm: e.target.value })}
            className="pl-9 h-9"
          />
        </div>
        
        {/* Filters */}
        <div className="flex gap-2">
          <Select
            value={paymentFilters.status}
            onValueChange={(value: 'all' | 'unreconciled' | 'in_progress' | 'reconciled') => 
              setPaymentFilters({ status: value })
            }
          >
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="unreconciled">Unreconciled</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="reconciled">Reconciled</SelectItem>
            </SelectContent>
          </Select>
          
          <Select
            value={paymentFilters.provider || 'all'}
            onValueChange={(value) => 
              setPaymentFilters({ provider: value === 'all' ? null : value })
            }
          >
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Providers</SelectItem>
              {providers.map(provider => (
                <SelectItem key={provider} value={provider}>{provider}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Payment Cards */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="p-2 space-y-2">
          {filteredPayments.map((payment) => {
            const isSelected = payment.id === selectedPaymentId;
            const matchedCount = payment.matchedExpectationIds.length;
            
            return (
              <button
                key={payment.id}
                onClick={() => selectPayment(payment.id)}
                className={cn(
                  "w-full text-left p-4 rounded-lg border-l-4 transition-all duration-200",
                  "bg-card hover:bg-card-hover border border-border",
                  getBorderColor(payment.status),
                  isSelected && "ring-2 ring-primary shadow-md bg-primary/5"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Provider Name */}
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-semibold text-foreground truncate">
                        {payment.providerName}
                      </span>
                    </div>
                    
                    {/* Amount */}
                    <p className="text-2xl font-bold text-foreground tabular-nums mb-2">
                      {formatCurrency(payment.amount)}
                    </p>
                    
                    {/* Details */}
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(payment.paymentDate)}
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {payment.paymentReference}
                      </div>
                      <div className="text-muted-foreground">
                        Contains {payment.statementItemCount} plans
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(payment.status, matchedCount, payment.statementItemCount)}
                    {isSelected && (
                      <ChevronRight className="h-5 w-5 text-primary mt-2" />
                    )}
                  </div>
                </div>
                
                {/* Progress bar for in-progress payments */}
                {payment.status === 'in_progress' && (
                  <div className="mt-3">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-warning transition-all duration-300"
                        style={{ width: `${(payment.reconciledAmount / payment.amount) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(payment.reconciledAmount)} reconciled
                    </p>
                  </div>
                )}
              </button>
            );
          })}
          
          {filteredPayments.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No payments found</p>
              <p className="text-xs mt-1">Try adjusting your filters</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
