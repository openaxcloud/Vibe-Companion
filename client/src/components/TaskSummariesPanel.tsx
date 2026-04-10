import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Plus,
  ListTodo,
  Kanban,
  CheckCircle2,
  Circle,
  Loader2,
  Clock,
  MoreHorizontal,
  Trash2,
  Play,
  Search,
  Sparkles,
  FileText,
  CircleDot,
  ArrowRight,
  ChevronRight,
  LayoutGrid,
  List,
  GitBranch,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';

interface ProjectTask {
  id: string;
  projectId: string;
  userId: string;
  taskNumber: number;
  title: string;
  description: string | null;
  status: string;
  planContent: string | null;
  planWhatAndWhy: string | null;
  planDoneLooksLike: string | null;
  priority: string;
  complexity: string;
  filesModified: string[] | null;
  checkpointCount: number;
  workDurationSeconds: number;
  agentSessionId: string | null;
  reviewStatus: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

type ViewMode = 'list' | 'board';
type TaskStatus = 'draft' | 'active' | 'ready' | 'done';

const STATUS_CONFIG: Record<string, { icon: typeof Circle; label: string; color: string; dotColor: string; borderTop: string }> = {
  draft: { icon: Circle, label: 'Draft', color: 'text-muted-foreground', dotColor: 'bg-gray-400', borderTop: 'border-t-gray-400' },
  active: { icon: Loader2, label: 'In Progress', color: 'text-blue-500', dotColor: 'bg-blue-500', borderTop: 'border-t-blue-500' },
  ready: { icon: CircleDot, label: 'Ready for Review', color: 'text-amber-500', dotColor: 'bg-amber-500', borderTop: 'border-t-amber-500' },
  done: { icon: CheckCircle2, label: 'Done', color: 'text-green-500', dotColor: 'bg-green-500', borderTop: 'border-t-green-500' },
};

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-red-500/10 text-red-500 border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

const NEXT_STATUS: Record<string, TaskStatus> = {
  draft: 'active',
  active: 'ready',
  ready: 'done',
  done: 'draft',
};

interface TaskSummariesPanelProps {
  projectId: string | number;
}

export function TaskSummariesPanel({ projectId }: TaskSummariesPanelProps) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewMode>('list');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');

