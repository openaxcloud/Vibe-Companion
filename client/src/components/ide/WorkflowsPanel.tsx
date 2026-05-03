import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Play, Plus, Zap, Terminal, MoreVertical, Trash2, Edit2,
  Globe, TestTube, Package, Database, Loader2,
  Square, Clock, Star, Copy, CheckCircle, XCircle, AlertCircle,
  RotateCcw, History, GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

interface WorkflowStep {
  id?: string;
  workflowId?: string;
  name: string;
  command: string;
  taskType: string;
  orderIndex: number;
  continueOnError: boolean;
}

interface Workflow {
  id: string;
  name: string;
  triggerEvent?: string;
  executionMode?: string;
  enabled?: boolean;
  steps?: WorkflowStep[];
  description?: string;
  icon?: string;
  isDefault?: boolean;
  isSystem?: boolean;
  runOnStart?: boolean;
  lastRun?: string;
  runCount?: number;
}

interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName?: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

interface WorkflowRunStatus {
  status: 'idle' | 'running' | 'completed' | 'failed' | 'stopped';
  startedAt?: number;
}

interface WorkflowsPanelProps {
  projectId: string;
  onRunWorkflow?: (workflow: Workflow) => void;
  className?: string;
}

const ICON_OPTIONS = [
  { id: 'play', icon: Play, label: 'Play' },
  { id: 'terminal', icon: Terminal, label: 'Terminal' },
  { id: 'globe', icon: Globe, label: 'Web' },
  { id: 'test', icon: TestTube, label: 'Test' },
  { id: 'package', icon: Package, label: 'Build' },
  { id: 'database', icon: Database, label: 'Database' },
  { id: 'zap', icon: Zap, label: 'Quick' },
];

const SYSTEM_WORKFLOWS: Workflow[] = [
  { id: 'dev', name: 'Development', description: 'Start development server with hot reload', icon: 'play', isSystem: true, isDefault: true, steps: [{ name: 'Run', command: 'npm run dev', taskType: 'shell', orderIndex: 0, continueOnError: false }] },
  { id: 'build', name: 'Build', description: 'Build production bundle', icon: 'package', isSystem: true, steps: [{ name: 'Run', command: 'npm run build', taskType: 'shell', orderIndex: 0, continueOnError: false }] },
  { id: 'test', name: 'Test', description: 'Run test suite', icon: 'test', isSystem: true, steps: [{ name: 'Run', command: 'npm test', taskType: 'shell', orderIndex: 0, continueOnError: false }] },
  { id: 'preview', name: 'Preview', description: 'Preview production build', icon: 'globe', isSystem: true, steps: [{ name: 'Run', command: 'npm run preview', taskType: 'shell', orderIndex: 0, continueOnError: false }] },
];

function getWorkflowCommand(workflow: Workflow): string {
  if (workflow.steps && workflow.steps.length > 0) {
    return workflow.steps.sort((a, b) => a.orderIndex - b.orderIndex)[0].command;
  }
  return '';
}

function makeBlankStep(index: number): WorkflowStep {
  return { name: `Step ${index + 1}`, command: '', taskType: 'shell', orderIndex: index, continueOnError: false };
}

