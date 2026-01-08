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
      {/* Compact Header */}
      <div className="px-3 py-2 border-b border-border bg-primary/5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground text-sm">Statement Items</span>
            <Badge variant="outline" className="bg-muted text-xs h-5">
              {unmatchedCount} unmatched
            </Badge>
            <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs h-5">
              {matchedCount} matched
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 h-6 text-xs w-32"
            />
          </div>
        </div>
      </div>
      
      {/* Compact List */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="divide-y divide-border/50">
          {filteredItems.map((item) => {
            const matchInfo = getMatchedExpectationForLineItem(item.planReference);
            const isMatched = !!matchInfo;
            
            return (
              <div
                key={item.id}
                className={cn(
                  "px-3 py-1.5 flex items-center gap-2 text-sm",
                  isMatched ? "bg-success/5" : "bg-background hover:bg-muted/30"
                )}
              >
                {/* Status Icon */}
                {isMatched ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                )}
                
                {/* Client Name */}
                <span className="font-medium text-foreground truncate w-40" title={item.clientName}>
                  {item.clientName}
                </span>
                
                {/* Plan Reference */}
                <span className="text-xs text-muted-foreground truncate w-28" title={item.planReference}>
                  {item.planReference}
                </span>
                
                {/* Description */}
                <span className="text-xs text-muted-foreground/70 truncate flex-1" title={item.description}>
                  {item.description}
                </span>
                
                {/* Amount */}
                <span className="font-semibold tabular-nums text-right w-20 shrink-0">
                  {formatCurrency(item.amount)}
                </span>
                
                {isMatched && (
                  <Badge variant="outline" className="text-xs h-4 bg-success/10 text-success border-success/30 shrink-0">
                    Allocated
                  </Badge>
                )}
              </div>
            );
          })}
          
          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No items found</p>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Compact Footer */}
      <div className="px-3 py-1.5 border-t border-border bg-muted/30 flex items-center justify-between text-sm">
        <span className="text-muted-foreground text-xs">Total</span>
        <span className="font-bold tabular-nums">{formatCurrency(payment.amount)}</span>
      </div>
    </div>
  );
}
