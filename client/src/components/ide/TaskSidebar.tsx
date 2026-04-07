import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Plus, CheckCircle2, CircleDot, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskSidebarProps {
  projectId: string;
  onTaskSelect?: (taskId: string) => void;
  onNewTask?: () => void;
  onOpenBoard?: () => void;
  selectedTaskId?: string;
}

interface ProjectTask {
  id: string;
  taskNumber: number;
  title: string;
  status: string;
}

const statusIcon = (status: string) => {
  switch (status) {
    case 'active': return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />;
    case 'ready': return <CircleDot className="w-3.5 h-3.5 text-green-500 shrink-0" />;
    case 'done': return <CheckCircle2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />;
    default: return <Circle className="w-3.5 h-3.5 text-gray-400 shrink-0" />;
  }
};

export function TaskSidebar({ projectId, onTaskSelect, onNewTask, onOpenBoard, selectedTaskId }: TaskSidebarProps) {
  const { data: tasks = [] } = useQuery<ProjectTask[]>({
    queryKey: ['/api/projects', projectId, 'tasks'],
    queryFn: async () => {
      try {
        return await apiRequest<ProjectTask[]>('GET', `/api/projects/${projectId}/tasks`);
      } catch { return []; }
    },
  });

  const activeTasks = tasks.filter(t => t.status !== 'done');
  const doneTasks = tasks.filter(t => t.status === 'done');

  return (
    <div className="flex flex-col h-full" data-testid="task-sidebar">
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">Tasks</span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onNewTask} data-testid="button-sidebar-new-task">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {tasks.length === 0 && (
          <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
            No tasks yet. Use Plan mode to create tasks.
          </div>
        )}

        {activeTasks.map(task => (
          <div
            key={task.id}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/50 text-[12px]",
              selectedTaskId === task.id && "bg-muted"
            )}
            onClick={() => onTaskSelect?.(task.id)}
            data-testid={`sidebar-task-${task.id}`}
          >
            {statusIcon(task.status)}
            <span className="text-muted-foreground font-mono shrink-0">#{task.taskNumber}</span>
            <span className="truncate">{task.title}</span>
          </div>
        ))}

        {doneTasks.length > 0 && (
          <>
            <div className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wide mt-2">
              Completed ({doneTasks.length})
            </div>
            {doneTasks.slice(0, 5).map(task => (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/50 text-[12px] opacity-60",
                  selectedTaskId === task.id && "bg-muted opacity-100"
                )}
                onClick={() => onTaskSelect?.(task.id)}
                data-testid={`sidebar-task-${task.id}`}
              >
                {statusIcon(task.status)}
                <span className="text-muted-foreground font-mono shrink-0">#{task.taskNumber}</span>
                <span className="truncate">{task.title}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {onOpenBoard && (
        <div className="px-3 py-2 border-t">
          <Button variant="ghost" size="sm" className="w-full h-7 text-[11px] text-muted-foreground" onClick={onOpenBoard} data-testid="button-open-board">
            View Task Board
          </Button>
        </div>
      )}
    </div>
  );
}
