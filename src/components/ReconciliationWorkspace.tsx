import { useState, useEffect, useMemo } from 'react';
import { useReconciliationStore } from '@/store/reconciliationStore';
import { PaymentSummary } from './PaymentSummary';
import { ExpectationGrid } from './ExpectationGrid';
import { MatchConfirmation } from './MatchConfirmation';
import { EmptyWorkspace } from './EmptyWorkspace';
import { StatementItemList } from './StatementItemList';
import { PrescreeningMode } from './PrescreeningMode';
import { DataCheckMode } from './DataCheckMode';
import { WorkflowPhases, type WorkflowPhase } from './WorkflowPhases';
import { ArrowLeftRight } from 'lucide-react';

// Threshold for suggesting prescreening mode
const LARGE_PAYMENT_THRESHOLD = 50;

export function ReconciliationWorkspace() {
  const { selectedPaymentId, pendingMatches, getSelectedPayment } = useReconciliationStore();
  const [currentPhase, setCurrentPhase] = useState<WorkflowPhase>('auto-match');
  const [completedPhases, setCompletedPhases] = useState<Set<WorkflowPhase>>(new Set());
  
  const payment = getSelectedPayment();
  
  // Reset phase when payment changes
  useEffect(() => {
    const itemCount = payment?.lineItems.length || 0;
    const isLarge = itemCount >= LARGE_PAYMENT_THRESHOLD;
    setCurrentPhase(isLarge ? 'auto-match' : 'manual-match');
    setCompletedPhases(new Set());
  }, [selectedPaymentId]);
  
  // Count data check issues for badge
  const dataCheckCount = useMemo(() => {
    if (!payment) return 0;
    const { expectations } = useReconciliationStore.getState();
    const allPlanRefs = new Set<string>();
    expectations.forEach(e => {
      if (e.planReference?.trim()) allPlanRefs.add(e.planReference);
    });
    const unmatched = payment.lineItems.filter(li => li.status === 'unmatched');
    // Count items with plan refs not found in any expectation
    const noPlans = unmatched.filter(li => li.planReference?.trim() && !allPlanRefs.has(li.planReference));
    return noPlans.length;
  }, [payment?.lineItems]);
  
  if (!selectedPaymentId) {
    return <EmptyWorkspace />;
  }
  
  const handlePhaseChange = (phase: WorkflowPhase) => {
    setCurrentPhase(phase);
  };
  
  const handleAutoMatchComplete = () => {
    setCompletedPhases(prev => new Set([...prev, 'auto-match']));
    setCurrentPhase('data-checks');
  };
  
  const handleDataCheckComplete = () => {
    setCompletedPhases(prev => new Set([...prev, 'data-checks']));
    setCurrentPhase('manual-match');
  };
  
  const itemCount = payment?.lineItems.length || 0;
  const isLargePayment = itemCount >= LARGE_PAYMENT_THRESHOLD;
  
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <PaymentSummary />
      
      {/* Workflow Phases Bar */}
      <WorkflowPhases
        currentPhase={currentPhase}
        onPhaseChange={handlePhaseChange}
        completedPhases={completedPhases}
        dataCheckCount={dataCheckCount}
      />
      
      {/* Phase Content */}
      {currentPhase === 'auto-match' && isLargePayment ? (
        <>
          <PrescreeningMode onSwitchToStandard={handleAutoMatchComplete} />
          {pendingMatches.length > 0 && <MatchConfirmation />}
        </>
      ) : currentPhase === 'data-checks' ? (
        <DataCheckMode onComplete={handleDataCheckComplete} />
      ) : (
        <>
          {/* Standard two-panel mode */}
          <div className="flex-1 flex overflow-hidden relative">
            <div className="w-1/2 overflow-hidden border-r border-border">
              <StatementItemList />
            </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
              <div className="h-10 w-10 rounded-full bg-background border-2 border-border shadow-lg flex items-center justify-center">
                <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
            <div className="w-1/2 overflow-hidden">
              <ExpectationGrid />
            </div>
          </div>
          {pendingMatches.length > 0 && <MatchConfirmation />}
        </>
      )}
    </div>
  );
}
