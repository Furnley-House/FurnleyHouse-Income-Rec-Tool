import { useReconciliationStore } from '@/store/reconciliationStore';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { 
  Search, 
  CheckCircle2,
  Circle,
  FileText,
  MousePointerClick
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatementItemList() {
  const [searchTerm, setSearchTerm] = useState('');
  const { 
    getSelectedPayment, 
    matches, 
    selectedLineItemId, 
    selectLineItem,
    expectations 
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
    return paymentMatches.find(m => {
      return m.expectationIds.some(expId => {
        const exp = expectations.find(e => e.id === expId);
        return exp?.planReference === planRef;
      });
    });
  };
  
  const matchedCount = filteredItems.filter(item => getMatchedExpectationForLineItem(item.planReference)).length;
  const unmatchedCount = filteredItems.length - matchedCount;
  
  const handleLineItemClick = (itemId: string, isMatched: boolean) => {
    if (isMatched) return; // Can't select already matched items
    
    if (selectedLineItemId === itemId) {
      selectLineItem(null); // Deselect if clicking same item
    } else {
      selectLineItem(itemId);
    }
  };
  
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
      
      {/* Hint for manual matching */}
      {unmatchedCount > 0 && !selectedLineItemId && (
        <div className="px-3 py-1.5 bg-muted/50 border-b border-border flex items-center gap-2 text-xs text-muted-foreground">
          <MousePointerClick className="h-3 w-3" />
          <span>Click an unmatched item to manually allocate to an expectation</span>
        </div>
      )}
      
      {/* Selected Line Item Info */}
      {selectedLineItemId && (
        <div className="px-3 py-2 bg-primary/10 border-b border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium text-primary">Line item selected - choose an expectation to match</span>
            </div>
            <button 
              onClick={() => selectLineItem(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Compact List */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="divide-y divide-border/50">
          {filteredItems.map((item) => {
            const matchInfo = getMatchedExpectationForLineItem(item.planReference);
            const isMatched = !!matchInfo;
            const isSelected = selectedLineItemId === item.id;
            
            return (
              <div
                key={item.id}
                onClick={() => handleLineItemClick(item.id, isMatched)}
                className={cn(
                  "px-3 py-1.5 flex items-center gap-2 text-sm transition-colors",
                  isMatched 
                    ? "bg-success/5 cursor-default" 
                    : "bg-background hover:bg-muted/50 cursor-pointer",
                  isSelected && "bg-primary/10 ring-1 ring-primary/30"
                )}
              >
                {/* Status Icon */}
                {isMatched ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                ) : (
                  <Circle className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-colors",
                    isSelected ? "text-primary fill-primary/20" : "text-muted-foreground/40"
                  )} />
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
                
                {isMatched ? (
                  <Badge variant="outline" className="text-xs h-4 bg-success/10 text-success border-success/30 shrink-0">
                    Allocated
                  </Badge>
                ) : isSelected ? (
                  <Badge variant="outline" className="text-xs h-4 bg-primary/10 text-primary border-primary/30 shrink-0">
                    Selected
                  </Badge>
                ) : null}
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
