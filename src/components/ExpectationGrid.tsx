import { useReconciliationStore } from '@/store/reconciliationStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  User,
  Calendar,
  Tag,
  CheckCircle2,
  Circle,
  GripVertical,
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
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short'
    });
  };
  
  const getFeeTypeLabel = (feeType: string) => {
    const labels: Record<string, string> = {
      management: 'Management',
      performance: 'Performance',
      advisory: 'Advisory',
      custody: 'Custody'
    };
    return labels[feeType] || feeType;
  };
  
  const getFeeTypeColor = (feeType: string) => {
    const colors: Record<string, string> = {
      management: 'bg-primary/10 text-primary border-primary/20',
      performance: 'bg-success/10 text-success border-success/20',
      advisory: 'bg-warning/10 text-warning border-warning/20',
      custody: 'bg-muted text-muted-foreground border-muted-foreground/20'
    };
    return colors[feeType] || 'bg-muted text-muted-foreground';
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
                    
                    {/* Amount */}
                    <p className="text-xl font-bold text-foreground tabular-nums mb-2">
                      {formatCurrency(expectation.expectedAmount)}
                    </p>
                    
                    {/* Details */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className={cn("text-xs", getFeeTypeColor(expectation.feeType))}>
                        {getFeeTypeLabel(expectation.feeType)}
                      </Badge>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(expectation.calculationDate)}
                      </span>
                      <span className="text-muted-foreground">
                        {expectation.planReference}
                      </span>
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
