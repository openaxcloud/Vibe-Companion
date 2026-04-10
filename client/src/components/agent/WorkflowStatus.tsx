import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Workflow
} from 'lucide-react';

interface WorkflowStep {
  id: string;
  name: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  output?: any;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
}

interface WorkflowData {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  progress: number;
  currentStep: string;
  steps: WorkflowStep[];
  error?: string;
  sessionId: string;
  projectId: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  metadata?: Record<string, any>;
}

interface WorkflowsResponse {
  workflows: WorkflowData[];
  total: number;
}

const statusConfig: Record<string, { icon: typeof Play; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pending' },
  in_progress: { icon: Loader2, color: 'text-blue-500', label: 'Running' },
  running: { icon: Loader2, color: 'text-blue-500', label: 'Running' },
  completed: { icon: CheckCircle2, color: 'text-green-500', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
  rolled_back: { icon: RefreshCw, color: 'text-orange-500', label: 'Rolled Back' }
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function StepItem({ step, index }: { step: WorkflowStep; index: number }) {
  const config = statusConfig[step.status] || statusConfig.pending;
  const Icon = config.icon;
  const isRunning = step.status === 'running';
  
  return (
    <div 
      className="flex items-start gap-3 py-2 border-l-2 pl-4 ml-3"
      style={{ borderColor: step.status === 'completed' ? '#22c55e' : step.status === 'failed' ? '#ef4444' : '#e5e7eb' }}
      data-testid={`step-${step.id || index}`}
    >
      <div className={`mt-0.5 ${config.color}`}>
        <Icon className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-[13px]">{step.name}</span>
          <Badge variant="outline" className="text-[10px]">
            {step.type}
          </Badge>
          {step.duration && (
            <span className="text-[11px] text-muted-foreground">
              {formatDuration(step.duration)}
            </span>
          )}
        </div>
        {step.error && (
          <p className="text-[11px] text-destructive mt-1 font-mono bg-destructive/10 rounded p-1.5">
            {step.error}
          </p>
        )}
        {step.status === 'running' && (
          <div className="flex items-center gap-2 mt-1">
            <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WorkflowCard({ workflow }: { workflow: WorkflowData }) {
  const [expanded, setExpanded] = useState(workflow.status === 'in_progress');
  const config = statusConfig[workflow.status] || statusConfig.pending;
  const Icon = config.icon;
  const isRunning = workflow.status === 'in_progress';
  
  const steps = workflow.steps || [];
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const duration = workflow.completedAt && workflow.startedAt
    ? new Date(workflow.completedAt).getTime() - new Date(workflow.startedAt).getTime()
    : workflow.startedAt
      ? Date.now() - new Date(workflow.startedAt).getTime()
      : 0;
  
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card 
        className={`transition-all ${isRunning ? 'border-blue-500/50 shadow-lg shadow-blue-500/10' : ''}`}
        data-testid={`card-workflow-${workflow.id}`}
      >
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`p-2 rounded-lg bg-muted ${config.color}`}>
                  <Icon className={`h-5 w-5 ${isRunning ? 'animate-spin' : ''}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    {workflow.name}
                    <Badge variant={workflow.status === 'completed' ? 'default' : workflow.status === 'failed' ? 'destructive' : 'secondary'}>
                      {config.label}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="mt-1 line-clamp-2">
                    {workflow.description}
                  </CardDescription>
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                    <span>Started: {formatTime(workflow.startedAt)}</span>
                    {duration > 0 && <span>Duration: {formatDuration(duration)}</span>}
                    <span>Steps: {completedSteps}/{steps.length}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-2xl font-bold">{workflow.progress}%</div>
                </div>
                {expanded ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
            <Progress value={workflow.progress} className="mt-3 h-2" />
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {workflow.error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium text-[13px]">Workflow Error</span>
                </div>
                <p className="text-[11px] text-destructive/80 mt-1 font-mono">{workflow.error}</p>
              </div>
            )}
            
            <div className="space-y-1">
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Workflow Steps
              </h4>
              {steps.length > 0 ? (
                steps.map((step, idx) => (
                  <StepItem key={step.id || idx} step={step} index={idx} />
                ))
              ) : (
                <p className="text-[13px] text-muted-foreground">No steps defined</p>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function WorkflowStatus({ projectId }: { projectId?: number }) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const { data, isLoading, error, refetch } = useQuery<WorkflowsResponse>({
    queryKey: ['/api/agent/workflows', { projectId, status: statusFilter === 'all' ? undefined : statusFilter }],
    refetchInterval: 5000
  });
  
  const workflows = data?.workflows || [];
  const activeCount = workflows.filter(w => w.status === 'in_progress').length;
  
  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6 text-center">
          <p className="text-destructive">Failed to load workflows</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4" data-testid="workflow-status">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Workflows</h3>
          {activeCount > 0 && (
            <Badge variant="default" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {activeCount} running
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => refetch()}
            data-testid="button-refresh-workflows"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full mt-2" />
                <Skeleton className="h-2 w-full mt-3" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : workflows.length > 0 ? (
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {workflows.map((workflow) => (
              <WorkflowCard key={workflow.id} workflow={workflow} />
            ))}
          </div>
        </ScrollArea>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Workflow className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No workflows found</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Workflows will appear here when the agent executes multi-step tasks
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default WorkflowStatus;
