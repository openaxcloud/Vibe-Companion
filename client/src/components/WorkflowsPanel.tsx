import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Plus, X, Play, ChevronDown, ChevronRight, CheckCircle, XCircle,
  Clock, Trash2, GripVertical, RotateCcw, GitMerge, SkipForward, Layers, Zap, Terminal
} from "lucide-react";

interface WorkflowsPanelProps {
  projectId: string;
  onClose: () => void;
}

interface WorkflowStep {
  id: string;
  workflowId: string;
  name: string;
  command: string;
  taskType: string;
  orderIndex: number;
  continueOnError: boolean;
}

interface Workflow {
  id: string;
  projectId: string;
  name: string;
  triggerEvent: string;
  executionMode: string;
  enabled: boolean;
  createdAt: string;
  steps: WorkflowStep[];
}

interface StepResult {
  stepId: string;
  name: string;
  status: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

interface WorkflowRun {
  id: string;
  workflowId: string;
  status: string;
  stepResults: StepResult[] | null;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
}

interface WorkflowTemplate {
  name: string;
  triggerEvent: string;
  steps: { name: string; command: string; taskType?: string }[];
}

export default function WorkflowsPanel({ projectId, onClose }: WorkflowsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState("manual");
  const [newExecMode, setNewExecMode] = useState("sequential");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingStep, setAddingStep] = useState<string | null>(null);
  const [newStepName, setNewStepName] = useState("");
  const [newStepCommand, setNewStepCommand] = useState("");
  const [newStepTaskType, setNewStepTaskType] = useState("shell");
  const [showRuns, setShowRuns] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragWorkflowId, setDragWorkflowId] = useState<string | null>(null);

  const workflowsQuery = useQuery<Workflow[]>({
    queryKey: ["/api/projects", projectId, "workflows"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/workflows`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const templatesQuery = useQuery<WorkflowTemplate[]>({
    queryKey: ["/api/workflow-templates"],
    queryFn: async () => {
      const res = await fetch("/api/workflow-templates", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: showTemplates,
  });

  const runsQuery = useQuery<WorkflowRun[]>({
    queryKey: ["/api/workflows", showRuns, "runs"],
    queryFn: async () => {
      if (!showRuns) return [];
      const res = await fetch(`/api/workflows/${showRuns}/runs`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!showRuns,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/workflows`, { name: newName, triggerEvent: newTrigger, executionMode: newExecMode });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflows"] });
      setCreating(false);
      setNewName("");
      setNewExecMode("sequential");
      toast({ title: "Workflow created" });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: async (templateName: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/workflows/from-template`, { templateName });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflows"] });
      setShowTemplates(false);
      toast({ title: "Workflow created from template" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/workflows/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflows"] });
      toast({ title: "Workflow deleted" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/workflows/${id}`, { enabled });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflows"] }),
  });

  const updateWorkflowMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; executionMode?: string; triggerEvent?: string }) => {
      const res = await apiRequest("PATCH", `/api/workflows/${id}`, data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflows"] }),
  });

  const addStepMutation = useMutation({
    mutationFn: async ({ workflowId, name, command, taskType, orderIndex }: { workflowId: string; name: string; command: string; taskType: string; orderIndex: number }) => {
      const res = await apiRequest("POST", `/api/workflows/${workflowId}/steps`, { name, command, taskType, orderIndex });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflows"] });
      setAddingStep(null);
      setNewStepName("");
      setNewStepCommand("");
      setNewStepTaskType("shell");
    },
  });

  const deleteStepMutation = useMutation({
    mutationFn: async (stepId: string) => { await apiRequest("DELETE", `/api/workflow-steps/${stepId}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflows"] }),
  });

  const toggleStepContinueMutation = useMutation({
    mutationFn: async ({ stepId, continueOnError }: { stepId: string; continueOnError: boolean }) => {
      const res = await apiRequest("PATCH", `/api/workflow-steps/${stepId}`, { continueOnError });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflows"] }),
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ workflowId, updates }: { workflowId: string; updates: { id: string; orderIndex: number }[] }) => {
      const res = await apiRequest("PUT", `/api/workflows/${workflowId}/steps/reorder`, { updates });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflows"] }),
  });

  const runMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const res = await apiRequest("POST", `/api/workflows/${workflowId}/run`);
      return res.json();
    },
    onSuccess: (data, workflowId) => {
      toast({ title: data.success ? "Workflow completed" : "Workflow failed", variant: data.success ? "default" : "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "workflows"] });
      if (showRuns === workflowId) queryClient.invalidateQueries({ queryKey: ["/api/workflows", showRuns, "runs"] });
    },
  });

  const handleDragStart = useCallback((index: number, workflowId: string) => {
    dragItem.current = index;
    setDragWorkflowId(workflowId);
  }, []);

  const handleDragEnter = useCallback((index: number) => {
    dragOverItem.current = index;
  }, []);

  const handleDragEnd = useCallback((workflow: Workflow) => {
    if (dragItem.current === null || dragOverItem.current === null || dragWorkflowId !== workflow.id) {
      dragItem.current = null;
      dragOverItem.current = null;
      setDragWorkflowId(null);
      return;
    }
    const from = dragItem.current;
    const to = dragOverItem.current;
    if (from === to) {
      dragItem.current = null;
      dragOverItem.current = null;
      setDragWorkflowId(null);
      return;
    }
    const reordered = [...workflow.steps];
    const [removed] = reordered.splice(from, 1);
    reordered.splice(to, 0, removed);
    const updates = reordered.map((s, i) => ({ id: s.id, orderIndex: i }));
    reorderMutation.mutate({ workflowId: workflow.id, updates });
    dragItem.current = null;
    dragOverItem.current = null;
    setDragWorkflowId(null);
  }, [dragWorkflowId, reorderMutation]);

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle className="w-3 h-3 text-[#0CCE6B] shrink-0" />;
      case "failed": return <XCircle className="w-3 h-3 text-red-400 shrink-0" />;
      case "running": return <Loader2 className="w-3 h-3 text-[#0079F2] animate-spin shrink-0" />;
      case "skipped": return <SkipForward className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />;
      default: return <Clock className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />;
    }
  };

  const taskTypeLabel = (t: string) => {
    switch (t) {
      case "install_packages": return "Install Pkgs";
      case "run_workflow": return "Run Workflow";
      default: return "Shell";
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="workflows-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest flex items-center gap-1.5">
          <GitMerge className="w-3.5 h-3.5 text-[#0079F2]" /> Workflows
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => { setShowTemplates(!showTemplates); setCreating(false); }} data-testid="button-workflow-templates">
            <RotateCcw className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => { setCreating(!creating); setShowTemplates(false); }} data-testid="button-new-workflow">
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-workflows">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {showTemplates && (
        <div className="px-3 py-2 border-b border-[var(--ide-border)]">
          <span className="text-[9px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Templates</span>
          <div className="mt-1.5 space-y-1">
            {(templatesQuery.data || []).map((t) => (
              <button key={t.name} className="w-full text-left px-2.5 py-2 rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)] hover:border-[#0079F2]/30 transition-colors"
                onClick={() => createFromTemplateMutation.mutate(t.name)} data-testid={`template-${t.name}`}>
                <span className="text-[10px] text-[var(--ide-text)] font-medium block">{t.name}</span>
                <span className="text-[8px] text-[var(--ide-text-muted)]">{t.steps.length} steps · {t.triggerEvent}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {creating && (
        <div className="px-3 py-2 border-b border-[var(--ide-border)] space-y-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Workflow name..." className="h-7 text-xs bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)]" data-testid="input-workflow-name" />
          <div className="flex gap-1.5">
            <select value={newTrigger} onChange={(e) => setNewTrigger(e.target.value)} className="flex-1 h-7 text-[10px] bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] rounded-md px-2" data-testid="select-workflow-trigger">
              <option value="manual">Manual</option>
              <option value="on-save">On Save</option>
              <option value="on-deploy">On Deploy</option>
              <option value="on-commit">On Commit</option>
            </select>
            <select value={newExecMode} onChange={(e) => setNewExecMode(e.target.value)} className="flex-1 h-7 text-[10px] bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] rounded-md px-2" data-testid="select-execution-mode">
              <option value="sequential">Sequential</option>
              <option value="parallel">Parallel</option>
            </select>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" className="h-7 px-3 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/80 text-white rounded-md font-semibold" onClick={() => createMutation.mutate()} disabled={!newName.trim() || createMutation.isPending} data-testid="button-create-workflow">
              {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create"}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-3 text-[10px]" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {workflowsQuery.isLoading && (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-[var(--ide-text-muted)] animate-spin" /></div>
        )}

        {workflowsQuery.data && workflowsQuery.data.length === 0 && !creating && !showTemplates && (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <GitMerge className="w-8 h-8 text-[var(--ide-text-muted)] mb-2 opacity-30" />
            <p className="text-xs text-[var(--ide-text-muted)]">No workflows yet</p>
            <p className="text-[10px] text-[var(--ide-text-muted)] mt-1 opacity-60">Create multi-step build/run workflows</p>
            <Button size="sm" className="mt-3 h-7 px-3 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/80 text-white rounded-md" onClick={() => setShowTemplates(true)} data-testid="button-browse-templates">
              Browse Templates
            </Button>
          </div>
        )}

        {workflowsQuery.data?.map((workflow) => (
          <div key={workflow.id} className="border-b border-[var(--ide-border)]/50" data-testid={`workflow-item-${workflow.id}`}>
            <div className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--ide-surface)]/30 cursor-pointer" onClick={() => setExpandedId(expandedId === workflow.id ? null : workflow.id)}>
              {expandedId === workflow.id ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />}
              <GitMerge className="w-3.5 h-3.5 text-[#0079F2] shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] text-[var(--ide-text)] font-medium truncate block">{workflow.name}</span>
                <span className="text-[9px] text-[var(--ide-text-muted)]">
                  {workflow.steps.length} step{workflow.steps.length !== 1 ? "s" : ""} · {workflow.triggerEvent}
                  {workflow.executionMode === "parallel" && <span className="ml-1 text-[#0079F2]">⚡ parallel</span>}
                </span>
              </div>
              <Switch checked={workflow.enabled} onCheckedChange={(checked) => toggleMutation.mutate({ id: workflow.id, enabled: checked })}
                className="scale-75" onClick={(e) => e.stopPropagation()} data-testid={`switch-workflow-${workflow.id}`} />
            </div>

            {expandedId === workflow.id && (
              <div className="px-3 pb-2 space-y-2">
                <div className="flex gap-1.5 items-center">
                  <select
                    value={workflow.executionMode}
                    onChange={(e) => updateWorkflowMutation.mutate({ id: workflow.id, executionMode: e.target.value })}
                    className="h-6 text-[9px] bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] rounded px-1.5"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`select-exec-mode-${workflow.id}`}
                  >
                    <option value="sequential">Sequential</option>
                    <option value="parallel">Parallel</option>
                  </select>
                  <select
                    value={workflow.triggerEvent}
                    onChange={(e) => updateWorkflowMutation.mutate({ id: workflow.id, triggerEvent: e.target.value })}
                    className="h-6 text-[9px] bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] rounded px-1.5"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`select-trigger-${workflow.id}`}
                  >
                    <option value="manual">Manual</option>
                    <option value="on-save">On Save</option>
                    <option value="on-deploy">On Deploy</option>
                    <option value="on-commit">On Commit</option>
                  </select>
                </div>

                <div className="space-y-1">
                  {workflow.steps.map((step, i) => (
                    <div
                      key={step.id}
                      className={`flex items-center gap-1.5 px-2 py-1.5 bg-[var(--ide-bg)] rounded-md border border-[var(--ide-border)] group ${dragWorkflowId === workflow.id ? 'cursor-grabbing' : ''}`}
                      draggable
                      onDragStart={() => handleDragStart(i, workflow.id)}
                      onDragEnter={() => handleDragEnter(i)}
                      onDragEnd={() => handleDragEnd(workflow)}
                      onDragOver={(e) => e.preventDefault()}
                      data-testid={`workflow-step-${step.id}`}
                    >
                      <GripVertical className="w-3 h-3 text-[var(--ide-border)] shrink-0 cursor-grab" />
                      <span className="text-[9px] font-bold text-[var(--ide-text-muted)] w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[var(--ide-text)] font-medium truncate">{step.name}</span>
                          {step.taskType !== "shell" && (
                            <span className="text-[7px] px-1 py-0.5 rounded bg-[#0079F2]/10 text-[#0079F2] font-medium shrink-0">
                              {taskTypeLabel(step.taskType)}
                            </span>
                          )}
                        </div>
                        <span className="text-[8px] text-[var(--ide-text-muted)] font-mono truncate block">{step.command}</span>
                      </div>
                      <button className="p-0.5 opacity-0 group-hover:opacity-100 transition-opacity" title={step.continueOnError ? "Continues on error" : "Stops on error"}
                        onClick={() => toggleStepContinueMutation.mutate({ stepId: step.id, continueOnError: !step.continueOnError })}
                        data-testid={`button-toggle-continue-${step.id}`}>
                        {step.continueOnError ? <SkipForward className="w-3 h-3 text-yellow-400" /> : <XCircle className="w-3 h-3 text-[var(--ide-text-muted)]" />}
                      </button>
                      <button className="p-0.5 text-[var(--ide-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteStepMutation.mutate(step.id)} data-testid={`button-delete-step-${step.id}`}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {addingStep === workflow.id ? (
                  <div className="space-y-1.5 p-2 bg-[var(--ide-bg)] rounded-md border border-[var(--ide-border)]">
                    <Input value={newStepName} onChange={(e) => setNewStepName(e.target.value)} placeholder="Step name..." className="h-6 text-[10px] bg-transparent border-[var(--ide-border)] text-[var(--ide-text)]" data-testid="input-step-name" />
                    <select
                      value={newStepTaskType}
                      onChange={(e) => setNewStepTaskType(e.target.value)}
                      className="w-full h-6 text-[10px] bg-transparent border border-[var(--ide-border)] text-[var(--ide-text)] rounded-md px-2"
                      data-testid="select-step-task-type"
                    >
                      <option value="shell">Execute Shell Command</option>
                      <option value="install_packages">Install Packages</option>
                      <option value="run_workflow">Run Workflow</option>
                    </select>
                    <Input
                      value={newStepCommand}
                      onChange={(e) => setNewStepCommand(e.target.value)}
                      placeholder={newStepTaskType === "run_workflow" ? "Workflow ID..." : newStepTaskType === "install_packages" ? "Package name or install command..." : "Command..."}
                      className="h-6 text-[10px] font-mono bg-transparent border-[var(--ide-border)] text-[var(--ide-text)]"
                      data-testid="input-step-command"
                    />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-5 px-2 text-[8px] bg-[#0079F2] hover:bg-[#0079F2]/80 text-white rounded"
                        onClick={() => addStepMutation.mutate({ workflowId: workflow.id, name: newStepName || "New Step", command: newStepCommand || "echo 'hello'", taskType: newStepTaskType, orderIndex: workflow.steps.length })}
                        disabled={addStepMutation.isPending} data-testid="button-add-step">Add</Button>
                      <Button variant="ghost" size="sm" className="h-5 px-2 text-[8px]" onClick={() => setAddingStep(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <button className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-dashed border-[var(--ide-border)] text-[9px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:border-[var(--ide-text-muted)] transition-colors"
                    onClick={() => setAddingStep(workflow.id)} data-testid={`button-add-step-${workflow.id}`}>
                    <Plus className="w-3 h-3" /> Add Step
                  </button>
                )}

                <div className="flex gap-1">
                  <Button size="sm" className="h-6 px-2 text-[9px] bg-[#0CCE6B] hover:bg-[#0CCE6B]/80 text-black rounded gap-1" onClick={() => runMutation.mutate(workflow.id)}
                    disabled={runMutation.isPending || workflow.steps.length === 0} data-testid={`button-run-workflow-${workflow.id}`}>
                    {runMutation.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />}
                    Run
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px] gap-1" onClick={() => setShowRuns(showRuns === workflow.id ? null : workflow.id)} data-testid={`button-show-workflow-runs-${workflow.id}`}>
                    <RotateCcw className="w-2.5 h-2.5" /> History
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px] text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => deleteMutation.mutate(workflow.id)} data-testid={`button-delete-workflow-${workflow.id}`}>
                    <Trash2 className="w-2.5 h-2.5" />
                  </Button>
                </div>

                {showRuns === workflow.id && (
                  <div className="border-t border-[var(--ide-border)] pt-2">
                    <span className="text-[9px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Run History</span>
                    {runsQuery.isLoading && <Loader2 className="w-3 h-3 text-[var(--ide-text-muted)] animate-spin mt-1" />}
                    {runsQuery.data && runsQuery.data.length === 0 && (
                      <p className="text-[9px] text-[var(--ide-text-muted)] mt-1">No runs yet</p>
                    )}
                    <div className="mt-1 space-y-1.5 max-h-60 overflow-y-auto">
                      {runsQuery.data?.map((run) => (
                        <div key={run.id} className="p-2 rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)]" data-testid={`workflow-run-${run.id}`}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            {run.status === "success" ? <CheckCircle className="w-3 h-3 text-[#0CCE6B]" /> : run.status === "running" ? <Loader2 className="w-3 h-3 text-[#0079F2] animate-spin" /> : <XCircle className="w-3 h-3 text-red-400" />}
                            <span className={`text-[9px] font-medium ${run.status === "success" ? "text-[#0CCE6B]" : run.status === "running" ? "text-[#0079F2]" : "text-red-400"}`}>{run.status}</span>
                            {run.durationMs && <span className="text-[8px] text-[var(--ide-text-muted)]">{run.durationMs}ms</span>}
                            <span className="text-[8px] text-[var(--ide-text-muted)] ml-auto">{new Date(run.startedAt).toLocaleString()}</span>
                          </div>
                          {run.stepResults && run.stepResults.map((sr, i) => {
                            const stepKey = `${run.id}-${i}`;
                            const isExpanded = expandedStepId === stepKey;
                            const hasOutput = (sr.stdout && sr.stdout.trim()) || (sr.stderr && sr.stderr.trim());
                            return (
                              <div key={i}>
                                <div
                                  className={`flex items-start gap-1.5 pl-2 py-0.5 ${hasOutput ? 'cursor-pointer hover:bg-[var(--ide-surface)]/30 rounded' : ''}`}
                                  onClick={() => hasOutput && setExpandedStepId(isExpanded ? null : stepKey)}
                                  data-testid={`step-result-${i}`}
                                >
                                  {getStepStatusIcon(sr.status)}
                                  <span className="text-[8px] text-[var(--ide-text)] flex-1">{sr.name}</span>
                                  {hasOutput && (
                                    <Terminal className="w-2.5 h-2.5 text-[var(--ide-text-muted)]" />
                                  )}
                                  {sr.durationMs > 0 && <span className="text-[7px] text-[var(--ide-text-muted)]">{sr.durationMs}ms</span>}
                                </div>
                                {isExpanded && hasOutput && (
                                  <div className="ml-5 mt-0.5 mb-1 p-1.5 rounded bg-black/30 border border-[var(--ide-border)]/50 max-h-32 overflow-y-auto">
                                    {sr.stdout && sr.stdout.trim() && (
                                      <pre className="text-[7px] text-[var(--ide-text-muted)] font-mono whitespace-pre-wrap break-all">{sr.stdout.trim()}</pre>
                                    )}
                                    {sr.stderr && sr.stderr.trim() && (
                                      <pre className="text-[7px] text-red-400/80 font-mono whitespace-pre-wrap break-all mt-0.5">{sr.stderr.trim()}</pre>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
