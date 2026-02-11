import { cn } from '@/lib/utils';
import { Zap, Search, ArrowLeftRight, CheckCircle2 } from 'lucide-react';

export type WorkflowPhase = 'auto-match' | 'data-checks' | 'manual-match';

interface WorkflowPhasesProps {
  currentPhase: WorkflowPhase;
  onPhaseChange: (phase: WorkflowPhase) => void;
  completedPhases: Set<WorkflowPhase>;
  dataCheckCount?: number;
}

const phases: { id: WorkflowPhase; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'auto-match', label: 'Auto-Match', icon: Zap, description: 'Progressive tolerance matching' },
  { id: 'data-checks', label: 'Data Checks', icon: Search, description: 'Identify known data issues' },
  { id: 'manual-match', label: 'Manual Match', icon: ArrowLeftRight, description: 'Review remaining items' },
];

export function WorkflowPhases({ currentPhase, onPhaseChange, completedPhases, dataCheckCount }: WorkflowPhasesProps) {
  return (
    <div className="px-4 py-2 border-b border-border bg-muted/30">
      <div className="flex items-center gap-1">
        {phases.map((phase, index) => {
          const isCompleted = completedPhases.has(phase.id);
          const isCurrent = currentPhase === phase.id;
          const Icon = phase.icon;

          return (
            <div key={phase.id} className="flex items-center">
              {index > 0 && (
                <div className={cn(
                  "w-8 h-px mx-1",
                  isCompleted || isCurrent ? "bg-primary/50" : "bg-border"
                )} />
              )}
              <button
                onClick={() => onPhaseChange(phase.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                  isCurrent && "bg-primary/10 text-primary font-medium ring-1 ring-primary/30",
                  isCompleted && !isCurrent && "text-success hover:bg-success/5",
                  !isCurrent && !isCompleted && "text-muted-foreground hover:bg-muted/50"
                )}
              >
                {isCompleted && !isCurrent ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Icon className={cn("h-4 w-4", isCurrent ? "text-primary" : "text-muted-foreground")} />
                )}
                <span>{phase.label}</span>
                {phase.id === 'data-checks' && dataCheckCount !== undefined && dataCheckCount > 0 && (
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full font-medium",
                    isCurrent ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {dataCheckCount}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
