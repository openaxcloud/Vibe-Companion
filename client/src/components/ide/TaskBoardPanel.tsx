import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Search, Plus, LayoutGrid, List, Minus, MoreVertical, Clock, FileText, CheckCircle2, CircleDot, Circle, Loader2, ArrowRight, Trash2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface TaskBoardPanelProps {
  projectId: string;
  onTaskSelect?: (taskId: string) => void;
}

type TaskStatus = 'draft' | 'active' | 'ready' | 'done';
type ViewMode = 'board' | 'sidebar' | 'mini';

interface ProjectTask {
  id: string;
  projectId: string;
  userId: string;
  taskNumber: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  planContent: string | null;
  planWhatAndWhy: string | null;
  planDoneLooksLike: string | null;
  priority: string | null;
  complexity: string | null;
  filesModified: string[] | null;
  checkpointCount: number;
  workDurationSeconds: number;
  agentSessionId: string | null;
  reviewStatus: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

const STATUS_COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'draft', label: 'Drafts', color: 'text-gray-500' },
  { id: 'active', label: 'Active', color: 'text-blue-500' },
  { id: 'ready', label: 'Ready', color: 'text-green-500' },
  { id: 'done', label: 'Done', color: 'text-gray-400' },
];

const statusIcon = (status: TaskStatus) => {
  switch (status) {
    case 'draft': return <Circle className="w-4 h-4 text-gray-400" />;
    case 'active': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case 'ready': return <CircleDot className="w-4 h-4 text-green-500" />;
    case 'done': return <CheckCircle2 className="w-4 h-4 text-gray-400" />;
  }
};