export function WorkflowsPanel({ projectId, onRunWorkflow, className }: WorkflowsPanelProps) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', icon: 'play' });
  const [editingSteps, setEditingSteps] = useState<WorkflowStep[]>([makeBlankStep(0)]);
  const [workflowStatuses, setWorkflowStatuses] = useState<Record<string, WorkflowRunStatus>>({});
  const [historyWorkflow, setHistoryWorkflow] = useState<Workflow | null>(null);

  useEffect(() => {
    function handleWorkflowStatus(event: Event) {
      const msg = (event as CustomEvent).detail;
      if (msg?.workflowId) {
        setWorkflowStatuses(prev => ({
          ...prev,
          [msg.workflowId]: {
            status: msg.status === 'running' ? 'running' :
                    msg.status === 'completed' ? 'completed' :
                    msg.status === 'failed' ? 'failed' :
                    msg.status === 'stopped' ? 'stopped' : 'idle',
            startedAt: msg.status === 'running' ? Date.now() : prev[msg.workflowId]?.startedAt,
          }
        }));
      }
    }
    window.addEventListener('workflow-status', handleWorkflowStatus);
    return () => window.removeEventListener('workflow-status', handleWorkflowStatus);
  }, []);

  const { data: runningWorkflows } = useQuery<any[]>({
    queryKey: ['/api/projects', projectId, 'workflows/running'],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/workflows/running`, { credentials: 'include' });
        if (!response.ok) return [];
        return response.json();
      } catch { return []; }
    },
    enabled: !!projectId,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (runningWorkflows && runningWorkflows.length > 0) {
      setWorkflowStatuses(prev => {
        const next = { ...prev };
        for (const rw of runningWorkflows) {
          if (!next[rw.workflowId] || next[rw.workflowId].status !== 'running') {
            next[rw.workflowId] = { status: 'running', startedAt: rw.startedAt };
          }
        }
        return next;
      });
    }
  }, [runningWorkflows]);

  const { data: customWorkflows, isLoading } = useQuery<Workflow[]>({
    queryKey: ['/api/projects', projectId, 'workflows'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/workflows`, { credentials: 'include' });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!projectId
  });

  const { data: runHistory } = useQuery<WorkflowRun[]>({
    queryKey: ['/api/projects', projectId, 'workflow-runs'],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/workflow-runs`, { credentials: 'include' });
        if (!response.ok) return [];
        const data = await response.json();
        return data.runs ?? [];
      } catch { return []; }
    },
    enabled: !!projectId,
    refetchInterval: 15000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/projects/${projectId}/workflows`, {
        name: formData.name,
        steps: editingSteps.map((s, i) => ({
          name: s.name || `Step ${i + 1}`,
          command: s.command,
          taskType: s.taskType,
          orderIndex: i,
          continueOnError: s.continueOnError,
        })),
      });
    },
    onSuccess: () => {
      toast({ title: 'Workflow created' });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'workflows'] });
      setIsCreating(false);
      setFormData({ name: '', description: '', icon: 'play' });
      setEditingSteps([makeBlankStep(0)]);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create workflow', description: error.message, variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (workflow: Workflow) => {
      return apiRequest('PATCH', `/api/projects/${projectId}/workflows/${workflow.id}`, {
        name: formData.name,
        steps: editingSteps.map((s, i) => ({
          name: s.name || `Step ${i + 1}`,
          command: s.command,
          taskType: s.taskType,
          orderIndex: i,
          continueOnError: s.continueOnError,
        })),
      });
    },
    onSuccess: () => {
      toast({ title: 'Workflow updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'workflows'] });
      setEditingWorkflow(null);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update workflow', description: error.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      return apiRequest('DELETE', `/api/projects/${projectId}/workflows/${workflowId}`, {});
    },
    onSuccess: () => {
      toast({ title: 'Workflow deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'workflows'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete workflow', description: error.message, variant: 'destructive' });
    }
  });

  const runMutation = useMutation({
    mutationFn: async (workflow: Workflow) => {
      if (workflow.isSystem) {
        const command = getWorkflowCommand(workflow);
        return apiRequest('POST', `/api/projects/${projectId}/workflows/execute-command`, {
          command,
          name: workflow.name,
          workflowId: workflow.id,
        });
      }
      return apiRequest('POST', `/api/projects/${projectId}/workflows/${workflow.id}/run`, {});
    },
    onSuccess: (_data: any, workflow) => {
      setWorkflowStatuses(prev => ({
        ...prev,
        [workflow.id]: { status: 'running', startedAt: Date.now() }
      }));
      onRunWorkflow?.(workflow);
    },
    onError: (error: any, workflow) => {
      toast({ title: 'Failed to run workflow', description: error.message, variant: 'destructive' });
      setWorkflowStatuses(prev => ({
        ...prev,
        [workflow.id]: { status: 'failed' }
      }));
    }
  });

  const stopMutation = useMutation({
    mutationFn: async (workflow: Workflow) => {
      if (workflow.isSystem) {
        return apiRequest('POST', `/api/projects/${projectId}/workflows/stop-command`, {
          workflowId: workflow.id,
        });
      }
      return apiRequest('POST', `/api/projects/${projectId}/workflows/${workflow.id}/stop`, {});
    },
    onSuccess: (_, workflow) => {
      setWorkflowStatuses(prev => ({
        ...prev,
        [workflow.id]: { status: 'stopped' }
      }));
      toast({ title: `Stopped: ${workflow.name}` });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to stop workflow', description: error.message, variant: 'destructive' });
    }
  });

  const restartMutation = useMutation({
    mutationFn: async (workflow: Workflow) => {
      if (workflow.isSystem) {
        await apiRequest('POST', `/api/projects/${projectId}/workflows/stop-command`, { workflowId: workflow.id }).catch(() => {});
        const command = getWorkflowCommand(workflow);
        return apiRequest('POST', `/api/projects/${projectId}/workflows/execute-command`, {
          command,
          name: workflow.name,
          workflowId: workflow.id,
        });
      }
      await apiRequest('POST', `/api/projects/${projectId}/workflows/${workflow.id}/stop`, {}).catch(() => {});
      return apiRequest('POST', `/api/projects/${projectId}/workflows/${workflow.id}/run`, {});
    },
    onSuccess: (_data: any, workflow) => {
      setWorkflowStatuses(prev => ({
        ...prev,
        [workflow.id]: { status: 'running', startedAt: Date.now() }
      }));
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'workflow-runs'] });
      toast({ title: `Restarted: ${workflow.name}` });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to restart workflow', description: error.message, variant: 'destructive' });
    }
  });

  const getIcon = (iconId: string) => {
    return ICON_OPTIONS.find(o => o.id === iconId)?.icon || Terminal;
  };

  const getStatusBadge = (workflowId: string) => {
    const status = workflowStatuses[workflowId];
    if (!status || status.status === 'idle') return null;
    switch (status.status) {
      case 'running':
        return (
          <Badge variant="outline" className="text-[9px] h-4 bg-blue-500/10 text-blue-400 border-blue-500/30" data-testid={`badge-running-${workflowId}`}>
            <Loader2 className="h-2 w-2 mr-0.5 animate-spin" />Running
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="text-[9px] h-4 bg-green-500/10 text-green-400 border-green-500/30" data-testid={`badge-completed-${workflowId}`}>
            <CheckCircle className="h-2 w-2 mr-0.5" />Done
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="text-[9px] h-4 bg-red-500/10 text-red-400 border-red-500/30" data-testid={`badge-failed-${workflowId}`}>
            <XCircle className="h-2 w-2 mr-0.5" />Failed
          </Badge>
        );
      case 'stopped':
        return (
          <Badge variant="outline" className="text-[9px] h-4 bg-yellow-500/10 text-yellow-400 border-yellow-500/30" data-testid={`badge-stopped-${workflowId}`}>
            <AlertCircle className="h-2 w-2 mr-0.5" />Stopped
          </Badge>
        );
      default: return null;
    }
  };

  const openEdit = (workflow: Workflow) => {
    setFormData({ name: workflow.name, description: workflow.description || '', icon: workflow.icon || 'play' });
    const steps = workflow.steps && workflow.steps.length > 0
      ? [...workflow.steps].sort((a, b) => a.orderIndex - b.orderIndex)
      : [makeBlankStep(0)];
    setEditingSteps(steps);
    setEditingWorkflow(workflow);
  };

  const addStep = () => {
    setEditingSteps(prev => [...prev, makeBlankStep(prev.length)]);
  };

  const removeStep = (index: number) => {
    setEditingSteps(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((s, i) => ({ ...s, orderIndex: i }));
    });
  };

  const updateStep = (index: number, field: keyof WorkflowStep, value: any) => {
    setEditingSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const allWorkflows = [...SYSTEM_WORKFLOWS, ...(customWorkflows || [])];

  const StepEditor = () => (
    <div className="space-y-2" data-testid="steps-editor">
      <div className="flex items-center justify-between">
        <Label className="text-[11px]">Steps</Label>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] px-2"
          onClick={addStep}
          data-testid="button-add-step"
        >
          <Plus className="h-3 w-3 mr-1" />Add Step
        </Button>
      </div>
      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {editingSteps.map((step, index) => (
          <div key={index} className="flex items-center gap-1.5 group" data-testid={`step-row-${index}`}>
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
            <span className="text-[10px] text-muted-foreground w-3 flex-shrink-0">{index + 1}</span>
            <Input
              value={step.name}
              onChange={(e) => updateStep(index, 'name', e.target.value)}
              placeholder={`Step ${index + 1}`}
              className="h-7 text-[11px] w-20 flex-shrink-0"
              data-testid={`input-step-name-${index}`}
            />
            <Input
              value={step.command}
              onChange={(e) => updateStep(index, 'command', e.target.value)}
              placeholder="command"
              className="h-7 text-[11px] font-mono flex-1 min-w-0"
              data-testid={`input-step-command-${index}`}
            />
            {editingSteps.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500 flex-shrink-0"
                onClick={() => removeStep(index)}
                data-testid={`button-remove-step-${index}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const WorkflowForm = ({ onSubmit, onCancel, isEdit = false }: {
    onSubmit: () => void;
    onCancel: () => void;
    isEdit?: boolean;
  }) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-[11px]">Workflow Name</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Deploy to Production"
          className="h-8 text-[13px]"
          data-testid="input-workflow-name"
        />
      </div>

      <StepEditor />

      <div className="space-y-2">
        <Label className="text-[11px]">Icon</Label>
        <div className="flex gap-1">
          {ICON_OPTIONS.map(option => {
            const IconComp = option.icon;
            return (
              <Button
                key={option.id}
                variant={formData.icon === option.id ? "default" : "outline"}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setFormData(prev => ({ ...prev, icon: option.id }))}
                data-testid={`button-icon-${option.id}`}
              >
                <IconComp className="h-3.5 w-3.5" />
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} data-testid="button-cancel-workflow">
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={!formData.name || editingSteps.every(s => !s.command)}
          data-testid="button-submit-workflow"
        >
          {isEdit ? 'Update' : 'Create'} Workflow
        </Button>
      </div>
    </div>
  );

  const RunHistoryList = () => {
    const runs = historyWorkflow
      ? (runHistory || []).filter(r => r.workflowId === historyWorkflow.id)
      : (runHistory || []);

    if (runs.length === 0) {
      return (
        <div className="py-8 text-center text-muted-foreground" data-testid="run-history-empty">
          <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-[11px]">No runs yet</p>
        </div>
      );
    }
    return (
      <div className="space-y-1 p-2" data-testid="run-history-list">
        {historyWorkflow && (
          <div className="flex items-center gap-1 px-1 mb-2">
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => setHistoryWorkflow(null)} data-testid="button-history-back">
              ← All
            </Button>
            <span className="text-[11px] font-medium">{historyWorkflow.name}</span>
          </div>
        )}
        {runs.map(run => (
          <div key={run.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 text-[11px]" data-testid={`run-history-row-${run.id}`}>
            {run.status === 'completed' ? (
              <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
            ) : run.status === 'failed' ? (
              <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
            ) : run.status === 'stopped' ? (
              <AlertCircle className="h-3 w-3 text-yellow-500 flex-shrink-0" />
            ) : (
              <Loader2 className="h-3 w-3 animate-spin text-blue-500 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <span className="truncate font-medium">{run.workflowName || run.workflowId}</span>
              {run.errorMessage && (
                <p className="text-[10px] text-red-400 truncate">{run.errorMessage}</p>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground flex-shrink-0 flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {new Date(run.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const WorkflowCard = ({ workflow }: { workflow: Workflow }) => {
    const Icon = getIcon(workflow.icon || 'terminal');
    const isRunning = workflowStatuses[workflow.id]?.status === 'running';
    const isMutating = runMutation.isPending && (runMutation.variables as Workflow)?.id === workflow.id;
    const isRestarting = restartMutation.isPending && (restartMutation.variables as Workflow)?.id === workflow.id;
    const command = getWorkflowCommand(workflow);
    const stepCount = workflow.steps?.length ?? 0;

    return (
      <Card className={cn("group hover:shadow-md transition-all", workflow.isDefault && "ring-1 ring-primary/20")} data-testid={`card-workflow-${workflow.id}`}>
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className={cn("p-2 rounded-lg", workflow.isDefault ? "bg-primary/10" : "bg-muted")}>
              <Icon className={cn("h-4 w-4", workflow.isDefault && "text-primary")} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-medium truncate">{workflow.name}</span>
                {workflow.isDefault && (
                  <Badge variant="outline" className="text-[10px] h-4">
                    <Star className="h-2.5 w-2.5 mr-0.5" />Default
                  </Badge>
                )}
                {workflow.isSystem && (
                  <Badge variant="secondary" className="text-[10px] h-4">System</Badge>
                )}
                {!workflow.isSystem && stepCount > 1 && (
                  <Badge variant="outline" className="text-[10px] h-4">{stepCount} steps</Badge>
                )}
                {getStatusBadge(workflow.id)}
              </div>
              {workflow.description && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{workflow.description}</p>
              )}
              {command && (
                <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded mt-1.5 inline-block">
                  {command}
                </code>
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {isRunning ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => restartMutation.mutate(workflow)}
                    disabled={isRestarting}
                    className="h-7 w-7 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                    data-testid={`button-restart-${workflow.id}`}
                    title="Restart"
                  >
                    {isRestarting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => stopMutation.mutate(workflow)}
                    disabled={stopMutation.isPending}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                    data-testid={`button-stop-${workflow.id}`}
                    title="Stop"
                  >
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => runMutation.mutate(workflow)}
                  disabled={isMutating || !command}
                  className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                  data-testid={`button-run-${workflow.id}`}
                  title="Run"
                >
                  {isMutating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                </Button>
              )}

              {!workflow.isSystem && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-menu-${workflow.id}`}>
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(workflow)}>
                      <Edit2 className="h-3.5 w-3.5 mr-2" />Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setHistoryWorkflow(workflow)}>
                      <History className="h-3.5 w-3.5 mr-2" />Run History
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const cmd = getWorkflowCommand(workflow);
                      if (cmd) { navigator.clipboard.writeText(cmd); toast({ title: 'Command copied' }); }
                    }}>
                      <Copy className="h-3.5 w-3.5 mr-2" />Copy Command
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => deleteMutation.mutate(workflow.id)}
                      className="text-red-600"
                      data-testid={`button-delete-${workflow.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn("h-full flex flex-col bg-[var(--ecode-surface)]", className)}>
      <div className="h-9 border-b border-[var(--ecode-border)] flex items-center justify-between px-2.5 bg-[var(--ecode-surface)]">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text-muted)]">Workflows</span>
          <Badge variant="secondary" className="text-[11px]">{allWorkflows.length}</Badge>
        </div>
        <Dialog open={isCreating} onOpenChange={(open) => { setIsCreating(open); if (!open) { setFormData({ name: '', description: '', icon: 'play' }); setEditingSteps([makeBlankStep(0)]); } }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-[11px]" data-testid="button-new-workflow">
              <Plus className="h-3.5 w-3.5 mr-1" />New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Workflow</DialogTitle>
              <DialogDescription>Create a custom workflow to automate development tasks</DialogDescription>
            </DialogHeader>
            <WorkflowForm
              onSubmit={() => createMutation.mutate()}
              onCancel={() => { setIsCreating(false); setFormData({ name: '', description: '', icon: 'play' }); setEditingSteps([makeBlankStep(0)]); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="workflows" className="flex-1 flex flex-col min-h-0">
        <TabsList className="h-7 mx-2 mt-1.5 mb-0.5 grid grid-cols-2">
          <TabsTrigger value="workflows" className="text-[10px] h-5" data-testid="tab-workflows">Workflows</TabsTrigger>
          <TabsTrigger value="history" className="text-[10px] h-5" data-testid="tab-history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="p-3 space-y-2">
                <div className="space-y-1">
                  <h3 className="text-[11px] font-medium text-muted-foreground px-1">System Workflows</h3>
                  {SYSTEM_WORKFLOWS.map(workflow => (
                    <WorkflowCard key={workflow.id} workflow={workflow} />
                  ))}
                </div>

                {customWorkflows && customWorkflows.length > 0 && (
                  <>
                    <Separator className="my-3" />
                    <div className="space-y-1">
                      <h3 className="text-[11px] font-medium text-muted-foreground px-1">Custom Workflows</h3>
                      {customWorkflows.map(workflow => (
                        <WorkflowCard key={workflow.id} workflow={workflow} />
                      ))}
                    </div>
                  </>
                )}

                {(!customWorkflows || customWorkflows.length === 0) && (
                  <div className="py-8 text-center text-muted-foreground">
                    <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-[11px]">No custom workflows yet</p>
                    <p className="text-[10px] mt-1">Create a workflow to automate your tasks</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="history" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <RunHistoryList />
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingWorkflow} onOpenChange={(open) => !open && setEditingWorkflow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Workflow</DialogTitle>
            <DialogDescription>Update steps, name, and icon. All steps are saved atomically.</DialogDescription>
          </DialogHeader>
          <WorkflowForm
            isEdit
            onSubmit={() => editingWorkflow && updateMutation.mutate(editingWorkflow)}
            onCancel={() => setEditingWorkflow(null)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
