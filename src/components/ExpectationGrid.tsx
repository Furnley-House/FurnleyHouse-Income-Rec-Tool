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
      
      {/* Grid */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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
                  "p-4 rounded-lg border transition-all duration-150 cursor-pointer",
                  "hover:shadow-md",
                  isMatched && isMatchedToThisPayment && "bg-success-light border-success/30",
                  isMatched && !isMatchedToThisPayment && "bg-muted/50 border-border opacity-60",
                  !isMatched && isSelected && "bg-primary/5 border-primary ring-1 ring-primary/30",
                  !isMatched && !isSelected && "bg-card border-border hover:border-primary/50"
                )}
                onClick={() => {
                  if (!isMatched) {
                    toggleExpectationSelection(expectation.id);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <div className="mt-0.5">
                    {isMatched ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Checkbox 
                        checked={isSelected}
                        onCheckedChange={() => toggleExpectationSelection(expectation.id)}
                        className="h-5 w-5"
                      />
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Client Name */}
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground text-sm truncate">
                        {expectation.clientName}
                      </span>
                    </div>
                    
                    {/* Plan Reference */}
                    <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">{expectation.planReference}</span>
                    </div>
                    
                    {/* Amount Display */}
                    {isMatched && isMatchedToThisPayment ? (
                      <div className="mb-2">
                        {/* Show expected vs allocated when matched */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground line-through">
                            {formatCurrency(expectation.expectedAmount)}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xl font-bold text-foreground tabular-nums">
                            {formatCurrency(expectation.allocatedAmount)}
                          </span>
                        </div>
                        {/* Variance indicator */}
                        {hasVariance && (
                          <div className={cn(
                            "flex items-center gap-1 text-xs mt-1",
                            varianceAmount > 0 ? "text-success" : "text-danger"
                          )}>
                            {varianceAmount > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            <span>
                              {varianceAmount > 0 ? '+' : ''}{formatCurrency(varianceAmount)} ({variancePercent.toFixed(1)}%)
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xl font-bold text-foreground tabular-nums mb-2">
                        {formatCurrency(expectation.expectedAmount)}
                      </p>
                    )}
                    
                    {/* Fee Category Badge */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className={cn("text-xs font-medium", getFeeCategoryColor(expectation.feeCategory))}>
                        {getFeeCategoryLabel(expectation.feeCategory)}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Drag Handle */}
                  {!isMatched && (
                    <GripVertical className="h-5 w-5 text-muted-foreground/50" />
                  )}
                </div>
              </div>
            );
          })}
          
          {expectations.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
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