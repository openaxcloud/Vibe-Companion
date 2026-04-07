import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Workflow,
  Play,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  GitBranch,
  Zap,
  Timer,
  Code,
  Loader2,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

interface WorkflowTrigger {
  type: 'manual' | 'push' | 'schedule' | 'webhook';
  config?: {
    branch?: string;
    cron?: string;
    url?: string;
  };
}

interface WorkflowStep {
  id: string;
  name: string;
  type: 'command' | 'script' | 'deploy' | 'test';
  command?: string;
  script?: string;
  config?: Record<string, any>;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  enabled: boolean;
  status?: 'idle' | 'running' | 'success' | 'failed';
  lastRun?: string | null;
}

interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  completedAt?: string;
  logs: string[];
  trigger: string;
  currentStep?: string;
}

interface ReplitWorkflowsProps {
  projectId: number;
}

const RUN_POLL_INTERVAL = 5000;

const generateStepId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

interface NewWorkflowState {
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  enabled: boolean;
}

const createDefaultWorkflow = (): NewWorkflowState => ({
  name: '',
  description: '',
  trigger: { type: 'manual', config: {} },
  steps: [
    { id: generateStepId(), name: 'Install dependencies', type: 'command', command: 'npm install' },
    { id: generateStepId(), name: 'Run tests', type: 'command', command: 'npm test' }
  ] as WorkflowStep[],
  enabled: true
});

