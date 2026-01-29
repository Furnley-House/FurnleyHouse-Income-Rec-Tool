import { useState, useEffect } from 'react';
import { useReconciliationStore } from '@/store/reconciliationStore';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { 
  Search, 
  CheckCircle2,
  Target,
  Link2,
  AlertTriangle,
  X,
  Eye,
  EyeOff,
  Calendar
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';

export function ExpectationGrid() {
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [selectedExpForMatch, setSelectedExpForMatch] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [selectedLineItemId, setSelectedLineItemId] = useState<string | null>(null);
  const [showMatched, setShowMatched] = useState(false);
  
  const { 
    getRelevantExpectations,
    getPendingMatchForExpectation,
    expectationFilters,
    setExpectationFilters,
    getSelectedPayment,
    calculateVariance,
    addPendingMatch,
    tolerance
  } = useReconciliationStore();
  
  const payment = getSelectedPayment();
  const allExpectations = getRelevantExpectations();
  
  // Format payment month for display
  const getPaymentMonthLabel = () => {
    if (!payment?.paymentDate) return 'No date';
    const date = new Date(payment.paymentDate);
    return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  };
  
  // Poll for selected line item from StatementItemList
  useEffect(() => {
    const checkSelection = () => {
      const id = (window as any).__selectedLineItemId || null;
      if (id !== selectedLineItemId) {
        setSelectedLineItemId(id);
      }
    };
    
    checkSelection();
    const interval = setInterval(checkSelection, 100);
    return () => clearInterval(interval);
  }, [selectedLineItemId]);
  
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
  
  // Count by status (from all expectations)
  const unmatchedCount = allExpectations.filter(e => e.status === 'unmatched' && !getPendingMatchForExpectation(e.id)).length;
  const pendingCount = allExpectations.filter(e => getPendingMatchForExpectation(e.id)).length;
  const matchedCount = allExpectations.filter(e => e.status === 'matched').length;
  
  // Filter out matched items unless showMatched is true
  const filteredExpectations = allExpectations.filter(exp => {
    if (showMatched) return true;
    return exp.status !== 'matched';
  });
  
  // Sort expectations to show suggested matches at the top when a line item is selected
  const expectations = [...filteredExpectations].sort((a, b) => {
    if (!selectedLineItem) return 0;
    
    // Score system: higher score = better match, appears first
    const scoreExpectation = (exp: typeof a) => {
      let score = 0;
      
      // Primary: Policy reference match (most important)
      const lineItemRef = selectedLineItem.planReference?.toLowerCase().trim() || '';
      const expRef = exp.planReference?.toLowerCase().trim() || '';
      
      if (lineItemRef && expRef) {
        if (lineItemRef === expRef) {
          score += 1000; // Exact policy reference match
        } else if (lineItemRef.includes(expRef) || expRef.includes(lineItemRef)) {
          score += 500; // Partial policy reference match
        }
      }
      
      // Secondary: Client name match
      const lineItemClient = selectedLineItem.clientName?.toLowerCase().trim() || '';
      const expClient = exp.clientName?.toLowerCase().trim() || '';
      
      if (lineItemClient && expClient) {
        if (lineItemClient === expClient) {
          score += 100; // Exact client name match
        } else if (lineItemClient.includes(expClient) || expClient.includes(lineItemClient)) {
          score += 50; // Partial client name match
        } else {
          // Check for word-level matches (handles "John Smith" vs "Smith, John")
          const lineItemWords = lineItemClient.split(/[\s,]+/).filter(w => w.length > 1);
          const expWords = expClient.split(/[\s,]+/).filter(w => w.length > 1);
          const matchingWords = lineItemWords.filter(w => expWords.some(ew => ew.includes(w) || w.includes(ew)));
          score += matchingWords.length * 10;
        }
      }
      
      return score;
    };
    
    const scoreA = scoreExpectation(a);
    const scoreB = scoreExpectation(b);
    
    // Sort by score descending (higher = better match = first)
    return scoreB - scoreA;
  });
  
  const handleMatchClick = (expectationId: string) => {
    if (!selectedLineItemId) return;
    
    const variance = calculateVariance(selectedLineItemId, expectationId);
    const isWithinTolerance = variance && variance.isWithinTolerance;
    
    if (isWithinTolerance) {
      // Direct match within tolerance
      const onMatched = (window as any).__onLineItemMatched;
      if (onMatched) {
        onMatched(expectationId);
      }
    } else {
      // Need approval for out-of-tolerance match
      setSelectedExpForMatch(expectationId);
      setApprovalNotes('');
      setMatchDialogOpen(true);
    }
  };
  
  const handleConfirmOutOfToleranceMatch = () => {
    if (selectedExpForMatch && approvalNotes.trim() && selectedLineItemId) {
      addPendingMatch(selectedLineItemId, selectedExpForMatch);
      // Clear the selection in StatementItemList
      const clearSelection = (window as any).__clearLineItemSelection;
      if (clearSelection) {
        clearSelection();
      }
      setMatchDialogOpen(false);
      setSelectedExpForMatch(null);
      setApprovalNotes('');
    }
  };
  
  const selectedExpectation = selectedExpForMatch 
    ? expectations.find(e => e.id === selectedExpForMatch) 
    : null;
  const dialogVariance = selectedExpForMatch && selectedLineItemId 
    ? calculateVariance(selectedLineItemId, selectedExpForMatch) 
    : null;
  
  // Get selected line item details
  const selectedLineItem = selectedLineItemId && payment
    ? payment.lineItems.find(li => li.id === selectedLineItemId)
    : null;
  
  return (
    <div className="h-full flex flex-col bg-card">
      {/* Compact Header */}
      <div className="px-3 py-2 border-b border-border bg-secondary/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-secondary-foreground" />
            <span className="font-semibold text-foreground text-sm">Expected Fees</span>
            {unmatchedCount > 0 && (
              <Badge variant="outline" className="bg-muted text-xs h-5">
                {unmatchedCount} unmatched
              </Badge>
            )}
            {pendingCount > 0 && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs h-5">
                {pendingCount} pending
              </Badge>
            )}
            {matchedCount > 0 && (
              <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs h-5">
                {matchedCount} matched
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {matchedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => setShowMatched(!showMatched)}
              >
                {showMatched ? (
                  <>
                    <EyeOff className="h-3 w-3" />
                    Hide matched
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3" />
                    Show matched
                  </>
                )}
              </Button>
            )}
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
              value={expectationFilters.monthRange}
              onValueChange={(value: 'payment' | 'extended' | 'all') => 
                setExpectationFilters({ monthRange: value })
              }
            >
              <SelectTrigger className="w-28 h-6 text-xs">
                <Calendar className="h-3 w-3 mr-1 shrink-0" />
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="payment">{getPaymentMonthLabel()}</SelectItem>
                <SelectItem value="extended">±1 Month</SelectItem>
                <SelectItem value="all">All Dates</SelectItem>
              </SelectContent>
            </Select>
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
      
      {/* Line Item Selection Mode Indicator */}
      {selectedLineItem && (
        <div className="px-3 py-2 bg-primary/10 border-b border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Link2 className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-primary">
                Matching: {selectedLineItem.clientName} • {formatCurrency(selectedLineItem.amount)}
              </span>
            </div>
            <button 
              onClick={() => {
                const clearSelection = (window as any).__clearLineItemSelection;
                if (clearSelection) clearSelection();
              }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Compact List */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="divide-y divide-border/50">
          {expectations.map((expectation) => {
            const pendingMatch = getPendingMatchForExpectation(expectation.id);
            const isPending = !!pendingMatch;
            const isMatched = expectation.status === 'matched';
            const isMatchedToThisPayment = payment?.matchedExpectationIds.includes(expectation.id);
            
            const variance = selectedLineItemId 
              ? calculateVariance(selectedLineItemId, expectation.id) 
              : null;
            const isWithinTolerance = variance?.isWithinTolerance ?? false;
            
            const canMatch = selectedLineItemId && !isMatched && !isPending;
            
            return (
              <div
                key={expectation.id}
                className={cn(
                  "px-3 py-1.5 flex items-center gap-2 text-sm",
                  isMatched && isMatchedToThisPayment && "bg-success/5",
                  isMatched && !isMatchedToThisPayment && "bg-muted/30 opacity-50",
                  isPending && "bg-primary/5",
                  !isMatched && !isPending && "bg-background"
                )}
              >
                {/* Status Icon */}
                {isMatched ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                ) : isPending ? (
                  <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                ) : (
                  <Target className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                )}
                
                {/* Client Name */}
                <span className="font-medium text-foreground truncate w-28" title={expectation.clientName}>
                  {expectation.clientName}
                </span>
                
                {/* Policy Reference */}
                <span className="text-xs text-muted-foreground truncate w-36" title={expectation.planReference}>
                  {expectation.planReference}
                </span>
                
                {/* Adviser */}
                <span className="text-xs text-muted-foreground truncate w-16" title={`Adviser: ${expectation.adviserName}`}>
                  {expectation.adviserName.split(' ')[1] || expectation.adviserName}
                </span>
                
                {/* Superbia Company */}
                <span className="text-xs text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded truncate shrink-0" title={`Company: ${expectation.superbiaCompany}`}>
                  {expectation.superbiaCompany === 'Furnley House' ? 'FH' : 
                   expectation.superbiaCompany === 'Headleys' ? 'HL' : 'AW'}
                </span>
                
                {/* Fee Category */}
                <Badge variant="outline" className={cn("text-xs h-4 shrink-0", getFeeCategoryColor(expectation.feeCategory))}>
                  {getFeeCategoryLabel(expectation.feeCategory)}
                </Badge>
                
                {/* Spacer */}
                <div className="flex-1" />
                
                {/* Variance indicator when in line item match mode */}
                {canMatch && variance && (
                  <div className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    isWithinTolerance 
                      ? "bg-success/10 text-success" 
                      : "bg-warning/10 text-warning"
                  )}>
                    {variance.amount >= 0 ? '+' : ''}{variance.percentage.toFixed(1)}%
                  </div>
                )}
                
                {/* Pending variance */}
                {isPending && pendingMatch && (
                  <div className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    pendingMatch.isWithinTolerance 
                      ? "bg-success/10 text-success" 
                      : "bg-warning/10 text-warning"
                  )}>
                    {pendingMatch.variance >= 0 ? '+' : ''}{pendingMatch.variancePercentage.toFixed(1)}%
                  </div>
                )}
                
                {/* Amount */}
                <span className="font-semibold tabular-nums text-right w-20 shrink-0">
                  {formatCurrency(isMatchedToThisPayment ? expectation.allocatedAmount : expectation.expectedAmount)}
                </span>
                
                {/* Match button when in line item match mode */}
                {canMatch && (
                  <Button
                    size="sm"
                    variant={isWithinTolerance ? "default" : "outline"}
                    className="h-5 text-xs px-2"
                    onClick={() => handleMatchClick(expectation.id)}
                  >
                    {isWithinTolerance ? (
                      <>
                        <Link2 className="h-3 w-3 mr-1" />
                        Match
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Approve
                      </>
                    )}
                  </Button>
                )}
                
                {isPending && (
                  <Badge variant="outline" className="text-xs h-4 bg-primary/10 text-primary border-primary/30 shrink-0">
                    Pending
                  </Badge>
                )}
                
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
      
      {/* Out-of-Tolerance Approval Dialog */}
      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Out-of-Tolerance Match
            </DialogTitle>
            <DialogDescription>
              This match requires approval as it exceeds the {tolerance}% tolerance threshold.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Line Item */}
            {selectedLineItem && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Statement Line Item</p>
                <p className="font-medium text-sm">{selectedLineItem.clientName}</p>
                <p className="text-lg font-bold tabular-nums">{formatCurrency(selectedLineItem.amount)}</p>
              </div>
            )}
            
            {/* Expectation */}
            {selectedExpectation && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Expectation</p>
                <p className="font-medium text-sm">{selectedExpectation.clientName}</p>
                <p className="text-lg font-bold tabular-nums">{formatCurrency(selectedExpectation.expectedAmount)}</p>
              </div>
            )}
            
            {/* Variance */}
            {dialogVariance && (
              <div className="bg-warning/10 rounded-lg p-3 border border-warning/30">
                <p className="text-xs text-warning mb-1">Variance</p>
                <p className="text-lg font-bold text-warning tabular-nums">
                  {dialogVariance.amount >= 0 ? '+' : ''}{formatCurrency(dialogVariance.amount)}
                  <span className="text-sm ml-2">({dialogVariance.percentage.toFixed(2)}%)</span>
                </p>
              </div>
            )}
            
            {/* Approval Notes */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Approval Justification (required)</p>
              <Textarea
                placeholder="Please explain why this out-of-tolerance match should be approved..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                className={cn("resize-none", !approvalNotes.trim() && "border-warning")}
                rows={3}
              />
              {!approvalNotes.trim() && (
                <p className="text-xs text-warning mt-1">Approval notes are required</p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMatchDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmOutOfToleranceMatch}
              disabled={!approvalNotes.trim()}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve Match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
