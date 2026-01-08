import { useReconciliationStore } from '@/store/reconciliationStore';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  User,
  CheckCircle2,
  Circle,
  TrendingUp,
  TrendingDown,
  Target
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';

export function ExpectationGrid() {
  const { 
    getRelevantExpectations,
    pendingMatchExpectationIds,
    toggleExpectationSelection,
    expectationFilters,
    setExpectationFilters,
    getSelectedPayment
  } = useReconciliationStore();
  
  const payment = getSelectedPayment();
  const expectations = getRelevantExpectations();
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };
  
  const getFeeCategoryLabel = (category: string) => {
    return category === 'initial' ? 'Initial' : 'Ongoing';
  };
  
  const getFeeCategoryColor = (category: string) => {
    return category === 'initial' 
      ? 'bg-warning/10 text-warning border-warning/30' 
      : 'bg-primary/10 text-primary border-primary/30';
  };
  
  // Count by status
  const unmatchedCount = expectations.filter(e => e.status === 'unmatched').length;
  const matchedCount = expectations.filter(e => e.status === 'matched').length;
  
  return (
    <div className="h-full flex flex-col bg-card">
      {/* Compact Header */}
      <div className="px-3 py-2 border-b border-border bg-secondary/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-secondary-foreground" />
            <span className="font-semibold text-foreground text-sm">Expected Fees</span>
            <Badge variant="outline" className="bg-muted text-xs h-5">
              {unmatchedCount} unmatched
            </Badge>
            <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs h-5">
              {matchedCount} matched
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={expectationFilters.searchTerm}
                onChange={(e) => setExpectationFilters({ searchTerm: e.target.value })}
                className="pl-7 h-6 text-xs w-28"
              />
            </div>
            <Select
              value={expectationFilters.status}
              onValueChange={(value: 'all' | 'unmatched' | 'partial' | 'matched') => 
                setExpectationFilters({ status: value })
              }
            >
              <SelectTrigger className="w-24 h-6 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unmatched">Unmatched</SelectItem>
                <SelectItem value="matched">Matched</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Compact List */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="divide-y divide-border/50">
          {expectations.map((expectation) => {
            const isSelected = pendingMatchExpectationIds.includes(expectation.id);
            const isMatched = expectation.status === 'matched';
            const isMatchedToThisPayment = payment?.matchedExpectationIds.includes(expectation.id);
            
            return (
              <div
                key={expectation.id}
                className={cn(
                  "px-3 py-1.5 flex items-center gap-2 text-sm cursor-pointer",
                  isMatched && isMatchedToThisPayment && "bg-success/5",
                  isMatched && !isMatchedToThisPayment && "bg-muted/30 opacity-50",
                  !isMatched && isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/20",
                  !isMatched && !isSelected && "bg-background hover:bg-muted/30"
                )}
                onClick={() => {
                  if (!isMatched) {
                    toggleExpectationSelection(expectation.id);
                  }
                }}
              >
                {/* Checkbox/Status */}
                <div className="shrink-0">
                  {isMatched ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Checkbox 
                      checked={isSelected}
                      onCheckedChange={() => toggleExpectationSelection(expectation.id)}
                      className="h-3.5 w-3.5"
                    />
                  )}
                </div>
                
                {/* Client Name */}
                <span className="font-medium text-foreground truncate w-40" title={expectation.clientName}>
                  {expectation.clientName}
                </span>
                
                {/* Plan Reference */}
                <span className="text-xs text-muted-foreground truncate w-28" title={expectation.planReference}>
                  {expectation.planReference}
                </span>
                
                {/* Fee Category */}
                <Badge variant="outline" className={cn("text-xs h-4 shrink-0", getFeeCategoryColor(expectation.feeCategory))}>
                  {getFeeCategoryLabel(expectation.feeCategory)}
                </Badge>
                
                {/* Spacer */}
                <div className="flex-1" />
                
                {/* Amount */}
                <span className="font-semibold tabular-nums text-right w-20 shrink-0">
                  {formatCurrency(isMatchedToThisPayment ? expectation.allocatedAmount : expectation.expectedAmount)}
                </span>
                
                {isMatchedToThisPayment && (
                  <Badge variant="outline" className="text-xs h-4 bg-success/10 text-success border-success/30 shrink-0">
                    Matched
                  </Badge>
                )}
              </div>
            );
          })}
          
          {expectations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No expectations found</p>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Compact Footer */}
      <div className="px-3 py-1.5 border-t border-border bg-muted/30 flex items-center justify-between text-sm">
        <span className="text-muted-foreground text-xs">Total Expected</span>
        <span className="font-bold tabular-nums">
          {formatCurrency(expectations.reduce((sum, e) => sum + e.expectedAmount, 0))}
        </span>
      </div>
    </div>
  );
}