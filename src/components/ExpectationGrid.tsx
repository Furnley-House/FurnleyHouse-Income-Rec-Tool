import { useReconciliationStore } from '@/store/reconciliationStore';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  User,
  FileText,
  CheckCircle2,
  Circle,
  GripVertical,
  ArrowRight,
  TrendingUp,
  TrendingDown
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
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card/50 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Expectations</h3>
            <p className="text-sm text-muted-foreground">
              {payment?.providerName} • {expectations.length} items
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="bg-muted">
              {unmatchedCount} unmatched
            </Badge>
            <Badge variant="outline" className="bg-success-light text-success border-success/30">
              {matchedCount} matched
            </Badge>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by client or plan..."
              value={expectationFilters.searchTerm}
              onChange={(e) => setExpectationFilters({ searchTerm: e.target.value })}
              className="pl-9 h-9"
            />
          </div>
          
          <Select
            value={expectationFilters.status}
            onValueChange={(value: 'all' | 'unmatched' | 'partial' | 'matched') => 
              setExpectationFilters({ status: value })
            }
          >
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="unmatched">Unmatched</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="matched">Matched</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* List */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="divide-y divide-border">
          {expectations.map((expectation) => {
            const isSelected = pendingMatchExpectationIds.includes(expectation.id);
            const isMatched = expectation.status === 'matched';
            const isMatchedToThisPayment = payment?.matchedExpectationIds.includes(expectation.id);
            const hasVariance = isMatched && expectation.allocatedAmount !== expectation.expectedAmount;
            const varianceAmount = expectation.allocatedAmount - expectation.expectedAmount;
            const variancePercent = expectation.expectedAmount > 0 
              ? (varianceAmount / expectation.expectedAmount) * 100 
              : 0;
            
            return (
              <div
                key={expectation.id}
                className={cn(
                  "px-4 py-2.5 flex items-center gap-4 transition-all duration-150 cursor-pointer",
                  "hover:bg-muted/50",
                  isMatched && isMatchedToThisPayment && "bg-success-light",
                  isMatched && !isMatchedToThisPayment && "bg-muted/30 opacity-60",
                  !isMatched && isSelected && "bg-primary/5",
                  !isMatched && !isSelected && "bg-background"
                )}
                onClick={() => {
                  if (!isMatched) {
                    toggleExpectationSelection(expectation.id);
                  }
                }}
              >
                {/* Checkbox */}
                <div className="shrink-0">
                  {isMatched ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <Checkbox 
                      checked={isSelected}
                      onCheckedChange={() => toggleExpectationSelection(expectation.id)}
                      className="h-4 w-4"
                    />
                  )}
                </div>
                
                {/* Client Name */}
                <div className="min-w-0 w-40 shrink-0">
                  <span className="font-medium text-foreground text-sm truncate block">
                    {expectation.clientName}
                  </span>
                </div>
                
                {/* Plan Reference */}
                <div className="min-w-0 flex-1 text-sm text-muted-foreground truncate">
                  {expectation.planReference}
                </div>
                
                {/* Fee Category */}
                <Badge variant="outline" className={cn("text-xs font-medium shrink-0", getFeeCategoryColor(expectation.feeCategory))}>
                  {getFeeCategoryLabel(expectation.feeCategory)}
                </Badge>
                
                {/* Amount */}
                <div className="text-right shrink-0 w-32">
                  {isMatched && isMatchedToThisPayment ? (
                    <div>
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-xs text-muted-foreground line-through">
                          {formatCurrency(expectation.expectedAmount)}
                        </span>
                        <span className="font-semibold text-sm tabular-nums">
                          {formatCurrency(expectation.allocatedAmount)}
                        </span>
                      </div>
                      {hasVariance && (
                        <div className={cn(
                          "flex items-center justify-end gap-0.5 text-xs",
                          varianceAmount > 0 ? "text-success" : "text-danger"
                        )}>
                          {varianceAmount > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span>
                            {varianceAmount > 0 ? '+' : ''}{variancePercent.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="font-semibold text-sm tabular-nums">
                      {formatCurrency(expectation.expectedAmount)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          
          {expectations.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Circle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm">No expectations found</p>
              <p className="text-xs mt-1">Try adjusting your filters</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}