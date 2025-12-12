import { SessionHeader } from '@/components/SessionHeader';
import { PaymentList } from '@/components/PaymentList';
import { ReconciliationWorkspace } from '@/components/ReconciliationWorkspace';

const Index = () => {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      {/* Top Session Header */}
      <SessionHeader />
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Payment List (25%) */}
        <div className="w-80 xl:w-96 shrink-0 overflow-hidden">
          <PaymentList />
        </div>
        
        {/* Right Panel - Reconciliation Workspace (75%) */}
        <ReconciliationWorkspace />
      </div>
    </div>
  );
};

export default Index;
