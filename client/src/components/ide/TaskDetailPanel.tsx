import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, CheckCircle2, CircleDot, Circle, Loader2, Clock, FileText, GitCommit, AlertCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface TaskDetailPanelProps {
  projectId: string;
  taskId: string;
  onBack: () => void;
}

interface ProjectTask {
  id: string;
  taskNumber: number;
  title: string;
  description: string | null;
  status: string;
  planContent: string | null;
  planWhatAndWhy: string | null;
  planDoneLooksLike: string | null;
  priority: string | null;
  complexity: string | null;
  filesModified: string[] | null;
  checkpointCount: number;
  workDurationSeconds: number;
  reviewStatus: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

const formatDuration = (seconds: number) => {
  if (!seconds) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

export function TaskDetailPanel({ projectId, taskId, onBack }: TaskDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'plan'>('overview');
  const queryClient = useQueryClient();

  const { data: task, isLoading } = useQuery<ProjectTask>({
    queryKey: ['/api/projects', projectId, 'tasks', taskId],
    queryFn: async () => {
      return apiRequest<ProjectTask>('GET', `/api/projects/${projectId}/tasks/${taskId}`);
    },
  });

  const updateTask = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return apiRequest('PATCH', `/api/projects/${projectId}/tasks/${taskId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
    },
  });

  if (isLoading || !task) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    draft: { icon: <Circle className="w-4 h-4" />, label: 'Draft', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
    active: { icon: <Loader2 className="w-4 h-4 animate-spin" />, label: 'Active', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    ready: { icon: <CircleDot className="w-4 h-4" />, label: 'Ready for review', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    done: { icon: <CheckCircle2 className="w-4 h-4" />, label: 'Done', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
  };

  const current = statusConfig[task.status] || statusConfig.draft;

  return (
    <div className="h-full flex flex-col" data-testid="task-detail">
      <div className="px-4 py-3 border-b flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onBack} data-testid="button-back-tasks">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-mono">Task #{task.taskNumber}</span>
            <span className="text-[14px] font-semibold truncate" data-testid="text-task-title">{task.title}</span>
          </div>
        </div>
        <Badge className={cn("text-[10px]", current.color)} data-testid="badge-task-status">
          <span className="mr-1">{current.icon}</span>
          {current.label}
        </Badge>
      </div>

      <div className="px-4 py-2 border-b flex items-center gap-1">
        <Button variant={activeTab === 'overview' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-3 text-[12px]" onClick={() => setActiveTab('overview')}>
          Overview
        </Button>
        <Button variant={activeTab === 'plan' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-3 text-[12px]" onClick={() => setActiveTab('plan')}>
          Plan
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' ? (
          <div className="space-y-4">
            {task.description && (
              <div>
                <h4 className="text-[12px] font-medium text-muted-foreground mb-1">Description</h4>
                <p className="text-[13px]">{task.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3">
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-1">
                  <Clock className="w-3.5 h-3.5" /> Work Duration
                </div>
                <div className="text-[15px] font-semibold" data-testid="text-work-duration">
                  {formatDuration(task.workDurationSeconds)}
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-1">
                  <GitCommit className="w-3.5 h-3.5" /> Checkpoints
                </div>
                <div className="text-[15px] font-semibold" data-testid="text-checkpoints">
                  {task.checkpointCount}
                </div>
              </Card>
            </div>

            {task.filesModified && task.filesModified.length > 0 && (
              <div>
                <h4 className="text-[12px] font-medium text-muted-foreground mb-2">Files Modified</h4>
                <div className="space-y-1">
                  {task.filesModified.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12px] py-1 px-2 rounded bg-muted/50">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-mono">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <h4 className="text-[12px] font-medium text-muted-foreground">Task Updates</h4>

              {task.reviewStatus === 'ready' && (
                <Card className="p-3 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-[13px] font-medium text-green-700 dark:text-green-400">Ready for review</span>
                    <ExternalLink className="w-3.5 h-3.5 text-green-600 ml-auto" />
                  </div>
                  <p className="text-[12px] text-green-700/80 dark:text-green-400/80 mb-3">{task.title}</p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="h-7 text-[11px]" variant="outline" onClick={() => updateTask.mutate({ reviewStatus: null, status: 'done' })} data-testid="button-dismiss-review">
                      Dismiss
                    </Button>
                    <Button size="sm" className="h-7 text-[11px] bg-green-600 hover:bg-green-700 text-white" onClick={() => updateTask.mutate({ reviewStatus: 'applied', status: 'done' })} data-testid="button-apply-changes">
                      Apply changes to main version
                    </Button>
                  </div>
                </Card>
              )}

              <div className="space-y-2 text-[12px]">
                {task.completedAt && (
                  <div className="flex items-center gap-2 py-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    <span>Completed {formatDistanceToNow(new Date(task.completedAt), { addSuffix: true })}</span>
                  </div>
                )}
                {task.checkpointCount > 0 && (
                  <div className="flex items-center gap-2 py-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    <span>Checkpoint made {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}</span>
                  </div>
                )}
                {task.workDurationSeconds > 0 && (
                  <div className="flex items-center gap-2 py-1">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Worked for {formatDuration(task.workDurationSeconds)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 py-1">
                  <Circle className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Created {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {task.planWhatAndWhy ? (
              <>
                <div>
                  <h3 className="text-[15px] font-semibold mb-2">What & Why</h3>
                  <p className="text-[13px] text-foreground/80 whitespace-pre-wrap">{task.planWhatAndWhy}</p>
                </div>
                <Separator />
                {task.planDoneLooksLike && (
                  <div>
                    <h3 className="text-[15px] font-semibold mb-2">Done looks like</h3>
                    <div className="text-[13px] text-foreground/80 whitespace-pre-wrap">{task.planDoneLooksLike}</div>
                  </div>
                )}
              </>
            ) : task.planContent ? (
              <div>
                <h3 className="text-[15px] font-semibold mb-2">Plan</h3>
                <div className="text-[13px] text-foreground/80 whitespace-pre-wrap">{task.planContent}</div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-[13px]">No plan has been created for this task yet.</p>
                <p className="text-[11px] mt-1">Plans are generated when the agent works in Plan mode.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {task.status !== 'done' && (
        <div className="px-4 py-3 border-t flex items-center gap-2">
          {task.status === 'draft' && (
            <Button size="sm" className="text-[12px]" onClick={() => updateTask.mutate({ status: 'active' })} data-testid="button-start-task">
              Start Working
            </Button>
          )}
          {task.status === 'active' && (
            <Button size="sm" className="text-[12px]" onClick={() => updateTask.mutate({ status: 'ready', reviewStatus: 'ready' })} data-testid="button-mark-ready">
              Mark Ready for Review
            </Button>
          )}
          {task.status === 'ready' && (
            <Button size="sm" className="text-[12px]" onClick={() => updateTask.mutate({ status: 'done' })} data-testid="button-mark-done">
              Mark Done
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
