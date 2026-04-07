/**
 * Plan Approval Modal Component
 * 
 * Shows execution plan approval UI immediately after generation.
 * Provides binary Approve/Reject workflow before execution starts.
 * 
 * Features:
 * - Desktop: Full-screen dialog with PlanVisualizer
 * - Mobile: Bottom sheet for compact viewing
 * - Forced decision: Cannot dismiss without approval or rejection
 * - Auto-dismiss on decision
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { PlanVisualizer } from './PlanVisualizer';
import { CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { useMediaQuery } from '@/hooks/use-media-query';

interface Task {
  id: string;
  title: string;
  description: string;
  type: 'file_operation' | 'command' | 'database' | 'configuration' | 'testing' | 'deployment';
  estimatedMinutes: number;
  riskScore: number;
  dependencies: string[];
  requiredTools: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface ExecutionPlan {
  id: string;
  goal: string;
  tasks: Task[];
  totalEstimatedMinutes: number;
  parallelizableTasks: string[][];
  criticalPath: string[];
  riskAssessment: {
    overallRisk: number;
    highRiskTasks: string[];
    mitigationStrategies: string[];
  };
  alternativeApproaches: string[];
  createdAt: Date;
}

interface PlanApprovalModalProps {
  open: boolean;
  plan: ExecutionPlan | null;
  onApprove: (plan: ExecutionPlan) => void;
  onReject: () => void;
  onOpenChange?: (open: boolean) => void;
}

export function PlanApprovalModal({
  open,
  plan,
  onApprove,
  onReject,
  onOpenChange
}: PlanApprovalModalProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  const handleApprove = () => {
    if (plan) {
      onApprove(plan);
    }
  };

  const handleReject = () => {
    onReject();
  };

  if (!plan) return null;

  const content = (
    <>
      <div className="flex-1 overflow-y-auto">
        <PlanVisualizer
          plan={plan}
          onTaskClick={(taskId) => {
          }}
        />
      </div>

      <div className={`flex ${isMobile ? 'flex-col' : 'flex-row-reverse'} gap-2 pt-4 border-t`}>
        <Button
          onClick={handleApprove}
          className="flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
          data-testid="button-approve-plan-modal"
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Approve & Execute
        </Button>
        <Button
          onClick={handleReject}
          variant="outline"
          className="flex-1 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950"
          data-testid="button-reject-plan-modal"
        >
          <XCircle className="h-4 w-4 mr-2" />
          Reject
        </Button>
      </div>
    </>
  );

  // Mobile: Bottom sheet
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(isOpen) => {
        // Prevent closing without decision - only allow close via Approve/Reject buttons
        if (!isOpen) return;
        onOpenChange?.(isOpen);
      }}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0" data-testid="sheet-plan-approval">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Review Execution Plan
            </SheetTitle>
            <SheetDescription>
              Review the AI-generated plan before execution starts.
              {plan.tasks?.length && ` ${plan.tasks.length} tasks, ~${plan.totalEstimatedMinutes} minutes`}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-hidden px-6 py-4">
            {content}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Full dialog
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      // Prevent closing without decision - only allow close via Approve/Reject buttons
      if (!isOpen) return;
      onOpenChange?.(isOpen);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0" data-testid="dialog-plan-approval">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-6 w-6 text-primary" />
            Review Execution Plan
          </DialogTitle>
          <DialogDescription className="text-base">
            The AI has generated a detailed execution plan for your goal: <strong>{plan.goal}</strong>
            <br />
            <span className="text-[13px] text-muted-foreground">
              {plan.tasks?.length} tasks • ~{plan.totalEstimatedMinutes} minutes • Risk: {plan.riskAssessment?.overallRisk}/100
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden px-6 py-4">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
}