export function ReplitWorkflows({ projectId }: ReplitWorkflowsProps) {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [newWorkflow, setNewWorkflow] = useState(createDefaultWorkflow);

  const projectIdParam = useMemo(() => projectId?.toString(), [projectId]);

  const refreshData = async (withLoader = true) => {
    if (!projectIdParam) {
      setWorkflows([]);
      setRuns([]);
      return;
    }

    if (withLoader) {
      setLoading(true);
    }

    try {
      const [workflowsResponse, runsResponse] = await Promise.all([
        fetch(`/api/projects/${projectIdParam}/workflows`, {
          credentials: 'include'
        }),
        fetch(`/api/projects/${projectIdParam}/workflow-runs`, {
          credentials: 'include'
        })
      ]);

      if (!workflowsResponse.ok) {
        throw new Error('Failed to load workflows');
      }

      const workflowPayload = await workflowsResponse.json();
      const runsPayload = runsResponse.ok ? await runsResponse.json() : { runs: [] };
      const incomingRuns: WorkflowRun[] = Array.isArray(runsPayload?.runs) ? runsPayload.runs : [];

      const sortedRuns = [...incomingRuns].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
      setRuns(sortedRuns);

      const runsByWorkflow = new Map<string, WorkflowRun[]>();
      for (const run of sortedRuns) {
        const existing = runsByWorkflow.get(run.workflowId) ?? [];
        existing.push(run);
        runsByWorkflow.set(run.workflowId, existing);
      }

      for (const [, workflowRuns] of runsByWorkflow) {
        workflowRuns.sort(
          (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        );
      }

      const enhancedWorkflows: Workflow[] = (workflowPayload?.workflows ?? []).map((workflow: Workflow) => {
        const workflowRuns = runsByWorkflow.get(workflow.id) ?? [];
        const latestRun = workflowRuns[0];

        return {
          ...workflow,
          status: latestRun?.status ?? 'idle',
          lastRun: latestRun?.startedAt ?? null
        };
      });

      setWorkflows(enhancedWorkflows);
    } catch (error: any) {
      console.error('Error loading workflows:', error);
      if (withLoader) {
        toast({
          title: 'Failed to load workflows',
          description: error?.message || 'Please try again in a moment.',
          variant: 'destructive'
        });
      }
    } finally {
      if (withLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    refreshData();

    const interval = setInterval(() => {
      refreshData(false);
    }, RUN_POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [projectIdParam]);

  const handleTriggerSelect = (type: WorkflowTrigger['type']) => {
    setNewWorkflow(prev => ({
      ...prev,
      trigger: { type, config: {} }
    }));
  };

  const handleTriggerConfigChange = (field: 'branch' | 'cron' | 'url', value: string) => {
    setNewWorkflow(prev => ({
      ...prev,
      trigger: {
        ...prev.trigger,
        config: {
          ...(prev.trigger.config || {}),
          [field]: value
        }
      }
    }));
  };

  const handleAddStep = () => {
    setNewWorkflow(prev => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          id: generateStepId(),
          name: `Step ${prev.steps.length + 1}`,
          type: 'command',
          command: ''
        }
      ]
    }));
  };

  const handleRemoveStep = (index: number) => {
    setNewWorkflow(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  const handleStepUpdate = (index: number, updates: Partial<WorkflowStep>) => {
    setNewWorkflow(prev => {
      const steps = [...prev.steps];
      const current = steps[index];
      const nextStep = { ...current, ...updates };

      if (updates.type && updates.type !== current.type) {
        if (updates.type === 'script') {
          nextStep.command = '';
        } else {
          nextStep.script = '';
        }
      }

      steps[index] = nextStep;
      return { ...prev, steps };
    });
  };

  const validateNewWorkflow = () => {
    if (!newWorkflow.name.trim()) {
      toast({
        title: 'Workflow name is required',
        description: 'Please provide a descriptive name for your workflow.',
        variant: 'destructive'
      });
      return false;
    }

    if (newWorkflow.steps.length === 0) {
      toast({
        title: 'Add at least one step',
        description: 'Workflows need at least one action to execute.',
        variant: 'destructive'
      });
      return false;
    }

    const hasInvalidStep = newWorkflow.steps.some(step => {
      if (!step.name.trim()) {
        return true;
      }

      if ((step.type === 'command' || step.type === 'test' || step.type === 'deploy') && !step.command?.trim()) {
        return true;
      }

      if (step.type === 'script' && !step.script?.trim()) {
        return true;
      }

      return false;
    });

    if (hasInvalidStep) {
      toast({
        title: 'Complete all steps',
        description: 'Each step must include a name and relevant command or script.',
        variant: 'destructive'
      });
      return false;
    }

    if (newWorkflow.trigger.type === 'push' && !newWorkflow.trigger.config?.branch?.trim()) {
      toast({
        title: 'Branch required',
        description: 'Specify which branch should trigger this workflow.',
        variant: 'destructive'
      });
      return false;
    }

    if (newWorkflow.trigger.type === 'schedule' && !newWorkflow.trigger.config?.cron?.trim()) {
      toast({
        title: 'Cron expression required',
        description: 'Provide a valid cron expression for scheduled workflows.',
        variant: 'destructive'
      });
      return false;
    }

    return true;
  };

  const createWorkflow = async () => {
    if (!projectIdParam) return;
    if (!validateNewWorkflow()) return;

    try {
      const response = await apiRequest('POST', `/api/projects/${projectIdParam}/workflows`, {
        name: newWorkflow.name.trim(),
        description: newWorkflow.description.trim(),
        trigger: newWorkflow.trigger,
        steps: newWorkflow.steps.map(step => ({
          id: step.id,
          name: step.name.trim(),
          type: step.type,
          command: step.command?.trim() || undefined,
          script: step.script?.trim() || undefined,
          config: step.config
        })),
        enabled: newWorkflow.enabled
      });

      if (!response.ok) {
        throw new Error('Unable to create workflow');
      }

      toast({
        title: 'Workflow created',
        description: `Workflow "${newWorkflow.name.trim()}" is ready to use.`
      });

      setNewWorkflow(createDefaultWorkflow());
      setShowCreateDialog(false);
      refreshData();
    } catch (error: any) {
      console.error('Error creating workflow:', error);
      toast({
        title: 'Failed to create workflow',
        description: error?.message || 'Please try again later.',
        variant: 'destructive'
      });
    }
  };

  const runWorkflow = async (workflowId: string) => {
    if (!projectIdParam) return;

    try {
      const response = await apiRequest('POST', `/api/projects/${projectIdParam}/workflows/${workflowId}/run`);

      if (!response.ok) {
        throw new Error('Unable to start workflow');
      }

      const run = await response.json();

      toast({
        title: 'Workflow started',
        description: 'Workflow execution has begun.'
      });

      setRuns(prev => [run, ...prev]);
      setWorkflows(prev =>
        prev.map(workflow =>
          workflow.id === workflowId
            ? { ...workflow, status: run.status, lastRun: run.startedAt }
            : workflow
        )
      );

      refreshData(false);
    } catch (error: any) {
      console.error('Error running workflow:', error);
      toast({
        title: 'Failed to run workflow',
        description: error?.message || 'Please try again later.',
        variant: 'destructive'
      });
    }
  };

  const toggleWorkflow = async (workflowId: string, enabled: boolean) => {
    if (!projectIdParam) return;

    try {
      const response = await apiRequest('PATCH', `/api/projects/${projectIdParam}/workflows/${workflowId}`, { enabled });

      if (!response.ok) {
        throw new Error('Unable to update workflow');
      }

      setWorkflows(prev =>
        prev.map(workflow =>
          workflow.id === workflowId ? { ...workflow, enabled } : workflow
        )
      );

      toast({
        title: enabled ? 'Workflow enabled' : 'Workflow disabled',
        description: enabled
          ? 'This workflow will now respond to its triggers.'
          : 'This workflow will not run until it is enabled again.'
      });
    } catch (error: any) {
      console.error('Error toggling workflow:', error);
      toast({
        title: 'Failed to update workflow',
        description: error?.message || 'Please try again later.',
        variant: 'destructive'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'running':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'push':
        return <GitBranch className="h-4 w-4" />;
      case 'schedule':
        return <Timer className="h-4 w-4" />;
      case 'webhook':
        return <Zap className="h-4 w-4" />;
      default:
        return <Play className="h-4 w-4" />;
    }
  };

  const handleViewLatestRun = (workflowId: string) => {
    const workflowRuns = runs.filter(run => run.workflowId === workflowId);
    if (workflowRuns.length === 0) {
      toast({
        title: 'No runs yet',
        description: 'Trigger this workflow to view execution logs.',
        variant: 'destructive'
      });
      return;
    }

    workflowRuns.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    setSelectedRun(workflowRuns[0]);
  };

  const selectedRunWorkflow = useMemo(
    () => (selectedRun ? workflows.find(workflow => workflow.id === selectedRun.workflowId) : null),
    [selectedRun, workflows]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Workflow className="h-6 w-6" />
            Workflows
          </h2>
          <p className="text-muted-foreground">
            Automate your development workflow with reusable CI/CD pipelines.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {loading && (
            <span className="inline-flex items-center text-[13px] text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing…
            </span>
          )}

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Workflow
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create new workflow</DialogTitle>
                <DialogDescription>
                  Define automated tasks that run on demand or when triggers fire.
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="basic" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Basic info</TabsTrigger>
                  <TabsTrigger value="trigger">Trigger</TabsTrigger>
                  <TabsTrigger value="steps">Steps</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="workflow-name">Workflow name</Label>
                    <Input
                      id="workflow-name"
                      placeholder="Deploy to production"
                      value={newWorkflow.name}
                      onChange={e => setNewWorkflow(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="workflow-description">Description</Label>
                    <Textarea
                      id="workflow-description"
                      placeholder="What does this workflow do?"
                      value={newWorkflow.description}
                      onChange={e => setNewWorkflow(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium text-[13px]">Enable immediately</p>
                      <p className="text-[11px] text-muted-foreground">
                        Enabled workflows can be run manually and respond to their triggers.
                      </p>
                    </div>
                    <Switch
                      checked={newWorkflow.enabled}
                      onCheckedChange={checked =>
                        setNewWorkflow(prev => ({ ...prev, enabled: checked }))
                      }
                    />
                  </div>
                </TabsContent>

                <TabsContent value="trigger" className="space-y-4">
                  <div className="space-y-3">
                    <Label>Trigger type</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { type: 'manual', label: 'Manual', desc: 'Run on demand' },
                        { type: 'push', label: 'Git push', desc: 'Run when code is pushed' },
                        { type: 'schedule', label: 'Schedule', desc: 'Run on a cron schedule' },
                        { type: 'webhook', label: 'Webhook', desc: 'Run from external requests' }
                      ].map(trigger => (
                        <Card
                          key={trigger.type}
                          className={`p-3 cursor-pointer transition-all ${
                            newWorkflow.trigger.type === trigger.type
                              ? 'ring-2 ring-primary border-primary'
                              : 'hover:shadow-sm'
                          }`}
                          onClick={() => handleTriggerSelect(trigger.type as WorkflowTrigger['type'])}
                        >
                          <div className="flex items-center gap-2">
                            {getTriggerIcon(trigger.type)}
                            <div>
                              <p className="font-medium text-[13px]">{trigger.label}</p>
                              <p className="text-[11px] text-muted-foreground">{trigger.desc}</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {newWorkflow.trigger.type === 'push' && (
                    <div className="space-y-2">
                      <Label htmlFor="workflow-branch">Branch</Label>
                      <Input
                        id="workflow-branch"
                        placeholder="main"
                        value={newWorkflow.trigger.config?.branch || ''}
                        onChange={e => handleTriggerConfigChange('branch', e.target.value)}
                      />
                    </div>
                  )}

                  {newWorkflow.trigger.type === 'schedule' && (
                    <div className="space-y-2">
                      <Label htmlFor="workflow-cron">Cron expression</Label>
                      <Input
                        id="workflow-cron"
                        placeholder="0 0 * * *"
                        value={newWorkflow.trigger.config?.cron || ''}
                        onChange={e => handleTriggerConfigChange('cron', e.target.value)}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Use standard cron syntax. For example, <code>0 0 * * *</code> runs nightly at midnight.
                      </p>
                    </div>
                  )}

                  {newWorkflow.trigger.type === 'webhook' && (
                    <div className="space-y-2">
                      <Label htmlFor="workflow-webhook">Webhook URL (optional)</Label>
                      <Input
                        id="workflow-webhook"
                        placeholder="https://example.com/hook"
                        value={newWorkflow.trigger.config?.url || ''}
                        onChange={e => handleTriggerConfigChange('url', e.target.value)}
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="steps" className="space-y-4">
                  <div className="space-y-3">
                    {newWorkflow.steps.map((step, index) => (
                      <Card key={step.id} className="p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-[11px] flex items-center justify-center">
                            {index + 1}
                          </div>
                          <div className="flex-1 space-y-2">
                            <Input
                              placeholder="Step name"
                              value={step.name}
                              onChange={e => handleStepUpdate(index, { name: e.target.value })}
                            />

                            <Select
                              value={step.type}
                              onValueChange={value => handleStepUpdate(index, { type: value as WorkflowStep['type'] })}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select action type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="command">Run command</SelectItem>
                                <SelectItem value="test">Run tests</SelectItem>
                                <SelectItem value="deploy">Deploy</SelectItem>
                                <SelectItem value="script">Execute script</SelectItem>
                              </SelectContent>
                            </Select>

                            {step.type === 'script' ? (
                              <Textarea
                                placeholder="Paste or write your script here"
                                value={step.script || ''}
                                onChange={e => handleStepUpdate(index, { script: e.target.value })}
                                rows={3}
                                className="font-mono text-[13px]"
                              />
                            ) : (
                              <Input
                                placeholder="Command to run (e.g. npm run build)"
                                value={step.command || ''}
                                onChange={e => handleStepUpdate(index, { command: e.target.value })}
                                className="font-mono text-[13px]"
                              />
                            )}
                          </div>

                          {newWorkflow.steps.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveStep(index)}
                              className="text-muted-foreground hover:text-destructive"
                              aria-label="Remove step"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>

                  <Button type="button" variant="outline" className="w-full" onClick={handleAddStep}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add step
                  </Button>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={createWorkflow}>
                  Create workflow
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="workflows" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workflows">Workflows ({workflows.length})</TabsTrigger>
          <TabsTrigger value="runs">Recent runs ({runs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-4">
          {loading && (
            <Card>
              <CardContent className="flex items-center justify-center gap-2 py-6 text-[13px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading workflows…
              </CardContent>
            </Card>
          )}

          {!loading && workflows.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-[15px] font-semibold mb-2">No workflows yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first workflow to automate your development process.
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create workflow
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {workflows.map(workflow => (
                <Card key={workflow.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                          <Workflow className="h-4 w-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{workflow.name}</CardTitle>
                          <CardDescription>{workflow.description || 'No description provided.'}</CardDescription>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge className={`${getStatusColor(workflow.status || 'idle')} border`}> 
                          {getStatusIcon(workflow.status || 'idle')}
                          <span className="ml-1 capitalize">{workflow.status || 'idle'}</span>
                        </Badge>
                        <Badge variant={workflow.enabled ? 'default' : 'outline'}>
                          {workflow.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Switch
                          checked={workflow.enabled}
                          onCheckedChange={checked => toggleWorkflow(workflow.id, checked)}
                          aria-label={`Toggle workflow ${workflow.name}`}
                        />
                        <Button
                          size="sm"
                          onClick={() => runWorkflow(workflow.id)}
                          disabled={!workflow.enabled || workflow.status === 'running'}
                        >
                          {workflow.status === 'running' ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Running
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-1" />
                              Run
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewLatestRun(workflow.id)}
                          disabled={!runs.some(run => run.workflowId === workflow.id)}
                        >
                          View logs
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {getTriggerIcon(workflow.trigger.type)}
                        <span className="capitalize">{workflow.trigger.type} trigger</span>
                        {workflow.trigger.type === 'push' && workflow.trigger.config?.branch && (
                          <span className="ml-1">({workflow.trigger.config.branch})</span>
                        )}
                        {workflow.trigger.type === 'schedule' && workflow.trigger.config?.cron && (
                          <span className="ml-1">({workflow.trigger.config.cron})</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Code className="h-3 w-3" />
                        <span>{workflow.steps.length} steps</span>
                      </div>

                      {workflow.lastRun && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Last run {new Date(workflow.lastRun).toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {workflow.steps.map((step, index) => (
                        <Badge key={step.id} variant="outline" className="text-[11px]">
                          {index + 1}. {step.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          {runs.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No workflow runs yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {runs.map(run => (
                <Card key={run.id} className="p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={`${getStatusColor(run.status)} border`}>
                        {getStatusIcon(run.status)}
                        <span className="ml-1 capitalize">{run.status}</span>
                      </Badge>

                      <div>
                        <p className="font-medium">
                          {workflows.find(workflow => workflow.id === run.workflowId)?.name || 'Unknown workflow'}
                        </p>
                        <p className="text-[13px] text-muted-foreground">
                          Triggered by {run.trigger} • Started {new Date(run.startedAt).toLocaleString()}
                          {run.completedAt && (
                            <span>
                              {' '}
                              • Duration{' '}
                              {Math.max(
                                1,
                                Math.round(
                                  (new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000
                                )
                              )}
                              s
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <Button variant="outline" size="sm" onClick={() => setSelectedRun(run)}>
                      View logs
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedRun && (
        <Dialog open onOpenChange={() => setSelectedRun(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                {selectedRunWorkflow?.name || 'Workflow run'}
              </DialogTitle>
              <DialogDescription className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                  <Badge className={`${getStatusColor(selectedRun.status)} border`}>
                    {getStatusIcon(selectedRun.status)}
                    <span className="ml-1 capitalize">{selectedRun.status}</span>
                  </Badge>
                  <span>Started {new Date(selectedRun.startedAt).toLocaleString()}</span>
                  {selectedRun.completedAt && (
                    <span>
                      Completed {new Date(selectedRun.completedAt).toLocaleString()}
                    </span>
                  )}
                  {selectedRun.currentStep && <span>Current step: {selectedRun.currentStep}</span>}
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-[13px] max-h-96 overflow-y-auto space-y-1">
              {selectedRun.logs && selectedRun.logs.length > 0 ? (
                selectedRun.logs.map((line, index) => (
                  <div key={`${selectedRun.id}-log-${index}`}>{line}</div>
                ))
              ) : (
                <div className="text-muted-foreground text-[11px]">
                  No logs have been recorded for this run yet.
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
