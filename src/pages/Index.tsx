import { useState, useEffect } from 'react';
import { SessionHeader } from '@/components/SessionHeader';
import { PaymentList } from '@/components/PaymentList';
import { ReconciliationWorkspace } from '@/components/ReconciliationWorkspace';
import { useReconciliationStore } from '@/store/reconciliationStore';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, List } from 'lucide-react';
import { cn } from '@/lib/utils';

const Index = () => {
  const { selectedPaymentId } = useReconciliationStore();
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  
  // Auto-collapse when a payment is selected
  useEffect(() => {
    if (selectedPaymentId) {
      setIsPanelOpen(false);
    }
  }, [selectedPaymentId]);
  
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      {/* Top Session Header */}
      <SessionHeader />
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Collapsed Panel Toggle */}
        {!isPanelOpen && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPanelOpen(true)}
            className="absolute left-2 top-2 z-20 gap-1 shadow-md"
          >
            <List className="h-4 w-4" />
            <span className="text-xs">Payments</span>
            <ChevronRight className="h-3 w-3" />
          </Button>
        )}
        
        {/* Left Panel - Payment List (Collapsible) */}
        <div 
          className={cn(
            "shrink-0 overflow-hidden transition-all duration-300 ease-in-out border-r border-border",
            isPanelOpen ? "w-80 xl:w-96" : "w-0"
          )}
        >
          <div className="w-80 xl:w-96 h-full relative">
            <PaymentList />
            
            {/* Collapse button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsPanelOpen(false)}
              className="absolute right-2 top-2 h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-muted"
              title="Collapse panel"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Right Panel - Reconciliation Workspace (Full width when collapsed) */}
        <ReconciliationWorkspace />
      </div>
    </div>
  );
};

export default Index;
