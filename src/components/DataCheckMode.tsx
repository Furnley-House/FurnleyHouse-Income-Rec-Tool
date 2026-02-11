import { useState, useMemo } from 'react';
import { useReconciliationStore } from '@/store/reconciliationStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaymentLineItem } from '@/types/reconciliation';

interface DataCondition {
  id: string;
  reasonCode: string;
  title: string;
  description: string;
  icon: React.ElementType;
  getAffectedItems: (lineItems: PaymentLineItem[], allPlanRefs: Set<string>) => PaymentLineItem[];
}

const DATA_CONDITIONS: DataCondition[] = [
  {
    id: 'no-plan-found',
    reasonCode: 'No Plan Found',
    title: 'No Plan Found',
    description: 'The Policy Reference on these line items does not match any known plan in the system. No expectation exists for this reference.',
    icon: FileQuestion,
    getAffectedItems: (lineItems, allPlanRefs) => {
      return lineItems.filter(li => {
        if (li.status !== 'unmatched') return false;
        if (!li.planReference || li.planReference.trim() === '') return false;
        return !allPlanRefs.has(li.planReference);
      });
    },
  },
  {
    id: 'no-fee-record',
    reasonCode: 'No Fee Record',
    title: 'No Fee Record',
    description: 'The plan exists in the system but has no associated fee/expectation record for this provider. The plan was found but no expected fee was created.',
    icon: AlertTriangle,
    getAffectedItems: (lineItems, allPlanRefs) => {
      // Line items where the plan reference IS found somewhere in the system
      // but NOT in the expectations for this provider (already filtered by getRelevantExpectations)
      // This means: plan ref exists in ALL expectations but not in provider-filtered ones
      return lineItems.filter(li => {
        if (li.status !== 'unmatched') return false;
        if (!li.planReference || li.planReference.trim() === '') return false;
        // Plan IS known (exists in global expectations) but NOT in the relevant ones
        return allPlanRefs.has(li.planReference);
      });
    },
  },
];

interface DataCheckModeProps {
  onComplete: () => void;
}

