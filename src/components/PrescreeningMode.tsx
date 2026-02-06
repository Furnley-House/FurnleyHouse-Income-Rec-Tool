import { useState, useMemo } from 'react';
import { useReconciliationStore } from '@/store/reconciliationStore';
import { useZohoSync } from '@/hooks/useZohoSync';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import {
  Zap,
  ArrowRight,
  CheckCircle2,
  Circle,
  AlertTriangle,
  TrendingDown,
  Settings2,
  Play,
  SkipForward,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PendingMatch } from '@/types/reconciliation';

interface TolerancePassResult {
  tolerance: number;
  matchCount: number;
  matches: PendingMatch[];
}

export function PrescreeningMode({ onSwitchToStandard }: { onSwitchToStandard: () => void }) {
  const {
    getSelectedPayment,
    getRelevantExpectations,
    pendingMatches,
    addPendingMatch,
    confirmPendingMatches,
    tolerance,
    setTolerance,
    expectations: allExpectationsFromStore
  } = useReconciliationStore();
  
  const { syncMatches, syncPaymentStatus } = useZohoSync();
  
  const payment = getSelectedPayment();
  const expectations = getRelevantExpectations();
  
  const [currentToleranceStep, setCurrentToleranceStep] = useState(0);
  const [passResults, setPassResults] = useState<TolerancePassResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const toleranceSteps = [0, 1, 5, 10, 25, Infinity]; // Infinity = "Any" tolerance
  
  if (!payment) return null;
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2
    }).format(amount);
  };
  
  // Calculate ALL potential matches with their variances (no tolerance filter)
  const calculateAllPotentialMatches = (): PendingMatch[] => {
    const pendingLineItemIds = pendingMatches.map(pm => pm.lineItemId);
    const pendingExpectationIds = pendingMatches.map(pm => pm.expectationId);
    
    const unmatchedLineItems = payment.lineItems.filter(li =>
      li.status === 'unmatched' && !pendingLineItemIds.includes(li.id)
    );
    
    const unmatchedExpectations = expectations.filter(e =>
      e.status === 'unmatched' && !pendingExpectationIds.includes(e.id)
    );
    
    console.log(`[Prescreening] Starting match calculation:`);
    console.log(`  - ${unmatchedLineItems.length} unmatched line items`);
    console.log(`  - ${unmatchedExpectations.length} unmatched expectations`);
    
    // Log sample of line item amounts
    console.log(`[Prescreening] Sample line items (first 5):`);
    unmatchedLineItems.slice(0, 5).forEach(li => {
      console.log(`  - ${li.planReference}: £${li.amount}`);
    });
    
    // Log sample of expectation amounts
    console.log(`[Prescreening] Sample expectations (first 5):`);
    unmatchedExpectations.slice(0, 5).forEach(e => {
      console.log(`  - ${e.planReference}: £${e.expectedAmount}`);
    });
    
    const matches: PendingMatch[] = [];
    const usedExpectationIds = new Set<string>();
    let skippedZeroOrInvalidExpectedAmount = 0;
    let matchLogCount = 0;
    
    for (const lineItem of unmatchedLineItems) {
      if (!lineItem.planReference || lineItem.planReference.trim() === '') continue;
      
      // STEP 1: Find expectation with matching plan reference
      const matchingExpectation = unmatchedExpectations.find(e =>
        e.planReference && 
        e.planReference.trim() !== '' &&
        e.planReference === lineItem.planReference &&
        !usedExpectationIds.has(e.id)
      );
      
      if (matchingExpectation) {
        // STEP 2: Validate expectation has valid amount
        if (!(matchingExpectation.expectedAmount > 0)) {
          skippedZeroOrInvalidExpectedAmount += 1;
          continue;
        }

        // STEP 3: Calculate variance AFTER confirming plan reference match
        const variance = lineItem.amount - matchingExpectation.expectedAmount;
        const variancePercentage = (variance / matchingExpectation.expectedAmount) * 100;
        
        // Log first 10 matches to verify calculation
        if (matchLogCount < 10) {
          console.log(`[Prescreening] MATCH #${matchLogCount + 1}:`);
          console.log(`  Plan Ref: ${lineItem.planReference}`);
          console.log(`  Line Item Amount: £${lineItem.amount.toFixed(2)}`);
          console.log(`  Expected Amount:  £${matchingExpectation.expectedAmount.toFixed(2)}`);
          console.log(`  Variance: £${variance.toFixed(2)} (${variancePercentage.toFixed(4)}%)`);
          matchLogCount++;
        }
        
        usedExpectationIds.add(matchingExpectation.id);
        matches.push({
          lineItemId: lineItem.id,
          expectationId: matchingExpectation.id,
          lineItemAmount: lineItem.amount,
          expectedAmount: matchingExpectation.expectedAmount,
          variance,
          variancePercentage,
          isWithinTolerance: true // Will be evaluated per tolerance level
        });
      }
    }

    if (skippedZeroOrInvalidExpectedAmount > 0) {
      console.warn(
        `[Prescreening] Skipped ${skippedZeroOrInvalidExpectedAmount} plan-reference matches because the expectation had expectedAmount <= 0 (data issue).`
      );
    }
    
    console.log(`[Prescreening] Total plan reference matches found: ${matches.length}`);
    
    return matches;
  };
  
  // Filter matches by tolerance level (Infinity means accept all)
  const filterMatchesByTolerance = (allMatches: PendingMatch[], tolerancePercent: number): PendingMatch[] => {
    if (tolerancePercent === Infinity) return allMatches;
    return allMatches.filter(m => Math.abs(m.variancePercentage) <= tolerancePercent);
  };
  
  // Calculate potential matches at each tolerance level (for running)
  const calculateMatchesAtTolerance = (tolerancePercent: number): PendingMatch[] => {
    console.log(`[Prescreening] Calculating matches at ${tolerancePercent}% tolerance`);
    
    const allMatches = calculateAllPotentialMatches();
    const filteredMatches = filterMatchesByTolerance(allMatches, tolerancePercent);

    // Data quality signal: unmatched expectations with invalid expectedAmount
    const pendingExpectationIds = pendingMatches.map(pm => pm.expectationId);
    const invalidExpectedAmountExpectations = expectations.filter(e =>
      e.status === 'unmatched' &&
      !pendingExpectationIds.includes(e.id) &&
      !(e.expectedAmount > 0)
    ).length;
    if (invalidExpectedAmountExpectations > 0) {
      console.warn(
        `[Prescreening] ${invalidExpectedAmountExpectations} unmatched expectations have expectedAmount <= 0. These cannot be tolerance-matched reliably.`
      );
    }
    
    // Log variance distribution
    // "Exact" should mean currency-identical to the penny (not variancePercentage === 0)
    const EPS_PENNIES = 0.005; // half a penny threshold
    const varianceDistribution = {
      exact: allMatches.filter(m => Math.abs(m.variance) < EPS_PENNIES).length,
      within0_5: allMatches.filter(m => Math.abs(m.variancePercentage) > 0 && Math.abs(m.variancePercentage) <= 0.5).length,
      within1: allMatches.filter(m => Math.abs(m.variancePercentage) > 0.5 && Math.abs(m.variancePercentage) <= 1).length,
      within2: allMatches.filter(m => Math.abs(m.variancePercentage) > 1 && Math.abs(m.variancePercentage) <= 2).length,
      within5: allMatches.filter(m => Math.abs(m.variancePercentage) > 2 && Math.abs(m.variancePercentage) <= 5).length,
      over5: allMatches.filter(m => Math.abs(m.variancePercentage) > 5).length
    };
    
    console.log(`[Prescreening] VARIANCE DISTRIBUTION for ${allMatches.length} plan reference matches:`);
    console.log(`  - Exact (0%): ${varianceDistribution.exact}`);
    console.log(`  - 0-0.5%: ${varianceDistribution.within0_5}`);
    console.log(`  - 0.5-1%: ${varianceDistribution.within1}`);
    console.log(`  - 1-2%: ${varianceDistribution.within2}`);
    console.log(`  - 2-5%: ${varianceDistribution.within5}`);
    console.log(`  - >5% (rejected): ${varianceDistribution.over5}`);
    
    // Log individual matches with high variance
    allMatches
      .filter(m => Math.abs(m.variance) >= 0.01)
      .slice(0, 20)
      .forEach(m => {
        const lineItem = payment.lineItems.find(li => li.id === m.lineItemId);
        console.log(
          `[Prescreening] ${lineItem?.planReference}: £${m.lineItemAmount.toFixed(2)} vs £${m.expectedAmount.toFixed(2)} = £${m.variance.toFixed(2)} (${m.variancePercentage.toFixed(2)}%)`
        );
      });
    
    console.log(`[Prescreening] At ${tolerancePercent}% tolerance: ${filteredMatches.length} matches accepted`);
    return filteredMatches;
  };
  
  // Preview counts for each tolerance level
  const tolerancePreview = useMemo(() => {
    return toleranceSteps.map(tol => ({
      tolerance: tol,
      matchCount: calculateMatchesAtTolerance(tol).length
    }));
  }, [payment.lineItems, expectations, pendingMatches]);
  
  const totalItems = payment.lineItems.length;
  const processedItems = payment.lineItems.filter(li => 
    li.status === 'matched' || li.status === 'approved_unmatched'
  ).length;
  const pendingCount = pendingMatches.length;
  const remainingItems = totalItems - processedItems - pendingCount;
  
  const progressPercentage = ((processedItems + pendingCount) / totalItems) * 100;
  
  const runAutoMatchAtTolerance = (tolerancePercent: number) => {
    const matches = calculateMatchesAtTolerance(tolerancePercent);
    
    // Add all matches to pending
    matches.forEach(match => {
      addPendingMatch(match.lineItemId, match.expectationId);
    });
    
    // Record the pass result
    setPassResults(prev => [...prev, {
      tolerance: tolerancePercent,
      matchCount: matches.length,
      matches
    }]);
    
    return matches.length;
  };
  
  const handleRunCurrentPass = () => {
    if (currentToleranceStep >= toleranceSteps.length) return;
    
    setIsRunning(true);
    const currentTolerance = toleranceSteps[currentToleranceStep];
    
    // Update global tolerance
    setTolerance(currentTolerance);
    
    const matchCount = runAutoMatchAtTolerance(currentTolerance);
    
    setCurrentToleranceStep(prev => prev + 1);
    setIsRunning(false);
  };
  
  const handleConfirmAndContinue = async () => {
    if (pendingMatches.length === 0) return;
    
    setIsSyncing(true);
    
    try {
      // First, confirm matches locally
      const notes = `Prescreening batch - matched at tolerance levels: ${passResults.map(p => `${p.tolerance}%`).join(', ')}`;
      confirmPendingMatches(notes);
      
      // Sync matches to Zoho
      const matchSyncData = pendingMatches.map(pm => {
        const lineItem = payment.lineItems.find(li => li.id === pm.lineItemId);
        const expectation = allExpectationsFromStore.find(e => e.id === pm.expectationId);
        
        // Determine match quality based on variance
        let matchQuality: 'perfect' | 'good' | 'acceptable' | 'warning' = 'warning';
        const absVariance = Math.abs(pm.variancePercentage);
        if (absVariance < 0.1) matchQuality = 'perfect';
        else if (absVariance <= 2) matchQuality = 'good';
        else if (absVariance <= tolerance) matchQuality = 'acceptable';
        
        return {
          paymentId: payment.id,
          paymentZohoId: payment.zohoId || payment.id,
          lineItemId: pm.lineItemId,
          lineItemZohoId: lineItem?.zohoId || pm.lineItemId,
          expectationId: pm.expectationId,
          expectationZohoId: expectation?.zohoId || pm.expectationId,
          matchedAmount: pm.lineItemAmount,
          variance: pm.variance,
          variancePercentage: pm.variancePercentage,
          matchType: 'full' as const,
          matchMethod: 'auto' as const, // Prescreening is auto-matching
          matchQuality,
          notes,
        };
      });
      
      await syncMatches(matchSyncData);
      
      // Calculate new payment status
      const totalMatchedAmount = pendingMatches.reduce((sum, pm) => sum + pm.lineItemAmount, 0);
      const newReconciledAmount = payment.reconciledAmount + totalMatchedAmount;
      const newRemainingAmount = payment.amount - newReconciledAmount;
      const allMatched = payment.lineItems.every(li => 
        li.status === 'matched' || pendingMatches.some(pm => pm.lineItemId === li.id)
      );
      const newStatus = allMatched ? 'reconciled' : 'in_progress';
      
      await syncPaymentStatus(
        payment.zohoId || payment.id,
        newStatus,
        newReconciledAmount,
        newRemainingAmount,
        notes
      );
      
      setPassResults([]);
    } finally {
      setIsSyncing(false);
    }
  };
  
  const getToleranceLabel = (tol: number) => {
    if (tol === 0) return 'Exact';
    if (tol <= 1) return 'Tight';
    if (tol <= 5) return 'Normal';
    if (tol <= 10) return 'Flexible';
    if (tol <= 25) return 'Loose';
    return 'Any';
  };
  
  const getToleranceColor = (tol: number) => {
    if (tol === 0) return 'bg-success/10 text-success border-success/30';
    if (tol <= 1) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
    if (tol <= 5) return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    if (tol <= 10) return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
    if (tol <= 25) return 'bg-rose-500/10 text-rose-600 border-rose-500/30';
    return 'bg-destructive/10 text-destructive border-destructive/30';
  };
  
  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Prescreening Mode</h2>
              <p className="text-xs text-muted-foreground">
                Progressive tolerance matching for {totalItems} items
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onSwitchToStandard}>
            <SkipForward className="h-4 w-4 mr-2" />
            Switch to Standard View
          </Button>
        </div>
      </div>
      
      {/* Progress Overview */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Processing Progress</span>
          <span className="text-sm text-muted-foreground">
            {processedItems + pendingCount} / {totalItems} items
          </span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>{processedItems} confirmed</span>
          <span>{pendingCount} pending</span>
          <span>{remainingItems} remaining</span>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Tolerance Control */}
        <div className="w-80 border-r border-border p-4 flex flex-col">
          <h3 className="font-medium text-sm mb-4 flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            Tolerance Passes
          </h3>
          
          <div className="space-y-2 flex-1">
            {toleranceSteps.map((tol, index) => {
              const preview = tolerancePreview.find(p => p.tolerance === tol);
              const passResult = passResults.find(p => p.tolerance === tol);
              const isCompleted = index < currentToleranceStep;
              const isCurrent = index === currentToleranceStep;
              const isPending = index > currentToleranceStep;
              
              return (
                <div
                  key={tol}
                  className={cn(
                    "p-3 rounded-lg border transition-colors",
                    isCompleted && "bg-success/5 border-success/30",
                    isCurrent && "bg-primary/5 border-primary/30 ring-1 ring-primary/20",
                    isPending && "bg-muted/30 border-border opacity-60"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : isCurrent ? (
                        <Circle className="h-4 w-4 text-primary fill-primary/20" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/40" />
                      )}
                      <span className="font-medium text-sm">
                        {tol === 0 ? 'Exact Match' : tol === Infinity ? 'Any Variance' : `${tol}% Tolerance`}
                      </span>
                    </div>
                    <Badge variant="outline" className={cn("text-xs h-5", getToleranceColor(tol))}>
                      {getToleranceLabel(tol)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground ml-6">
                    {isCompleted && passResult ? (
                      <span className="text-success">{passResult.matchCount} items matched</span>
                    ) : isCurrent ? (
                      <span>{preview?.matchCount || 0} potential matches</span>
                    ) : (
                      <span>{preview?.matchCount || 0} available</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Action Buttons */}
          <div className="mt-4 space-y-2">
            {currentToleranceStep < toleranceSteps.length && remainingItems > 0 && (
              <Button
                onClick={handleRunCurrentPass}
                disabled={isRunning}
                className="w-full gap-2"
              >
                <Play className="h-4 w-4" />
                Run {toleranceSteps[currentToleranceStep] === 0 ? 'Exact' : toleranceSteps[currentToleranceStep] === Infinity ? 'Any' : `${toleranceSteps[currentToleranceStep]}%`} Pass
              </Button>
            )}
            
            {pendingMatches.length > 0 && (
              <Button
                variant="secondary"
                onClick={handleConfirmAndContinue}
                disabled={isSyncing}
                className="w-full gap-2"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Syncing to Zoho...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm {pendingMatches.length} Matches
                  </>
                )}
              </Button>
            )}
            
            {remainingItems > 0 && currentToleranceStep >= toleranceSteps.length && (
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground mb-2">
                  {remainingItems} items remain unmatched
                </p>
                <Button variant="outline" onClick={onSwitchToStandard} className="gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Review Manually
                </Button>
              </div>
            )}
          </div>
        </div>
        
        {/* Right: Results Summary */}
        <div className="flex-1 p-4 flex flex-col">
          <h3 className="font-medium text-sm mb-4 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            Match Results
          </h3>
          
          {pendingMatches.length > 0 ? (
            <ScrollArea className="flex-1">
              <div className="space-y-1">
                {pendingMatches.map((pm) => {
                  const lineItem = payment.lineItems.find(li => li.id === pm.lineItemId);
                  
                  return (
                    <div
                      key={pm.lineItemId}
                      className="p-2 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-3"
                    >
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {lineItem?.clientName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lineItem?.planReference}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCurrency(pm.lineItemAmount)}
                        </p>
                        <p className={cn(
                          "text-xs tabular-nums",
                          Math.abs(pm.variancePercentage) <= 0.5 ? "text-success" :
                          Math.abs(pm.variancePercentage) <= 2 ? "text-amber-600" :
                          "text-orange-600"
                        )}>
                          {pm.variancePercentage >= 0 ? '+' : ''}{pm.variancePercentage.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : passResults.length > 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
                <p className="text-lg font-medium">Matches Confirmed</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Run the next pass to find more matches
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-lg font-medium text-muted-foreground">Ready to Start</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click "Run Exact Pass" to begin prescreening
                </p>
              </div>
            </div>
          )}
          
          {/* Summary Stats */}
          {passResults.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {passResults.reduce((sum, p) => sum + p.matchCount, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Matched</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">
                    {remainingItems}
                  </p>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-success">
                    {passResults.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Passes Run</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
