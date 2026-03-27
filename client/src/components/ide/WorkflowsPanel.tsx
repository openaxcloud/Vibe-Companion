import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Globe, TestTube, Package, Database, Loader2, Check,
  Settings, Clock, Star, Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

interface Workflow {
  id: string;
  name: string;
  command: string;
  description?: string;
  icon?: string;
  isDefault?: boolean;
  isSystem?: boolean;
  runOnStart?: boolean;
  lastRun?: string;
  runCount?: number;
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
  { id: 'dev', name: 'Development', command: 'npm run dev', description: 'Start development server with hot reload', icon: 'play', isSystem: true, isDefault: true },
  { id: 'build', name: 'Build', command: 'npm run build', description: 'Build production bundle', icon: 'package', isSystem: true },
  { id: 'test', name: 'Test', command: 'npm test', description: 'Run test suite', icon: 'test', isSystem: true },
  { id: 'preview', name: 'Preview', command: 'npm run preview', description: 'Preview production build', icon: 'globe', isSystem: true },
];

export function WorkflowsPanel({ projectId, onRunWorkflow, className }: WorkflowsPanelProps) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [formData, setFormData] = useState({ name: '', command: '', description: '', icon: 'play' });

  const { data: customWorkflows, isLoading } = useQuery<Workflow[]>({
    queryKey: ['/api/workflows', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/workflows?projectId=${projectId}`, {
        credentials: 'include'
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!projectId
  });

  const createMutation = useMutation({
    mutationFn: async (workflow: Omit<Workflow, 'id'>) => {
      return apiRequest('POST', '/api/workflows', {
        ...workflow,
        projectId
      });
    },
    onSuccess: () => {
      toast({ title: 'Workflow created' });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', projectId] });
      setIsCreating(false);
      setFormData({ name: '', command: '', description: '', icon: 'play' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create workflow', description: error.message, variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (workflow: Workflow) => {
      return apiRequest('PUT', `/api/workflows/${workflow.id}`, {
        ...workflow,
        projectId
      });
    },
    onSuccess: () => {
      toast({ title: 'Workflow updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', projectId] });
      setEditingWorkflow(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      return apiRequest('DELETE', `/api/workflows/${workflowId}`, {});
    },
    onSuccess: () => {
      toast({ title: 'Workflow deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', projectId] });
    }
  });

  const runMutation = useMutation({
    mutationFn: async (workflow: Workflow) => {
      return apiRequest('POST', `/api/preview/projects/${projectId}/preview/start`, {
        workflow: workflow.id,
        command: workflow.command
      });
    },
    onSuccess: (_, workflow) => {
      toast({ title: `Running: ${workflow.name}` });
      onRunWorkflow?.(workflow);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to run workflow', description: error.message, variant: 'destructive' });
    }
  });

  const getIcon = (iconId: string) => {
    return ICON_OPTIONS.find(o => o.id === iconId)?.icon || Terminal;
  };

  const allWorkflows = [...SYSTEM_WORKFLOWS, ...(customWorkflows || [])];

  const WorkflowCard = ({ workflow }: { workflow: Workflow }) => {
    const Icon = getIcon(workflow.icon || 'terminal');
    const isRunning = runMutation.isPending && runMutation.variables?.id === workflow.id;

    return (
      <Card className={cn("group hover:shadow-md transition-all", workflow.isDefault && "ring-1 ring-primary/20")}>
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              workflow.isDefault ? "bg-primary/10" : "bg-muted"
            )}>
              <Icon className={cn("h-4 w-4", workflow.isDefault && "text-primary")} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium truncate">{workflow.name}</span>
                {workflow.isDefault && (
                  <Badge variant="outline" className="text-[10px] h-4">
                    <Star className="h-2.5 w-2.5 mr-0.5" />
                    Default
                  </Badge>
                )}
                {workflow.isSystem && (
                  <Badge variant="secondary" className="text-[10px] h-4">System</Badge>
                )}
              </div>
              {workflow.description && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {workflow.description}
                </p>
              )}
              <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded mt-1.5 inline-block">
                {workflow.command}
              </code>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => runMutation.mutate(workflow)}
                disabled={isRunning}
                className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                {isRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
              
              {!workflow.isSystem && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      setFormData({
                        name: workflow.name,
                        command: workflow.command,
                        description: workflow.description || '',
                        icon: workflow.icon || 'play'
                      });
                      setEditingWorkflow(workflow);
                    }}>
                      <Edit2 className="h-3.5 w-3.5 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      navigator.clipboard.writeText(workflow.command);
                      toast({ title: 'Command copied' });
                    }}>
                      <Copy className="h-3.5 w-3.5 mr-2" />
                      Copy Command
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => deleteMutation.mutate(workflow.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete
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
        />
      </div>

      <div className="space-y-2">
        <Label className="text-[11px]">Command</Label>
        <Input
          value={formData.command}
          onChange={(e) => setFormData(prev => ({ ...prev, command: e.target.value }))}
          placeholder="e.g., npm run deploy"
          className="h-8 text-[13px] font-mono"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-[11px]">Description (optional)</Label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Brief description of what this workflow does"
          className="h-8 text-[13px]"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-[11px]">Icon</Label>
        <div className="flex gap-1">
          {ICON_OPTIONS.map(option => {
            const Icon = option.icon;
            return (
              <Button
                key={option.id}
                variant={formData.icon === option.id ? "default" : "outline"}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setFormData(prev => ({ ...prev, icon: option.id }))}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={!formData.name || !formData.command}
        >
          {isEdit ? 'Update' : 'Create'} Workflow
        </Button>
      </div>
    </div>
  );

  return (
    <div className={cn("h-full flex flex-col bg-[var(--ecode-surface)]", className)}>
      <div className="h-9 border-b border-[var(--ecode-border)] flex items-center justify-between px-2.5 bg-[var(--ecode-surface)]">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text-muted)]">Workflows</span>
          <Badge variant="secondary" className="text-[11px]">
            {allWorkflows.length}
          </Badge>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-[11px]">
              <Plus className="h-3.5 w-3.5 mr-1" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Workflow</DialogTitle>
              <DialogDescription>
                Create a custom workflow to automate development tasks
              </DialogDescription>
            </DialogHeader>
            <WorkflowForm
              onSubmit={() => createMutation.mutate({
                name: formData.name,
                command: formData.command,
                description: formData.description,
                icon: formData.icon
              })}
              onCancel={() => {
                setIsCreating(false);
                setFormData({ name: '', command: '', description: '', icon: 'play' });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1">
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

      <Dialog open={!!editingWorkflow} onOpenChange={(open) => !open && setEditingWorkflow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Workflow</DialogTitle>
          </DialogHeader>
          <WorkflowForm
            isEdit
            onSubmit={() => editingWorkflow && updateMutation.mutate({
              ...editingWorkflow,
              name: formData.name,
              command: formData.command,
              description: formData.description,
              icon: formData.icon
            })}
            onCancel={() => setEditingWorkflow(null)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
