import { useReconciliationStore } from '@/store/reconciliationStore';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { 
  Search, 
  CheckCircle2,
  Circle,
  User,
  FileText,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatementItemList() {
  const [searchTerm, setSearchTerm] = useState('');
  const { getSelectedPayment, matches } = useReconciliationStore();
  
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
  
  // Filter line items
  const filteredItems = payment.lineItems.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return item.clientName.toLowerCase().includes(term) ||
           item.planReference.toLowerCase().includes(term);
  });
  
  // Check if a line item is matched to an expectation
  const getMatchedExpectationForLineItem = (planRef: string) => {
    const paymentMatches = matches.filter(m => m.paymentId === payment.id);
    // A line item is considered matched if there's a match with an expectation having the same planReference
    const expectations = useReconciliationStore.getState().expectations;
    return paymentMatches.find(m => {
      return m.expectationIds.some(expId => {
        const exp = expectations.find(e => e.id === expId);
        return exp?.planReference === planRef;
      });
    });
  };
  
  const matchedCount = filteredItems.filter(item => getMatchedExpectationForLineItem(item.planReference)).length;
  const unmatchedCount = filteredItems.length - matchedCount;
  
  return (
    <div className="h-full flex flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border bg-primary/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Statement Items</h3>
              <p className="text-xs text-muted-foreground">From provider payment</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="bg-muted">
            {unmatchedCount} unmatched
          </Badge>
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            {matchedCount} matched
          </Badge>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search statement..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
      </div>
      
      {/* List */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="divide-y divide-border">
          {filteredItems.map((item) => {
            const matchInfo = getMatchedExpectationForLineItem(item.planReference);
            const isMatched = !!matchInfo;
            
            return (
              <div
                key={item.id}
                className={cn(
                  "px-4 py-3 transition-all duration-150",
                  isMatched ? "bg-success/5" : "bg-background hover:bg-muted/30"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Status Icon */}
                  <div className="shrink-0 mt-0.5">
                    {isMatched ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/50" />
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground text-sm truncate">
                        {item.clientName}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.planReference}
                    </p>
                    <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                      {item.description}
                    </p>
                  </div>
                  
                  {/* Amount */}
                  <div className="text-right shrink-0">
                    <span className="font-semibold text-sm tabular-nums">
                      {formatCurrency(item.amount)}
                    </span>
                    {isMatched && (
                      <div className="flex items-center justify-end gap-1 text-xs text-success mt-0.5">
                        <ArrowRight className="h-3 w-3" />
                        <span>Allocated</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          
          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Circle className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm">No items found</p>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Footer Summary */}
      <div className="p-3 border-t border-border bg-muted/30">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Statement Total</span>
          <span className="font-bold tabular-nums">{formatCurrency(payment.amount)}</span>
        </div>
      </div>
    </div>
  );
}
