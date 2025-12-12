import { useReconciliationStore } from '@/store/reconciliationStore';
import { PaymentSummary } from './PaymentSummary';
import { ExpectationGrid } from './ExpectationGrid';
import { MatchConfirmation } from './MatchConfirmation';
import { EmptyWorkspace } from './EmptyWorkspace';

export function ReconciliationWorkspace() {
  const { selectedPaymentId, pendingMatchExpectationIds } = useReconciliationStore();
  
  if (!selectedPaymentId) {
    return <EmptyWorkspace />;
  }
  
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Payment Summary */}
      <PaymentSummary />
      
      {/* Expectations Grid */}
      <div className="flex-1 overflow-hidden">
        <ExpectationGrid />
      </div>
      
      {/* Match Confirmation Bar */}
      {pendingMatchExpectationIds.length > 0 && (
        <MatchConfirmation />
      )}
    </div>
  );
}
