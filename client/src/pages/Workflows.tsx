import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  Play, 
  Plus, 
  MoreVertical,
  ChevronDown,
  ChevronRight,
  Search,
  Terminal,
  Trash2,
  ExternalLink,
  Zap,
  Package,
  PlayCircle,
  GripVertical,
  Square,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { ECodeLoading } from "@/components/ECodeLoading";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface WorkflowTask {
  id: number;
  orderIndex: number;
  taskType: 'shell' | 'packages' | 'workflow';
  command: string | null;
  targetWorkflowId: number | null;
}

interface WorkflowWithTasks {
  id: number;
  projectId: number | null;
  name: string;
  executionMode: 'sequential' | 'parallel';
  isRunButton: boolean;
  isGenerated: boolean;
  isSystem: boolean;
  enabled: boolean;
  tasks: WorkflowTask[];
}

interface WorkflowsProps {
  onBack?: () => void;
  embedded?: boolean;
  projectId?: number;
}

function SortableTaskItem({ 
  task, 
  workflows,
  onUpdate,
  onDelete 
}: { 
  task: WorkflowTask;
  workflows: WorkflowWithTasks[];
  onUpdate: (task: WorkflowTask) => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getTaskIcon = () => {
    switch (task.taskType) {
      case 'shell': return <Terminal className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />;
      case 'packages': return <Package className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />;
      case 'workflow': return <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />;
    }
  };

  const getTaskLabel = () => {
    switch (task.taskType) {
      case 'shell': return 'Execute Shell Command';
      case 'packages': return 'Install Packages';
      case 'workflow': return 'Run Workflow';
    }
  };

  const getTaskValue = () => {
    if (task.taskType === 'workflow') {
      const target = workflows.find(w => w.id === task.targetWorkflowId);
      return target?.name || 'Select workflow...';
    }
    return task.command || '';
  };

  return (
    <Collapsible>
      <div
        ref={setNodeRef}
        style={style}
        className="border rounded-lg bg-background"
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2 sm:gap-3 px-3 py-3 sm:py-2.5 cursor-pointer hover:bg-muted/50 transition-colors min-h-[48px] sm:min-h-[44px]">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab p-2 -m-2 rounded-md hover:bg-muted/80 active:bg-muted touch-manipulation"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-5 h-5 sm:w-4 sm:h-4 text-muted-foreground" />
            </div>
            {getTaskIcon()}
            <span className="text-[13px] sm:text-[13px] flex-1 truncate">{getTaskLabel()}</span>
            <ChevronDown className="w-5 h-5 sm:w-4 sm:h-4 text-muted-foreground" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 space-y-3 border-t">
            {task.taskType === 'workflow' ? (
              <Select
                value={task.targetWorkflowId?.toString() || ''}
                onValueChange={(value) => onUpdate({ ...task, targetWorkflowId: parseInt(value) })}
              >
                <SelectTrigger className="h-12 sm:h-10 text-base sm:text-[13px]" data-testid={`task-workflow-select-${task.id}`}>
                  <SelectValue placeholder="Select workflow..." />
                </SelectTrigger>
                <SelectContent>
                  {workflows.map((w) => (
                    <SelectItem key={w.id} value={w.id.toString()} className="min-h-[44px] sm:min-h-[36px]">
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={task.command || ''}
                onChange={(e) => onUpdate({ ...task, command: e.target.value })}
                placeholder={task.taskType === 'shell' ? 'npm run dev' : 'all'}
                className="h-12 sm:h-10 font-mono text-base sm:text-[13px]"
                data-testid={`task-command-${task.id}`}
              />
            )}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive h-11 sm:h-9 text-[13px] sm:text-[11px] px-4 sm:px-3 touch-manipulation"
                onClick={onDelete}
                data-testid={`delete-task-${task.id}`}
              >
                <Trash2 className="w-4 h-4 sm:w-3 sm:h-3 mr-2 sm:mr-1" />
                Remove
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
      <div className="pl-6 text-[11px] text-muted-foreground py-1 truncate">
        {getTaskValue()}
      </div>
    </Collapsible>
  );
}

export default function Workflows({ onBack, embedded = false, projectId }: WorkflowsProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [agentWorkflowsOpen, setAgentWorkflowsOpen] = useState(true);
  const [expandedWorkflowId, setExpandedWorkflowId] = useState<number | null>(null);

  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    executionMode: 'sequential' as 'sequential' | 'parallel',
    isRunButton: false,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: workflows = [], isLoading } = useQuery<WorkflowWithTasks[]>({
    queryKey: ['/api/workflows', projectId],
    queryFn: async () => {
      const url = projectId ? `/api/workflows?projectId=${projectId}` : '/api/workflows';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch workflows');
      return res.json();
    },
  });

  const createWorkflowMutation = useMutation({
    mutationFn: async (workflow: typeof newWorkflow) => {
      const res = await apiRequest('POST', '/api/workflows', {
        ...workflow,
        projectId,
        tasks: [{ taskType: 'shell', command: 'npm run dev', orderIndex: 0 }],
      });
      if (!res.ok) throw new Error('Failed to create workflow');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', projectId] });
      setCreateDialogOpen(false);
      toast({ title: "Workflow created" });
      setNewWorkflow({ name: '', executionMode: 'sequential', isRunButton: false });
    },
  });

  const updateWorkflowMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<WorkflowWithTasks> }) => {
      const res = await apiRequest('PATCH', `/api/workflows/${id}`, data);
      if (!res.ok) throw new Error('Failed to update workflow');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', projectId] });
    },
  });

  const deleteWorkflowMutation = useMutation({
    mutationFn: async (workflowId: number) => {
      const res = await apiRequest('DELETE', `/api/workflows/${workflowId}`);
      if (!res.ok) throw new Error('Failed to delete workflow');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', projectId] });
      toast({ title: "Workflow deleted" });
    },
  });

  const runWorkflowMutation = useMutation({
    mutationFn: async (workflowId: number) => {
      const res = await apiRequest('POST', `/api/workflows/${workflowId}/run`);
      if (!res.ok) throw new Error('Failed to run workflow');
      return res.json();
    },
    onSuccess: (_, workflowId) => {
      const workflow = workflows.find(w => w.id === workflowId);
      toast({ title: `Workflow "${workflow?.name}" started` });
    },
  });

  const setRunButtonMutation = useMutation({
    mutationFn: async (workflowId: number) => {
      const res = await apiRequest('POST', `/api/workflows/${workflowId}/set-run-button`);
      if (!res.ok) throw new Error('Failed to set run button');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', projectId] });
      toast({ title: "Run button assigned" });
    },
  });

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      setLocation('/');
    }
  };

  const handleAddTask = useCallback((workflow: WorkflowWithTasks, taskType: 'shell' | 'packages' | 'workflow') => {
    const newTask: WorkflowTask = {
      id: Date.now(),
      orderIndex: workflow.tasks.length,
      taskType,
      command: taskType === 'packages' ? 'all' : '',
      targetWorkflowId: null,
    };
    updateWorkflowMutation.mutate({
      id: workflow.id,
      data: { tasks: [...workflow.tasks, newTask] },
    });
  }, [updateWorkflowMutation]);

  const handleUpdateTask = useCallback((workflow: WorkflowWithTasks, updatedTask: WorkflowTask) => {
    const newTasks = workflow.tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    updateWorkflowMutation.mutate({ id: workflow.id, data: { tasks: newTasks } });
  }, [updateWorkflowMutation]);

  const handleDeleteTask = useCallback((workflow: WorkflowWithTasks, taskId: number) => {
    const newTasks = workflow.tasks.filter(t => t.id !== taskId);
    updateWorkflowMutation.mutate({ id: workflow.id, data: { tasks: newTasks } });
  }, [updateWorkflowMutation]);

  const handleDragEnd = useCallback((workflow: WorkflowWithTasks, event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = workflow.tasks.findIndex(t => t.id === active.id);
      const newIndex = workflow.tasks.findIndex(t => t.id === over.id);
      const newTasks = arrayMove(workflow.tasks, oldIndex, newIndex).map((t, i) => ({ ...t, orderIndex: i }));
      updateWorkflowMutation.mutate({ id: workflow.id, data: { tasks: newTasks } });
    }
  }, [updateWorkflowMutation]);

  const filteredWorkflows = workflows.filter(workflow =>
    workflow.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const agentWorkflows = filteredWorkflows.filter(w => w.isGenerated);
  const userWorkflows = filteredWorkflows.filter(w => !w.isGenerated);

  if (isLoading) {
    return (
      <div className={cn("flex flex-col h-full bg-background", !embedded && "min-h-screen")}>
        <div className="flex-1 flex items-center justify-center">
          <ECodeLoading size="lg" text="Loading workflows..." />
        </div>
      </div>
    );
  }

  const WorkflowItem = ({ workflow }: { workflow: WorkflowWithTasks }) => {
    const isExpanded = expandedWorkflowId === workflow.id;

    return (
      <Collapsible open={isExpanded} onOpenChange={(open) => setExpandedWorkflowId(open ? workflow.id : null)}>
        <div className="border-b border-border/50 last:border-b-0">
          <CollapsibleTrigger asChild>
            <div 
              className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-3 hover:bg-muted/50 transition-colors cursor-pointer min-h-[56px] sm:min-h-[52px]"
              data-testid={`workflow-item-${workflow.id}`}
            >
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 sm:h-9 sm:w-9 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50 touch-manipulation"
                  onClick={(e) => {
                    e.stopPropagation();
                    runWorkflowMutation.mutate(workflow.id);
                  }}
                  data-testid={`run-workflow-${workflow.id}`}
                >
                  <Play className="w-5 h-5 sm:w-4 sm:h-4 fill-current" />
                </Button>
                <span className="text-[13px] font-medium truncate">{workflow.name}</span>
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-wrap">
                  {workflow.isRunButton && (
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-[10px] sm:text-[10px] px-1.5 py-0.5 sm:py-0" data-testid={`badge-run-button-${workflow.id}`}>
                      Run Button
                    </Badge>
                  )}
                  {workflow.isGenerated && (
                    <Badge variant="secondary" className="text-[10px] sm:text-[10px] px-1.5 py-0.5 sm:py-0" data-testid={`badge-generated-${workflow.id}`}>
                      Generated
                    </Badge>
                  )}
                </div>
              </div>
              <ChevronDown className={cn("w-6 h-6 sm:w-5 sm:h-5 text-muted-foreground transition-transform ml-2", isExpanded && "rotate-180")} />
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-4 border-t bg-muted/20">
              {/* Workflow Name */}
              <div className="pt-4 space-y-2 sm:space-y-1.5">
                <Label className="text-[13px] sm:text-[11px] text-muted-foreground">Workflow</Label>
                <Input
                  value={workflow.name}
                  onChange={(e) => updateWorkflowMutation.mutate({ id: workflow.id, data: { name: e.target.value } })}
                  className="h-12 sm:h-10 text-base sm:text-[13px]"
                  data-testid={`workflow-name-${workflow.id}`}
                />
              </div>

              {/* Execution Mode */}
              <div className="space-y-2 sm:space-y-1.5">
                <Label className="text-[13px] sm:text-[11px] text-muted-foreground">Mode</Label>
                <ToggleGroup
                  type="single"
                  value={workflow.executionMode}
                  onValueChange={(value) => {
                    if (value) {
                      updateWorkflowMutation.mutate({ id: workflow.id, data: { executionMode: value as 'sequential' | 'parallel' } });
                    }
                  }}
                  className="justify-start"
                >
                  <ToggleGroupItem value="sequential" className="text-[13px] sm:text-[11px] px-4 sm:px-3 h-11 sm:h-9 touch-manipulation" data-testid={`mode-sequential-${workflow.id}`}>
                    Sequential
                  </ToggleGroupItem>
                  <ToggleGroupItem value="parallel" className="text-[13px] sm:text-[11px] px-4 sm:px-3 h-11 sm:h-9 touch-manipulation" data-testid={`mode-parallel-${workflow.id}`}>
                    Parallel
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Tasks */}
              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground">Tasks</Label>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => handleDragEnd(workflow, e)}
                >
                  <SortableContext
                    items={workflow.tasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1">
                      {workflow.tasks.sort((a, b) => a.orderIndex - b.orderIndex).map((task) => (
                        <SortableTaskItem
                          key={task.id}
                          task={task}
                          workflows={workflows}
                          onUpdate={(t) => handleUpdateTask(workflow, t)}
                          onDelete={() => handleDeleteTask(workflow, task.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {/* Add Task Buttons */}
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[13px] sm:text-[11px] h-11 sm:h-9 px-4 sm:px-3 justify-start sm:justify-center touch-manipulation"
                    onClick={() => handleAddTask(workflow, 'shell')}
                    data-testid={`add-shell-task-${workflow.id}`}
                  >
                    <Terminal className="w-4 h-4 sm:w-3 sm:h-3 mr-2 sm:mr-1" />
                    Shell Command
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[13px] sm:text-[11px] h-11 sm:h-9 px-4 sm:px-3 justify-start sm:justify-center touch-manipulation"
                    onClick={() => handleAddTask(workflow, 'packages')}
                    data-testid={`add-packages-task-${workflow.id}`}
                  >
                    <Package className="w-4 h-4 sm:w-3 sm:h-3 mr-2 sm:mr-1" />
                    Install Packages
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[13px] sm:text-[11px] h-11 sm:h-9 px-4 sm:px-3 justify-start sm:justify-center touch-manipulation"
                    onClick={() => handleAddTask(workflow, 'workflow')}
                    data-testid={`add-workflow-task-${workflow.id}`}
                  >
                    <PlayCircle className="w-4 h-4 sm:w-3 sm:h-3 mr-2 sm:mr-1" />
                    Run Workflow
                  </Button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-3 border-t">
                {!workflow.isRunButton ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[13px] sm:text-[11px] h-11 sm:h-9 px-4 sm:px-3 touch-manipulation"
                    onClick={() => setRunButtonMutation.mutate(workflow.id)}
                    data-testid={`set-run-button-${workflow.id}`}
                  >
                    Assign to Run Button
                  </Button>
                ) : (
                  <span className="text-[13px] sm:text-[11px] text-muted-foreground py-2">Assigned to Run Button</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[13px] sm:text-[11px] h-11 sm:h-9 px-4 sm:px-3 text-destructive hover:text-destructive touch-manipulation"
                  onClick={() => deleteWorkflowMutation.mutate(workflow.id)}
                  data-testid={`delete-workflow-${workflow.id}`}
                >
                  <Trash2 className="w-4 h-4 sm:w-3 sm:h-3 mr-2 sm:mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  return (
    <div className={cn("flex flex-col h-full bg-background", !embedded && "min-h-screen")}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b shrink-0 min-h-[56px] sm:min-h-[52px]">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleBack}
          className="h-11 w-11 sm:h-10 sm:w-10 touch-manipulation"
          data-testid="back-button"
        >
          <ArrowLeft className="w-6 h-6 sm:w-5 sm:h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Play className="w-5 h-5 sm:w-5 sm:h-5 text-primary" />
          <span className="font-semibold text-base sm:text-base">Workflows</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-10 sm:w-10 touch-manipulation" data-testid="header-menu">
              <MoreVertical className="w-6 h-6 sm:w-5 sm:h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setCreateDialogOpen(true)} className="min-h-[44px] text-[13px]">
              <Plus className="w-4 h-4 mr-2" />
              New Workflow
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search & New Workflow */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-4 sm:h-4 text-muted-foreground" />
          <Input
            placeholder="Search for a workflow..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 sm:pl-9 h-12 sm:h-10 text-base sm:text-[13px]"
            data-testid="search-workflows"
          />
        </div>
        <Button 
          onClick={() => setCreateDialogOpen(true)}
          className="bg-green-500 hover:bg-green-600 text-white shrink-0 h-12 sm:h-10 text-base sm:text-[13px] px-4 touch-manipulation"
          data-testid="new-workflow-button"
        >
          <Plus className="w-5 h-5 sm:w-4 sm:h-4 mr-2 sm:mr-1" />
          <span>New Workflow</span>
        </Button>
      </div>

      {/* Learn More Link */}
      <a 
        href="https://docs.replit.com/replit-workspace/workflows"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 sm:gap-1 px-3 sm:px-4 py-4 sm:py-3 text-blue-500 hover:text-blue-600 text-base sm:text-[13px] font-medium border-b shrink-0 min-h-[52px] sm:min-h-[44px] touch-manipulation"
        data-testid="learn-more-link"
      >
        Learn more about configuring Workflows
        <ExternalLink className="w-4 h-4 sm:w-3 sm:h-3" />
      </a>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Agent Workflows Section */}
        <Collapsible open={agentWorkflowsOpen} onOpenChange={setAgentWorkflowsOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 sm:px-4 py-4 sm:py-3 text-left hover:bg-muted/50 transition-colors min-h-[52px] sm:min-h-[44px] touch-manipulation">
            <span className="text-base sm:text-[13px] font-medium">Agent Workflows</span>
            {agentWorkflowsOpen ? (
              <ChevronDown className="w-6 h-6 sm:w-5 sm:h-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-6 h-6 sm:w-5 sm:h-5 text-muted-foreground" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            {agentWorkflows.length > 0 ? (
              <div className="border-t">
                {agentWorkflows.map((workflow) => (
                  <WorkflowItem key={workflow.id} workflow={workflow} />
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-muted-foreground text-[13px] border-t">
                <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No agent workflows yet</p>
                <p className="text-[11px] mt-1">Workflows created by AI agents will appear here</p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* User Workflows Section */}
        {userWorkflows.length > 0 && (
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 sm:px-4 py-4 sm:py-3 text-left hover:bg-muted/50 transition-colors border-t min-h-[52px] sm:min-h-[44px] touch-manipulation">
              <span className="text-base sm:text-[13px] font-medium">My Workflows</span>
              <ChevronDown className="w-6 h-6 sm:w-5 sm:h-5 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t">
                {userWorkflows.map((workflow) => (
                  <WorkflowItem key={workflow.id} workflow={workflow} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Empty State */}
        {filteredWorkflows.length === 0 && searchQuery && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Search className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-base font-medium mb-1">No workflows found</h3>
            <p className="text-[13px] text-muted-foreground">
              Try a different search term or create a new workflow
            </p>
          </div>
        )}

        {workflows.length === 0 && !searchQuery && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Play className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-[15px] sm:text-base font-medium mb-1">No workflows yet</h3>
            <p className="text-base sm:text-[13px] text-muted-foreground mb-4">
              Create your first workflow to automate tasks
            </p>
            <Button 
              onClick={() => setCreateDialogOpen(true)}
              className="bg-green-500 hover:bg-green-600 text-white h-12 sm:h-10 text-base sm:text-[13px] px-6 sm:px-4 touch-manipulation"
              data-testid="create-first-workflow"
            >
              <Plus className="w-5 h-5 sm:w-4 sm:h-4 mr-2 sm:mr-1" />
              New Workflow
            </Button>
          </div>
        )}
      </div>

      {/* Create Workflow Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
            <DialogDescription>
              Set up automated tasks for your project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3 sm:space-y-2">
              <Label htmlFor="name" className="text-base sm:text-[13px]">Workflow Name</Label>
              <Input
                id="name"
                value={newWorkflow.name}
                onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                placeholder="My Workflow"
                className="h-12 sm:h-10 text-base sm:text-[13px]"
                data-testid="workflow-name-input"
              />
            </div>
            <div className="space-y-3 sm:space-y-2">
              <Label className="text-base sm:text-[13px]">Execution Mode</Label>
              <ToggleGroup
                type="single"
                value={newWorkflow.executionMode}
                onValueChange={(value) => {
                  if (value) {
                    setNewWorkflow({ ...newWorkflow, executionMode: value as 'sequential' | 'parallel' });
                  }
                }}
                className="justify-start"
              >
                <ToggleGroupItem value="sequential" className="text-[13px] sm:text-[11px] px-4 sm:px-3 h-11 sm:h-9 touch-manipulation">
                  Sequential
                </ToggleGroupItem>
                <ToggleGroupItem value="parallel" className="text-[13px] sm:text-[11px] px-4 sm:px-3 h-11 sm:h-9 touch-manipulation">
                  Parallel
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-[13px] sm:text-[11px] text-muted-foreground">
                {newWorkflow.executionMode === 'sequential' 
                  ? 'Tasks run one after another, stopping if any task fails'
                  : 'All tasks run at the same time, independently'}
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-3 sm:gap-2">
            <Button 
              variant="outline" 
              onClick={() => setCreateDialogOpen(false)}
              className="w-full sm:w-auto h-12 sm:h-10 text-base sm:text-[13px] touch-manipulation"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => createWorkflowMutation.mutate(newWorkflow)}
              disabled={!newWorkflow.name || createWorkflowMutation.isPending}
              className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white h-12 sm:h-10 text-base sm:text-[13px] touch-manipulation"
              data-testid="create-workflow-submit"
            >
              Create Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
