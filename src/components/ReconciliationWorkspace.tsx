import { useState, useEffect } from 'react';
import { useReconciliationStore } from '@/store/reconciliationStore';
import { PaymentSummary } from './PaymentSummary';
import { ExpectationGrid } from './ExpectationGrid';
import { MatchConfirmation } from './MatchConfirmation';
import { EmptyWorkspace } from './EmptyWorkspace';
import { StatementItemList } from './StatementItemList';
import { PrescreeningMode } from './PrescreeningMode';
import { ArrowLeftRight, Zap, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Threshold for suggesting prescreening mode
const LARGE_PAYMENT_THRESHOLD = 50;

export function ReconciliationWorkspace() {
  const { selectedPaymentId, pendingMatches, getSelectedPayment } = useReconciliationStore();
  const [viewMode, setViewMode] = useState<'auto' | 'standard' | 'prescreening'>('auto');
  const [userOverrode, setUserOverrode] = useState(false);
  
  const payment = getSelectedPayment();
  
  // Reset mode when payment changes
  useEffect(() => {
    setViewMode('auto');
    setUserOverrode(false);
  }, [selectedPaymentId]);
  
  if (!selectedPaymentId) {
    return <EmptyWorkspace />;
  }
  
  const itemCount = payment?.lineItems.length || 0;
  const isLargePayment = itemCount >= LARGE_PAYMENT_THRESHOLD;
  
  // Determine effective view mode
  const effectiveMode = viewMode === 'auto' 
    ? (isLargePayment ? 'prescreening' : 'standard')
    : viewMode;
  
  const handleSwitchToStandard = () => {
    setViewMode('standard');
    setUserOverrode(true);
  };
  
  const handleSwitchToPrescreening = () => {
    setViewMode('prescreening');
    setUserOverrode(true);
  };
  
  // Prescreening mode for large payments
  if (effectiveMode === 'prescreening') {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <PaymentSummary />
        <PrescreeningMode onSwitchToStandard={handleSwitchToStandard} />
        {pendingMatches.length > 0 && <MatchConfirmation />}
      </div>
    );
  }
  
  // Standard two-panel mode
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Payment Summary - Compact Header */}
      <PaymentSummary />
      
      {/* Mode indicator for large payments in standard view */}
      {isLargePayment && userOverrode && (
        <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <List className="h-4 w-4" />
            <span>Standard view ({itemCount} items)</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSwitchToPrescreening}
            className="gap-2"
          >
            <Zap className="h-4 w-4" />
            Switch to Prescreening
          </Button>
        </div>
      )}
      
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