export function TaskBoardPanel({ projectId, onTaskSelect }: TaskBoardPanelProps) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [filter, setFilter] = useState<'all' | 'plans' | 'tasks' | 'mine'>('all');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery<ProjectTask[]>({
    queryKey: ['/api/projects', projectId, 'tasks'],
    queryFn: async () => {
      try {
        return await apiRequest<ProjectTask[]>('GET', `/api/projects/${projectId}/tasks`);
      } catch { return []; }
    },
  });

  const createTask = useMutation({
    mutationFn: async (data: { title: string; status?: string }) => {
      return apiRequest('POST', `/api/projects/${projectId}/tasks`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
      setNewTaskTitle('');
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ taskId, ...data }: { taskId: string; status?: string; title?: string }) => {
      return apiRequest('PATCH', `/api/projects/${projectId}/tasks/${taskId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
    },
  });

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
    }
    if (filter === 'plans') result = result.filter(t => t.planContent);
    if (filter === 'tasks') result = result.filter(t => !t.planContent);
    return result;
  }, [tasks, search, filter]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, ProjectTask[]> = { draft: [], active: [], ready: [], done: [] };
    for (const task of filteredTasks) {
      const s = (task.status as TaskStatus) || 'draft';
      if (grouped[s]) grouped[s].push(task);
    }
    return grouped;
  }, [filteredTasks]);

  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) return;
    createTask.mutate({ title: newTaskTitle.trim() });
  };

  const handleMoveTask = (taskId: string, newStatus: TaskStatus) => {
    updateTask.mutate({ taskId, status: newStatus });
  };

  const renderTaskCard = (task: ProjectTask) => (
    <Card
      key={task.id}
      className="p-3 cursor-pointer hover:shadow-md transition-shadow border border-border/50 group"
      onClick={() => onTaskSelect?.(task.id)}
      data-testid={`task-card-${task.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {statusIcon(task.status as TaskStatus)}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground font-mono">#{task.taskNumber}</span>
              <span className="text-[13px] font-medium truncate">{task.title}</span>
            </div>
            {task.description && (
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {STATUS_COLUMNS.filter(c => c.id !== task.status).map(col => (
              <DropdownMenuItem key={col.id} onClick={(e) => { e.stopPropagation(); handleMoveTask(task.id, col.id); }}>
                <ArrowRight className="w-3.5 h-3.5 mr-2" />
                Move to {col.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); deleteTask.mutate(task.id); }}>
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {task.createdAt ? formatDistanceToNow(new Date(task.createdAt), { addSuffix: false }) : ''}
        </span>
        {task.planContent && (
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            Has plan
          </span>
        )}
      </div>
    </Card>
  );

  if (viewMode === 'mini') {
    return (
      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold">Tasks</span>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setViewMode('board')}>
            <LayoutGrid className="w-3 h-3 mr-1" /> Board
          </Button>
        </div>
        {filteredTasks.slice(0, 5).map(task => (
          <div key={task.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer text-[12px]" onClick={() => onTaskSelect?.(task.id)} data-testid={`task-mini-${task.id}`}>
            {statusIcon(task.status as TaskStatus)}
            <span className="text-muted-foreground font-mono">#{task.taskNumber}</span>
            <span className="truncate flex-1">{task.title}</span>
          </div>
        ))}
        {filteredTasks.length > 5 && <div className="text-[11px] text-muted-foreground text-center">+{filteredTasks.length - 5} more</div>}
      </div>
    );
  }

  if (viewMode === 'sidebar') {
    return (
      <div className="h-full flex flex-col">
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <span className="text-[13px] font-semibold">Tasks</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setViewMode('board')} data-testid="view-board"><LayoutGrid className="w-3 h-3" /></Button>
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setViewMode('mini')} data-testid="view-mini"><Minus className="w-3 h-3" /></Button>
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..." className="h-7 pl-7 text-[12px]" data-testid="search-tasks" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
          {filteredTasks.map(task => (
            <div key={task.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer" onClick={() => onTaskSelect?.(task.id)} data-testid={`task-sidebar-${task.id}`}>
              {statusIcon(task.status as TaskStatus)}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[12px]">
                  <span className="text-muted-foreground font-mono">#{task.taskNumber}</span>
                  <span className="truncate font-medium">{task.title}</span>
                </div>
              </div>
              <Badge variant="outline" className="text-[9px] h-4 px-1.5">{task.status}</Badge>
            </div>
          ))}
        </div>
        <div className="px-3 py-2 border-t">
          <div className="flex gap-1.5">
            <Input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Plan a new task..." className="h-7 text-[12px]" onKeyDown={e => e.key === 'Enter' && handleCreateTask()} data-testid="input-new-task" />
            <Button size="sm" className="h-7 px-2" onClick={handleCreateTask} disabled={!newTaskTitle.trim()} data-testid="button-create-task"><Plus className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background" data-testid="task-board">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-semibold" data-testid="text-board-title">Tasks</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..." className="h-8 w-48 pl-8 text-[12px]" data-testid="search-tasks-board" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md">
            <Button variant={viewMode === 'board' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2 rounded-r-none" onClick={() => setViewMode('board')} data-testid="view-mode-board"><LayoutGrid className="w-3.5 h-3.5" /></Button>
            <Button variant={viewMode === 'sidebar' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2 rounded-none border-x" onClick={() => setViewMode('sidebar')} data-testid="view-mode-sidebar"><List className="w-3.5 h-3.5" /></Button>
            <Button variant={viewMode === 'mini' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2 rounded-l-none" onClick={() => setViewMode('mini')} data-testid="view-mode-mini"><Minus className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-b flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">Filters</span>
        {(['all', 'plans', 'tasks', 'mine'] as const).map(f => (
          <Button key={f} variant={filter === f ? 'secondary' : 'ghost'} size="sm" className="h-6 px-2 text-[11px]" onClick={() => setFilter(f)} data-testid={`filter-${f}`}>
            {f === 'all' ? 'All' : f === 'plans' ? 'Plans' : f === 'tasks' ? 'Tasks' : 'Created by me'}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 p-4 h-full min-w-max">
          {STATUS_COLUMNS.map(col => {
            const colTasks = tasksByStatus[col.id];
            return (
              <div key={col.id} className="w-72 flex flex-col" data-testid={`column-${col.id}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn("text-[13px] font-semibold", col.color)}>{col.label}</span>
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5">{colTasks.length}</Badge>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {colTasks.map(renderTaskCard)}
                  {colTasks.length === 0 && (
                    <div className="text-center text-[12px] text-muted-foreground py-8 border border-dashed rounded-lg">
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-3 border-t">
        <div className="flex gap-2 max-w-md">
          <Input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Plan a new task..." className="h-8 text-[12px]" onKeyDown={e => e.key === 'Enter' && handleCreateTask()} data-testid="input-plan-task" />
          <Button size="sm" className="h-8" onClick={handleCreateTask} disabled={!newTaskTitle.trim() || createTask.isPending} data-testid="button-plan-task">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
        </div>
      </div>
    </div>
  );
}
