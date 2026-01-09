import { useReconciliationStore } from '@/store/reconciliationStore';
import { PaymentSummary } from './PaymentSummary';
import { ExpectationGrid } from './ExpectationGrid';
import { MatchConfirmation } from './MatchConfirmation';
import { EmptyWorkspace } from './EmptyWorkspace';
import { StatementItemList } from './StatementItemList';
import { ArrowLeftRight } from 'lucide-react';

export function ReconciliationWorkspace() {
  const { selectedPaymentId, pendingMatches } = useReconciliationStore();
  
  if (!selectedPaymentId) {
    return <EmptyWorkspace />;
  }
  
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Payment Summary - Compact Header */}
      <PaymentSummary />
      
      {/* Two-Panel Reconciliation View */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Statement Items from Provider */}
        <div className="w-1/2 overflow-hidden border-r border-border">
          <StatementItemList />
        </div>
        
        {/* Center Arrow Indicator */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <div className="h-10 w-10 rounded-full bg-background border-2 border-border shadow-lg flex items-center justify-center">
            <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        
        {/* Right: Expectations to Match */}
        <div className="w-1/2 overflow-hidden">
          <ExpectationGrid />
        </div>
      </div>
      
      {/* Match Confirmation Bar */}
      {pendingMatches.length > 0 && (
        <MatchConfirmation />
      )}
    </div>
  );
}
