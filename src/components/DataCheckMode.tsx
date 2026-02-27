import { useState, useMemo, useCallback } from 'react';
import { useReconciliationStore } from '@/store/reconciliationStore';
import { callZoho } from '@/lib/api';
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
  CircleDollarSign,
  Percent,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaymentLineItem } from '@/types/reconciliation';

interface DataCheckResult {
  planFound: boolean;
  hasFees: boolean;
  zeroValuation: boolean;
  ongoingFeeZeroPercent: boolean;
  planId?: string;
}

interface DataCheckModeProps {
  onComplete: () => void;
}

type CheckStatus = 'idle' | 'loading' | 'done' | 'error';

export function DataCheckMode({ onComplete }: DataCheckModeProps) {
  const {
    getSelectedPayment,
    pendingMatches,
    bulkMarkDataCheckApproved,
  } = useReconciliationStore();

  const payment = getSelectedPayment();

  const [checkStatus, setCheckStatus] = useState<CheckStatus>('idle');
  const [checkError, setCheckError] = useState<string | null>(null);
  const [zohoResults, setZohoResults] = useState<Record<string, DataCheckResult> | null>(null);
  const [currentConditionIndex, setCurrentConditionIndex] = useState(0);
  const [processedConditions, setProcessedConditions] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Get unmatched line items (excluding pending matches)
  const pendingLineItemIds = new Set(pendingMatches.map(pm => pm.lineItemId));
  const unmatchedLineItems = payment ? payment.lineItems.filter(
    li => li.status === 'unmatched' && !pendingLineItemIds.has(li.id)
  ) : [];

  // Collect unique policy references from unmatched items
  const policyReferences = useMemo(() => {
    const refs = new Set<string>();
    unmatchedLineItems.forEach(li => {
      if (li.planReference?.trim()) refs.add(li.planReference);
    });
    return [...refs];
  }, [unmatchedLineItems]);

  // Run live Zoho check
  const runDataCheck = useCallback(async () => {
    if (policyReferences.length === 0) {
      setCheckStatus('done');
      setZohoResults({});
      return;
    }

    setCheckStatus('loading');
    setCheckError(null);

    try {
      const { data, error } = await callZoho('dataCheck', { policyReferences });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Data check failed');

      setZohoResults(data.data.results);
      setCheckStatus('done');
    } catch (err: any) {
      setCheckError(err.message);
      setCheckStatus('error');
    }
  }, [policyReferences]);

  // Compute affected items based on Zoho results
  const conditionResults = useMemo(() => {
    if (!zohoResults) return [];

    const noPlanItems = unmatchedLineItems.filter(li => {
      if (!li.planReference?.trim()) return false;
      const result = zohoResults[li.planReference];
      return result && !result.planFound;
    });

    const noFeeItems = unmatchedLineItems.filter(li => {
      if (!li.planReference?.trim()) return false;
      const result = zohoResults[li.planReference];
      return result && result.planFound && !result.hasFees;
    });

    const zeroValuationItems = unmatchedLineItems.filter(li => {
      if (!li.planReference?.trim()) return false;
      const result = zohoResults[li.planReference];
      return result && result.planFound && result.zeroValuation;
    });

    const ongoingFeeZeroPercentItems = unmatchedLineItems.filter(li => {
      if (!li.planReference?.trim()) return false;
      const result = zohoResults[li.planReference];
      return result && result.planFound && result.ongoingFeeZeroPercent;
    });

    // Potential Duplicate: policy reference already matched (or pending match) in this payment
    const alreadyMatchedRefs = new Set<string>();
    if (payment) {
      // Refs from already-matched line items in this payment
      payment.lineItems.forEach(li => {
        if (li.status === 'matched' && li.planReference?.trim()) {
          alreadyMatchedRefs.add(li.planReference);
        }
      });
      // Refs from pending matches in this payment
      pendingMatches.forEach(pm => {
        const li = payment.lineItems.find(l => l.id === pm.lineItemId);
        if (li?.planReference?.trim()) {
          alreadyMatchedRefs.add(li.planReference);
        }
      });
    }

    const potentialDuplicateItems = unmatchedLineItems.filter(li => {
      if (!li.planReference?.trim()) return false;
      return alreadyMatchedRefs.has(li.planReference);
    });

    return [
      {
        id: 'no-plan-found',
        reasonCode: 'No Plan Found',
        title: 'No Plan Found',
        description: 'The Policy Reference on these line items does not exist in the Plans module in the CRM. No plan record was found.',
        icon: FileQuestion,
        affected: noPlanItems,
      },
      {
        id: 'no-fee-record',
        reasonCode: 'No Fee Record',
        title: 'No Fee Record',
        description: 'The plan exists in the CRM but has no associated fee record. The plan was found but no expected fee was created.',
        icon: AlertTriangle,
        affected: noFeeItems,
      },
      {
        id: 'zero-valuation',
        reasonCode: 'Zero Valuation',
        title: 'Zero Valuation',
        description: 'The plan exists in the CRM but has a zero valuation, which means no expectation would have been created for this period.',
        icon: CircleDollarSign,
        affected: zeroValuationItems,
      },
      {
        id: 'ongoing-fee-zero-percent',
        reasonCode: 'Ongoing Fee Zero Percent',
        title: 'Ongoing Fee Zero Percent',
        description: 'The plan has an ongoing fee record and a valuation, but the fee percentage is zero, so no monthly ongoing expectation is created.',
        icon: Percent,
        affected: ongoingFeeZeroPercentItems,
      },
      {
        id: 'potential-duplicate',
        reasonCode: 'Potential Duplicate',
        title: 'Potential Duplicate',
        description: 'This policy reference has already been matched (or has a pending match) on another line item within this payment. This line may be a duplicate.',
        icon: Copy,
        affected: potentialDuplicateItems,
      },
    ];
  }, [zohoResults, unmatchedLineItems]);

  const totalAffected = conditionResults.reduce((sum, r) => sum + r.affected.length, 0);
  const currentResult = conditionResults[currentConditionIndex];
  const allDone = checkStatus === 'done' && (
    conditionResults.length === 0 || 
    currentConditionIndex >= conditionResults.length || 
    processedConditions.size === conditionResults.length
  );

  const handleAcceptAll = async () => {
    if (!currentResult || currentResult.affected.length === 0) return;
    setIsProcessing(true);

    const ids = currentResult.affected.map(li => li.id);
    const notes = `Data Check: ${currentResult.title} — ${ids.length} items approved`;

    bulkMarkDataCheckApproved(ids, currentResult.reasonCode, notes);

    setProcessedConditions(prev => new Set([...prev, currentResult.id]));
    setIsProcessing(false);

    if (currentConditionIndex < conditionResults.length - 1) {
      setCurrentConditionIndex(currentConditionIndex + 1);
    }
  };

  const handleSkip = () => {
    if (conditionResults.length > 0) {
      setProcessedConditions(prev => new Set([...prev, conditionResults[currentConditionIndex].id]));
    }
    if (currentConditionIndex < conditionResults.length - 1) {
      setCurrentConditionIndex(currentConditionIndex + 1);
    }
  };

  if (!payment) return null;

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
                Verify {policyReferences.length} unique policy references against the CRM
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onComplete}>
            {allDone ? 'Continue to Manual Match →' : 'Skip to Manual Match →'}
          </Button>
        </div>
      </div>

      {/* Pre-check: Run button */}
      {checkStatus === 'idle' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            <Search className="h-12 w-12 text-primary/50 mx-auto" />
            <h3 className="text-lg font-semibold">Ready to Check Data Conditions</h3>
            <p className="text-sm text-muted-foreground">
              This will verify {policyReferences.length} policy references against the CRM to identify:
            </p>
            <ul className="text-sm text-muted-foreground text-left space-y-2 mx-auto max-w-sm">
              <li className="flex items-start gap-2">
                <FileQuestion className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span><strong>No Plan Found</strong> — Policy reference doesn't exist in Plans</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span><strong>No Fee Record</strong> — Plan exists but has no fee attached</span>
              </li>
              <li className="flex items-start gap-2">
                <CircleDollarSign className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span><strong>Zero Valuation</strong> — Plan valuation is zero, no expectation created</span>
              </li>
              <li className="flex items-start gap-2">
                <Percent className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span><strong>Ongoing Fee Zero Percent</strong> — Fee percentage is zero, no ongoing expectation created</span>
              </li>
              <li className="flex items-start gap-2">
                <Copy className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span><strong>Potential Duplicate</strong> — Policy reference already matched on another line in this payment</span>
              </li>
            </ul>
            <Button onClick={runDataCheck} className="gap-2">
              <Search className="h-4 w-4" />
              Run Data Check
            </Button>
          </div>
        </div>
      )}

      {/* Loading */}
      {checkStatus === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
            <h3 className="text-lg font-semibold">Checking CRM Data...</h3>
            <p className="text-sm text-muted-foreground">
              Verifying {policyReferences.length} policy references against Plans and Fees modules
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {checkStatus === 'error' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h3 className="text-lg font-semibold">Data Check Failed</h3>
            <p className="text-sm text-destructive">{checkError}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={runDataCheck} variant="outline" className="gap-2">
                <Search className="h-4 w-4" />
                Retry
              </Button>
              <Button variant="ghost" onClick={onComplete}>
                Skip to Manual Match
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {checkStatus === 'done' && zohoResults && (
        <>
          {/* Condition Steps */}
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              {conditionResults.map((condition, index) => {
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
                        condition.affected.length > 0
                          ? "bg-destructive/10 text-destructive border-destructive/30"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {condition.affected.length}
                      </Badge>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content */}
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
                  <currentResult.icon className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{currentResult.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{currentResult.description}</p>
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
                      <p className="text-xs text-muted-foreground">No line items match this condition.</p>
                      <Button variant="outline" size="sm" onClick={handleSkip} className="mt-2">
                        Continue
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
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
                    {currentResult.affected.length} items • Reason: <strong className="text-foreground">{currentResult.reasonCode}</strong>
                  </span>
                  <span className="font-bold tabular-nums">
                    {formatCurrency(currentResult.affected.reduce((sum, li) => sum + li.amount, 0))}
                  </span>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