export function DataCheckMode({ onComplete }: DataCheckModeProps) {
  const {
    getSelectedPayment,
    getRelevantExpectations,
    expectations: allExpectations,
    pendingMatches,
    bulkMarkDataCheckApproved,
  } = useReconciliationStore();

  const payment = getSelectedPayment();
  const relevantExpectations = getRelevantExpectations();

  const [currentConditionIndex, setCurrentConditionIndex] = useState(0);
  const [processedConditions, setProcessedConditions] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Build sets of known plan references
  const { allKnownPlanRefs, relevantPlanRefs } = useMemo(() => {
    const allRefs = new Set<string>();
    allExpectations.forEach(e => {
      if (e.planReference && e.planReference.trim() !== '') {
        allRefs.add(e.planReference);
      }
    });
    const relevantRefs = new Set<string>();
    relevantExpectations.forEach(e => {
      if (e.planReference && e.planReference.trim() !== '') {
        relevantRefs.add(e.planReference);
      }
    });
    return { allKnownPlanRefs: allRefs, relevantPlanRefs: relevantRefs };
  }, [allExpectations, relevantExpectations]);

  if (!payment) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Get unmatched line items (excluding pending matches)
  const pendingLineItemIds = new Set(pendingMatches.map(pm => pm.lineItemId));
  const unmatchedLineItems = payment.lineItems.filter(
    li => li.status === 'unmatched' && !pendingLineItemIds.has(li.id)
  );

  // For "No Plan Found": plan ref not in ANY expectations (global)
  // For "No Fee Record": plan ref in global expectations but NOT in relevant (provider-filtered) ones
  const conditionResults = DATA_CONDITIONS.map(condition => {
    let affected: PaymentLineItem[];
    if (condition.id === 'no-plan-found') {
      affected = unmatchedLineItems.filter(li => {
        if (!li.planReference || li.planReference.trim() === '') return false;
        return !allKnownPlanRefs.has(li.planReference);
      });
    } else {
      // no-fee-record: plan ref exists globally but not in provider-relevant expectations
      affected = unmatchedLineItems.filter(li => {
        if (!li.planReference || li.planReference.trim() === '') return false;
        return allKnownPlanRefs.has(li.planReference) && !relevantPlanRefs.has(li.planReference);
      });
    }
    return { condition, affected };
  });

  const totalAffected = conditionResults.reduce((sum, r) => sum + r.affected.length, 0);
  const currentResult = conditionResults[currentConditionIndex];
  const allDone = currentConditionIndex >= DATA_CONDITIONS.length || processedConditions.size === DATA_CONDITIONS.length;

  const handleAcceptAll = async () => {
    if (!currentResult || currentResult.affected.length === 0) return;
    setIsProcessing(true);

    const ids = currentResult.affected.map(li => li.id);
    const notes = `Data Check: ${currentResult.condition.title} — ${ids.length} items approved`;

    bulkMarkDataCheckApproved(ids, currentResult.condition.reasonCode, notes);

    setProcessedConditions(prev => new Set([...prev, currentResult.condition.id]));
    setIsProcessing(false);

    // Auto-advance to next condition
    if (currentConditionIndex < DATA_CONDITIONS.length - 1) {
      setCurrentConditionIndex(currentConditionIndex + 1);
    }
  };

  const handleSkip = () => {
    setProcessedConditions(prev => new Set([...prev, DATA_CONDITIONS[currentConditionIndex].id]));
    if (currentConditionIndex < DATA_CONDITIONS.length - 1) {
      setCurrentConditionIndex(currentConditionIndex + 1);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Search className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Data Condition Checks</h2>
              <p className="text-xs text-muted-foreground">
                Identify and resolve known data issues for {unmatchedLineItems.length} unmatched items
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onComplete}>
            {allDone ? 'Continue to Manual Match →' : 'Skip to Manual Match →'}
          </Button>
        </div>
      </div>

      {/* Condition Steps */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          {DATA_CONDITIONS.map((condition, index) => {
            const result = conditionResults[index];
            const isProcessed = processedConditions.has(condition.id);
            const isCurrent = index === currentConditionIndex && !allDone;

            return (
              <div key={condition.id} className="flex items-center">
                {index > 0 && <div className="w-6 h-px mx-1 bg-border" />}
                <button
                  onClick={() => !isProcessed && setCurrentConditionIndex(index)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                    isCurrent && "bg-primary/10 text-primary font-medium ring-1 ring-primary/30",
                    isProcessed && "text-success",
                    !isCurrent && !isProcessed && "text-muted-foreground"
                  )}
                >
                  {isProcessed ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <condition.icon className={cn("h-4 w-4", isCurrent ? "text-primary" : "text-muted-foreground")} />
                  )}
                  <span>{condition.title}</span>
                  <Badge variant="outline" className={cn(
                    "text-xs h-5",
                    result.affected.length > 0
                      ? "bg-destructive/10 text-destructive border-destructive/30"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {result.affected.length}
                  </Badge>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {allDone ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
              <h3 className="text-lg font-semibold">Data Checks Complete</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                All data conditions have been reviewed.
                {totalAffected > 0
                  ? ` ${totalAffected} items were identified across all conditions.`
                  : ' No data issues were found.'}
              </p>
              <Button onClick={onComplete} className="gap-2">
                <ArrowRight className="h-4 w-4" />
                Continue to Manual Match
              </Button>
            </div>
          </div>
        ) : currentResult ? (
          <div className="flex-1 flex flex-col">
            {/* Condition Description */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-start gap-3">
                <currentResult.condition.icon className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">{currentResult.condition.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{currentResult.condition.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {currentResult.affected.length > 0 && (
                    <Button
                      onClick={handleAcceptAll}
                      disabled={isProcessing}
                      size="sm"
                      className="gap-2"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Accept All ({currentResult.affected.length})
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleSkip}>
                    Skip
                  </Button>
                </div>
              </div>
            </div>

            {/* Affected Items List */}
            <ScrollArea className="flex-1">
              {currentResult.affected.length === 0 ? (
                <div className="flex items-center justify-center h-full py-12">
                  <div className="text-center space-y-2">
                    <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
                    <p className="text-sm font-medium text-foreground">No items affected</p>
                    <p className="text-xs text-muted-foreground">
                      No line items match this condition.
                    </p>
                    <Button variant="outline" size="sm" onClick={handleSkip} className="mt-2">
                      Continue
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {/* Table Header */}
                  <div className="px-4 py-2 bg-muted/50 flex items-center gap-2 text-xs font-medium text-muted-foreground sticky top-0">
                    <span className="w-48">Client Name</span>
                    <span className="w-44">Policy Reference</span>
                    <span className="w-20">Fee Type</span>
                    <span className="w-20 text-right">Amount</span>
                  </div>
                  {currentResult.affected.map(item => (
                    <div
                      key={item.id}
                      className="px-4 py-2 flex items-center gap-2 text-sm hover:bg-muted/30"
                    >
                      <span className="w-48 font-medium text-foreground truncate" title={item.clientName}>
                        {item.clientName}
                      </span>
                      <span className="w-44 text-muted-foreground truncate" title={item.planReference}>
                        {item.planReference}
                      </span>
                      <span className="w-20">
                        {item.feeCategory && (
                          <Badge variant="outline" className={cn(
                            "text-xs h-4",
                            item.feeCategory === 'initial'
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                              : "bg-blue-500/10 text-blue-600 border-blue-500/30"
                          )}>
                            {item.feeCategory === 'initial' ? 'Initial' : 'Ongoing'}
                          </Badge>
                        )}
                      </span>
                      <span className="w-20 text-right font-semibold tabular-nums">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Footer Summary */}
            {currentResult.affected.length > 0 && (
              <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {currentResult.affected.length} items • Reason: <strong className="text-foreground">{currentResult.condition.reasonCode}</strong>
                </span>
                <span className="font-bold tabular-nums">
                  {formatCurrency(currentResult.affected.reduce((sum, li) => sum + li.amount, 0))}
                </span>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
