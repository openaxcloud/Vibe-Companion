import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { CheckCircle2, Circle, FileText, Settings, RefreshCw, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface TaskPlan {
  title: string;
  description?: string;
  planWhatAndWhy?: string;
  planDoneLooksLike?: string;
}

interface PlanModeTaskProposalProps {
  projectId: string;
  tasks: TaskPlan[];
  onAccept?: () => void;
  onRevise?: () => void;
  onKeepChatting?: () => void;
  onStartBuilding?: () => void;
  onViewPlan?: (index: number) => void;
  variant?: 'proposal' | 'created';
}

export function PlanModeTaskProposal({
  projectId,
  tasks,
  onAccept,
  onRevise,
  onKeepChatting,
  onStartBuilding,
  onViewPlan,
  variant = 'proposal',
}: PlanModeTaskProposalProps) {
  const [expanded, setExpanded] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createTasks = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/projects/${projectId}/tasks/bulk`, {
        tasks: tasks.map(t => ({
          title: t.title,
          description: t.description,
          status: 'draft',
          planWhatAndWhy: t.planWhatAndWhy,
          planDoneLooksLike: t.planDoneLooksLike,
        })),
      });
    },
    onSuccess: () => {
      setAccepted(true);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
      toast({ title: 'Tasks created', description: `${tasks.length} tasks added to your board` });
      onAccept?.();
    },
  });

  if (variant === 'created') {
    return (
      <Card className="border border-border/60 overflow-hidden" data-testid="task-plans-created">
        <div className="px-4 py-3 flex items-center gap-2 bg-muted/30">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="text-[13px] font-medium">Task plans created</span>
          <Button variant="ghost" size="sm" className="h-6 px-1 ml-auto" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </Button>
        </div>
        {expanded && (
          <div className="divide-y">
            {tasks.map((task, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center justify-between hover:bg-muted/20">
                <span className="text-[13px]">{task.title}</span>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => onViewPlan?.(i)} data-testid={`button-view-plan-${i}`}>
                  <ExternalLink className="w-3 h-3 mr-1" /> View plan
                </Button>
              </div>
            ))}
          </div>
        )}
        {!accepted && (
          <div className="px-4 py-3 border-t bg-muted/10">
            <Button className="w-full h-9 bg-green-600 hover:bg-green-700 text-white text-[13px]" onClick={() => createTasks.mutate()} disabled={createTasks.isPending} data-testid="button-accept-tasks">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Accept tasks
            </Button>
            <div className="flex items-center justify-between mt-2">
              <Button variant="ghost" size="sm" className="text-[11px] text-muted-foreground" onClick={onRevise} data-testid="button-revise-plan">
                <RefreshCw className="w-3 h-3 mr-1" /> Revise plan
              </Button>
              <Button variant="ghost" size="sm" className="text-[11px] text-muted-foreground" data-testid="button-plan-settings">
                <Settings className="w-3 h-3 mr-1" /> Settings
              </Button>
            </div>
          </div>
        )}
        {accepted && (
          <div className="px-4 py-2.5 border-t bg-green-50/50 dark:bg-green-950/20 text-center">
            <span className="text-[12px] text-green-700 dark:text-green-400 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Tasks accepted and added to board
            </span>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="border border-blue-200 dark:border-blue-800/50 overflow-hidden" data-testid="task-proposal">
      <div className="px-4 py-3 bg-blue-50/50 dark:bg-blue-950/20">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-[13px] font-medium">Proposed task list</span>
        </div>
      </div>
      <div className="divide-y">
        {tasks.map((task, i) => (
          <div key={i} className="px-4 py-3 hover:bg-muted/20 cursor-pointer" onClick={() => onViewPlan?.(i)} data-testid={`task-proposal-item-${i}`}>
            <div className="text-[13px] font-medium">{task.title}</div>
            {task.description && (
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
            )}
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t bg-muted/10">
        <p className="text-[12px] text-muted-foreground mb-3">
          Agent has identified a task list to work on. If everything looks good, start building to make these updates to your app.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="flex-1 h-9 text-[13px]" onClick={onKeepChatting} data-testid="button-keep-chatting">
            <FileText className="w-4 h-4 mr-2" /> Keep chatting
          </Button>
          <Button className="flex-1 h-9 text-[13px] bg-blue-600 hover:bg-blue-700 text-white" onClick={() => { createTasks.mutate(); onStartBuilding?.(); }} disabled={createTasks.isPending} data-testid="button-start-building">
            <CheckCircle2 className="w-4 h-4 mr-2" /> Start building
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">Starting will disable Plan mode.</p>
      </div>
    </Card>
  );
}