  const { data: tasks = [], isLoading } = useQuery<ProjectTask[]>({
    queryKey: ['/api/projects', projectId, 'tasks'],
    queryFn: async () => {
      const data = await apiRequest<ProjectTask[]>('GET', `/api/projects/${projectId}/tasks`);
      return data || [];
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (task: { title: string; description: string; priority: string }) => {
      return apiRequest('POST', `/api/projects/${projectId}/tasks`, task);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
      setShowCreateDialog(false);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskPriority('medium');
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Record<string, any> }) => {
      return apiRequest('PATCH', `/api/projects/${projectId}/tasks/${taskId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
      if (selectedTask) setSelectedTask(null);
    },
  });

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [tasks, filterStatus, searchQuery]);

  const stats = useMemo(() => ({
    total: tasks.length,
    draft: tasks.filter(t => t.status === 'draft').length,
    active: tasks.filter(t => t.status === 'active').length,
    ready: tasks.filter(t => t.status === 'ready').length,
    done: tasks.filter(t => t.status === 'done').length,
  }), [tasks]);

  const completionPercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="tasks-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (selectedTask) {
    return (
      <TaskDetailView
        task={selectedTask}
        projectId={String(projectId)}
        onBack={() => setSelectedTask(null)}
        onUpdate={(updates) => {
          updateTaskMutation.mutate({ taskId: selectedTask.id, updates });
          setSelectedTask({ ...selectedTask, ...updates });
        }}
        onDelete={() => deleteTaskMutation.mutate(selectedTask.id)}
        formatDuration={formatDuration}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-background" data-testid="task-summaries-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[14px] font-semibold">Tasks</h2>
          {stats.total > 0 && (
            <Badge variant="secondary" className="text-[11px] h-5" data-testid="task-count-badge">
              {stats.total}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center border border-border rounded-md mr-1">
            <Button
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 w-6 p-0 rounded-r-none"
              onClick={() => setView('list')}
              data-testid="view-list-button"
            >
              <List className="h-3 w-3" />
            </Button>
            <Button
              variant={view === 'board' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 w-6 p-0 rounded-l-none"
              onClick={() => setView('board')}
              data-testid="view-board-button"
            >
              <LayoutGrid className="h-3 w-3" />
            </Button>
          </div>
          <Button
            variant="default"
            size="sm"
            className="h-7 gap-1 text-[12px]"
            onClick={() => setShowCreateDialog(true)}
            data-testid="create-task-button"
          >
            <Plus className="h-3.5 w-3.5" />
            New Task
          </Button>
        </div>
      </div>

      {stats.total > 0 && (
        <div className="px-4 py-2.5 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground font-medium">{completionPercent}% complete</span>
            <span className="text-[11px] text-muted-foreground">{stats.done}/{stats.total} done</span>
          </div>
          <Progress value={completionPercent} className="h-1.5" data-testid="completion-progress" />
          <div className="flex items-center gap-3 mt-2">
            {(['draft', 'active', 'ready', 'done'] as const).map(s => {
              const config = STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
                  className={cn(
                    "flex items-center gap-1.5 text-[11px] transition-colors rounded px-1.5 py-0.5",
                    filterStatus === s
                      ? cn(config.color, "bg-muted font-medium")
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  data-testid={`filter-status-${s}`}
                >
                  <div className={cn("w-1.5 h-1.5 rounded-full", config.dotColor)} />
                  <span>{config.label}</span>
                  <span className="tabular-nums">{stats[s]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {stats.total > 0 && (
        <div className="px-4 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="h-7 pl-8 text-[12px]"
              data-testid="search-tasks-input"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto min-h-0">
        {filteredTasks.length === 0 ? (
          <EmptyState
            hasAnyTasks={stats.total > 0}
            onCreateTask={() => setShowCreateDialog(true)}
          />
        ) : view === 'list' ? (
          <TaskListView
            tasks={filteredTasks}
            onSelect={setSelectedTask}
            onStatusToggle={(task) => {
              updateTaskMutation.mutate({
                taskId: task.id,
                updates: { status: NEXT_STATUS[task.status] || 'draft' },
              });
            }}
            onDelete={(taskId) => deleteTaskMutation.mutate(taskId)}
            onStatusChange={(taskId, status) => updateTaskMutation.mutate({ taskId, updates: { status } })}
            formatDuration={formatDuration}
          />
        ) : (
          <TaskBoardView
            tasks={filteredTasks}
            onSelect={setSelectedTask}
            onStatusChange={(taskId, status) => updateTaskMutation.mutate({ taskId, updates: { status } })}
            onDelete={(taskId) => deleteTaskMutation.mutate(taskId)}
          />
        )}
      </div>

      <CreateTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        title={newTaskTitle}
        setTitle={setNewTaskTitle}
        description={newTaskDescription}
        setDescription={setNewTaskDescription}
        priority={newTaskPriority}
        setPriority={setNewTaskPriority}
        isPending={createTaskMutation.isPending}
        onSubmit={() => createTaskMutation.mutate({
          title: newTaskTitle.trim(),
          description: newTaskDescription.trim(),
          priority: newTaskPriority,
        })}
      />
    </div>
  );
}

function EmptyState({ hasAnyTasks, onCreateTask }: { hasAnyTasks: boolean; onCreateTask: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-6" data-testid="tasks-empty-state">
      {!hasAnyTasks ? (
        <>
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <div className="text-center max-w-[260px]">
            <p className="text-[14px] font-semibold">Plan your work</p>
            <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">
              Break your project into tasks. Work on them one at a time, or let the AI agent handle them in parallel.
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5 text-[12px] mt-1"
            onClick={onCreateTask}
            data-testid="empty-create-task-button"
          >
            <Plus className="h-3.5 w-3.5" />
            Create First Task
          </Button>
        </>
      ) : (
        <p className="text-[12px] text-muted-foreground">No tasks match your filter</p>
      )}
    </div>
  );
}

function TaskListView({
  tasks,
  onSelect,
  onStatusToggle,
  onDelete,
  onStatusChange,
  formatDuration,
}: {
  tasks: ProjectTask[];
  onSelect: (task: ProjectTask) => void;
  onStatusToggle: (task: ProjectTask) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
  formatDuration: (s: number) => string;
}) {
  return (
    <div className="divide-y divide-border" data-testid="task-list">
      {tasks.map(task => {
        const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.draft;
        const StatusIcon = config.icon;
        return (
          <div
            key={task.id}
            className="px-4 py-3 hover:bg-muted/40 transition-colors group cursor-pointer"
            onClick={() => onSelect(task)}
            data-testid={`task-item-${task.id}`}
          >
            <div className="flex items-start gap-3">
              <button
                className="mt-0.5 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusToggle(task);
                }}
                data-testid={`task-status-toggle-${task.id}`}
              >
                <StatusIcon className={cn("h-4 w-4 transition-colors", config.color, task.status === 'active' && "animate-spin")} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono">#{task.taskNumber}</span>
                  <span className={cn(
                    "text-[13px] font-medium truncate",
                    task.status === 'done' && "line-through text-muted-foreground"
                  )}>
                    {task.title}
                  </span>
                </div>
                {task.description && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5 capitalize", PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.medium)}>
                    {task.priority}
                  </Badge>
                  {task.complexity && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
                      {task.complexity}
                    </Badge>
                  )}
                  {task.filesModified && task.filesModified.length > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      {task.filesModified.length} files
                    </span>
                  )}
                  {task.workDurationSeconds > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDuration(task.workDurationSeconds)}
                    </span>
                  )}
                  {task.reviewStatus === 'ready' && (
                    <Badge className="text-[10px] h-4 px-1.5 bg-green-500/10 text-green-600 border-green-500/20">
                      Review ready
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`task-menu-${task.id}`}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {task.status !== 'active' && (
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, 'active'); }}>
                        <Play className="h-3.5 w-3.5 mr-2" />
                        Start Working
                      </DropdownMenuItem>
                    )}
                    {task.status !== 'done' && (
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, 'done'); }}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                        Mark Done
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskBoardView({
  tasks,
  onSelect,
  onStatusChange,
  onDelete,
}: {
  tasks: ProjectTask[];
  onSelect: (task: ProjectTask) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onDelete: (taskId: string) => void;
}) {
  const columns: { key: TaskStatus; label: string }[] = [
    { key: 'draft', label: 'Draft' },
    { key: 'active', label: 'In Progress' },
    { key: 'ready', label: 'Review' },
    { key: 'done', label: 'Done' },
  ];

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, ProjectTask[]> = { draft: [], active: [], ready: [], done: [] };
    for (const task of tasks) {
      const s = (task.status as TaskStatus) || 'draft';
      if (grouped[s]) grouped[s].push(task);
    }
    return grouped;
  }, [tasks]);

  return (
    <div className="flex gap-3 p-3 h-full overflow-x-auto" data-testid="task-board-view">
      {columns.map(col => {
        const config = STATUS_CONFIG[col.key];
        const colTasks = tasksByStatus[col.key];
        return (
          <div key={col.key} className={cn("flex flex-col min-w-[220px] flex-1 rounded-lg bg-muted/20 border-t-2", config.borderTop)}>
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", config.dotColor)} />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{col.label}</span>
              </div>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{colTasks.length}</Badge>
            </div>
            <div className="flex-1 overflow-auto px-2 pb-2 space-y-2">
              {colTasks.map(task => (
                <div
                  key={task.id}
                  className="bg-background border border-border rounded-lg p-2.5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => onSelect(task)}
                  data-testid={`board-task-${task.id}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-muted-foreground font-mono">#{task.taskNumber}</span>
                      <p className={cn("text-[12px] font-medium mt-0.5 line-clamp-2 leading-snug", task.status === 'done' && 'line-through text-muted-foreground')}>
                        {task.title}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {columns.filter(c => c.key !== col.key).map(target => (
                          <DropdownMenuItem key={target.key} onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, target.key); }}>
                            <ArrowRight className="h-3 w-3 mr-2" />
                            {target.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}>
                          <Trash2 className="h-3 w-3 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Badge variant="outline" className={cn("text-[9px] h-3.5 px-1 capitalize", PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.medium)}>
                      {task.priority}
                    </Badge>
                    {task.reviewStatus === 'ready' && (
                      <Badge className="text-[9px] h-3.5 px-1 bg-green-500/10 text-green-600 border-green-500/20">
                        Review
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {colTasks.length === 0 && (
                <div className="text-center text-[11px] text-muted-foreground py-6 border border-dashed border-border/50 rounded-lg">
                  No tasks
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskDetailView({
  task,
  projectId,
  onBack,
  onUpdate,
  onDelete,
  formatDuration,
}: {
  task: ProjectTask;
  projectId: string;
  onBack: () => void;
  onUpdate: (updates: Record<string, any>) => void;
  onDelete: () => void;
  formatDuration: (s: number) => string;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'plan'>('overview');
  const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.draft;
  const StatusIcon = config.icon;

  return (
    <div className="flex flex-col h-full bg-background" data-testid="task-detail-view">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onBack} data-testid="back-to-tasks-button">
          <ArrowRight className="h-4 w-4 rotate-180" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono">#{task.taskNumber}</span>
            <span className="text-[14px] font-semibold truncate">{task.title}</span>
          </div>
        </div>
        <Badge variant="outline" className={cn("text-[10px] gap-1", config.color)}>
          <StatusIcon className={cn("h-3 w-3", task.status === 'active' && "animate-spin")} />
          {config.label}
        </Badge>
      </div>

      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border">
        <Button
          variant={activeTab === 'overview' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 text-[12px] px-3"
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </Button>
        <Button
          variant={activeTab === 'plan' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 text-[12px] px-3"
          onClick={() => setActiveTab('plan')}
        >
          Plan
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'overview' ? (
          <div className="space-y-4">
            {task.description && (
              <div>
                <h4 className="text-[12px] font-medium text-muted-foreground mb-1">Description</h4>
                <p className="text-[13px] leading-relaxed">{task.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  Duration
                </div>
                <div className="text-[14px] font-semibold">{formatDuration(task.workDurationSeconds)}</div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                  <GitBranch className="w-3.5 h-3.5" />
                  Checkpoints
                </div>
                <div className="text-[14px] font-semibold">{task.checkpointCount}</div>
              </Card>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("text-[10px] capitalize", PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.medium)}>
                Priority: {task.priority}
              </Badge>
              {task.complexity && (
                <Badge variant="outline" className="text-[10px] capitalize">
                  Complexity: {task.complexity}
                </Badge>
              )}
            </div>

            {task.filesModified && task.filesModified.length > 0 && (
              <div>
                <h4 className="text-[12px] font-medium text-muted-foreground mb-2">Files Modified ({task.filesModified.length})</h4>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {task.filesModified.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] py-1.5 px-2.5 rounded bg-muted/50 font-mono">
                      <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {task.reviewStatus === 'ready' && (
              <>
                <Separator />
                <Card className="p-4 border-green-500/30 bg-green-500/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-green-500" />
                    <span className="text-[13px] font-medium">Ready for review</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground mb-3">
                    This task's changes are ready to be applied to the main version.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[11px]"
                      onClick={() => onUpdate({ reviewStatus: null, status: 'active' })}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      className="text-[11px] bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => onUpdate({ reviewStatus: 'applied', status: 'done' })}
                      data-testid="apply-changes-button"
                    >
                      Apply changes to main version
                    </Button>
                  </div>
                </Card>
              </>
            )}

            <Separator />

            <div className="space-y-1.5">
              <h4 className="text-[12px] font-medium text-muted-foreground mb-1">Timeline</h4>
              {task.completedAt && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  Completed {formatDistanceToNow(new Date(task.completedAt), { addSuffix: true })}
                </div>
              )}
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                Updated {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Circle className="w-3.5 h-3.5" />
                Created {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {task.planWhatAndWhy ? (
              <>
                <div>
                  <h3 className="text-[14px] font-semibold mb-2">What & Why</h3>
                  <p className="text-[13px] text-foreground/80 whitespace-pre-wrap leading-relaxed">{task.planWhatAndWhy}</p>
                </div>
                {task.planDoneLooksLike && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-[14px] font-semibold mb-2">Done looks like</h3>
                      <p className="text-[13px] text-foreground/80 whitespace-pre-wrap leading-relaxed">{task.planDoneLooksLike}</p>
                    </div>
                  </>
                )}
              </>
            ) : task.planContent ? (
              <div>
                <h3 className="text-[14px] font-semibold mb-2">Plan</h3>
                <p className="text-[13px] text-foreground/80 whitespace-pre-wrap leading-relaxed">{task.planContent}</p>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-[13px] font-medium">No plan yet</p>
                <p className="text-[11px] mt-1">Plans are generated when the agent works on this task.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {task.status !== 'done' && (
        <div className="px-4 py-3 border-t border-border flex items-center gap-2">
          {task.status === 'draft' && (
            <Button size="sm" className="text-[12px] gap-1" onClick={() => onUpdate({ status: 'active' })} data-testid="start-task-button">
              <Play className="h-3.5 w-3.5" />
              Start Working
            </Button>
          )}
          {task.status === 'active' && (
            <Button size="sm" className="text-[12px] gap-1" onClick={() => onUpdate({ status: 'ready', reviewStatus: 'ready' })} data-testid="mark-ready-button">
              <CircleDot className="h-3.5 w-3.5" />
              Mark Ready for Review
            </Button>
          )}
          {task.status === 'ready' && (
            <Button size="sm" className="text-[12px] gap-1" onClick={() => onUpdate({ status: 'done' })} data-testid="mark-done-button">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark Done
            </Button>
          )}
          <Button variant="outline" size="sm" className="text-[12px] gap-1 text-destructive ml-auto" onClick={onDelete} data-testid="delete-task-detail-button">
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}

function CreateTaskDialog({
  open,
  onOpenChange,
  title,
  setTitle,
  description,
  setDescription,
  priority,
  setPriority,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  priority: string;
  setPriority: (v: string) => void;
  isPending: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" data-testid="create-task-dialog">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Create New Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-[12px] text-muted-foreground mb-1 block">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="text-[13px]"
              data-testid="new-task-title-input"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && title.trim() && onSubmit()}
            />
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground mb-1 block">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, context, or acceptance criteria..."
              className="text-[13px] min-h-[80px]"
              data-testid="new-task-description-input"
            />
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground mb-1 block">Priority</label>
            <div className="flex gap-2">
              {['low', 'medium', 'high'].map(p => (
                <Button
                  key={p}
                  variant={priority === p ? 'default' : 'outline'}
                  size="sm"
                  className="text-[12px] h-7 capitalize flex-1"
                  onClick={() => setPriority(p)}
                  data-testid={`priority-${p}-button`}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-[12px]">
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-[12px] gap-1"
            disabled={!title.trim() || isPending}
            onClick={onSubmit}
            data-testid="submit-create-task-button"
          >
            {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
