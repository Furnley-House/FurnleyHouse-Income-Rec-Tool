import { MousePointerClick, ArrowLeft, FileCheck, Sparkles } from 'lucide-react';

export function EmptyWorkspace() {
  return (
    <div className="flex-1 flex items-center justify-center bg-background p-8">
      <div className="max-w-md text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
          <MousePointerClick className="h-10 w-10 text-primary" />
        </div>
        
        {/* Title */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Select a Payment to Start
          </h2>
          <p className="text-muted-foreground">
            Choose a payment from the list on the left to begin reconciling
          </p>
        </div>
        
        {/* Instructions */}
        <div className="bg-card rounded-xl border border-border p-6 text-left space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            How to Reconcile
          </h3>
          
          <div className="space-y-3">
            <Step 
              number={1}
              title="Select a payment"
              description="Click on any unreconciled payment from the list"
            />
            <Step 
              number={2}
              title="Match expectations"
              description="Select the expectations that correspond to this payment"
            />
            <Step 
              number={3}
              title="Confirm the match"
              description="Review the variance and confirm the reconciliation"
            />
            <Step 
              number={4}
              title="Move to next"
              description="Continue with the next unreconciled payment"
            />
          </div>
        </div>
        
        {/* Tip */}
        <div className="flex items-start gap-3 text-left bg-primary/5 rounded-lg p-4 border border-primary/20">
          <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground text-sm">Pro Tip</p>
            <p className="text-sm text-muted-foreground">
              Use the "Auto Match" button to automatically find matching expectations within your tolerance threshold.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StepProps {
  number: number;
  title: string;
  description: string;
}

function Step({ number, title, description }: StepProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
        {number}
      </div>
      <div>
        <p className="font-medium text-foreground text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
