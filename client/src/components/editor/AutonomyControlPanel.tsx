// @ts-nocheck
import { useState, useCallback, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  Zap, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Settings,
  ChevronDown,
  ChevronUp,
  Loader2,
  Target,
  Shield,
  TestTube,
  Save,
  ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  useMaxAutonomy, 
  type RiskThreshold, 
  type SessionStatus, 
  type TaskStatus,
  type TaskPriority,
  type MaxAutonomyTask
} from '@/hooks/useMaxAutonomy';
import { cn } from '@/lib/utils';

interface AutonomyControlPanelProps {
  projectId: number;
  onBack?: () => void;
}

const STATUS_CONFIG: Record<SessionStatus, { label: string; color: string; icon: typeof Play }> = {
  pending: { label: 'Pending', color: 'bg-yellow-500', icon: Clock },
  active: { label: 'Running', color: 'bg-green-500', icon: Play },
  paused: { label: 'Paused', color: 'bg-blue-500', icon: Pause },
  completed: { label: 'Completed', color: 'bg-emerald-500', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500', icon: Square },
  failed: { label: 'Failed', color: 'bg-red-500', icon: XCircle },
};

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  running: { label: 'Running', variant: 'default' },
  completed: { label: 'Done', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
  skipped: { label: 'Skipped', variant: 'outline' },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-gray-500' },
  medium: { label: 'Medium', color: 'text-blue-500' },
  high: { label: 'High', color: 'text-orange-500' },
  critical: { label: 'Critical', color: 'text-red-500' },
};

const RISK_THRESHOLD_INFO: Record<RiskThreshold, { label: string; description: string; color: string }> = {
  low: {
    label: '⚡ Low Risk (Fast)',
    description: 'Auto-approve most actions. Maximum speed.',
    color: 'text-green-600 dark:text-green-400',
  },
  medium: {
    label: '⚖️ Medium Risk (Balanced)',
    description: 'Balanced speed and safety.',
    color: 'text-blue-600 dark:text-blue-400',
  },
  high: {
    label: '🛡️ High Risk (Conservative)',
    description: 'More caution, slower execution.',
    color: 'text-orange-600 dark:text-orange-400',
  },
  critical: {
    label: '🔒 Critical (Maximum Safety)',
    description: 'Maximum safety, requires more approvals.',
    color: 'text-red-600 dark:text-red-400',
  },
};

function formatDuration(ms: number): string {
  if (ms < 0) return '--';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function TaskItem({ task, isCurrentTask }: { task: MaxAutonomyTask; isCurrentTask: boolean }) {
  const statusConfig = TASK_STATUS_CONFIG[task.status];
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  
  return (
    <div 
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border transition-all",
        isCurrentTask ? "border-primary bg-primary/5" : "border-border bg-card",
        task.status === 'running' && "animate-pulse"
      )}
      data-testid={`task-item-${task.id}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate" data-testid={`task-title-${task.id}`}>
              {task.title}
            </span>
            {isCurrentTask && (
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
            )}
          </div>
          {task.description && (
            <span className="text-[11px] text-muted-foreground truncate">
              {task.description}
            </span>
          )}
          {task.errorMessage && (
            <span className="text-[11px] text-destructive truncate">
              {task.errorMessage}
            </span>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn("text-[11px] font-medium", priorityConfig.color)}>
          {priorityConfig.label}
        </span>
        <Badge variant={statusConfig.variant} data-testid={`task-status-${task.id}`}>
          {statusConfig.label}
        </Badge>
      </div>
    </div>
  );
}

export function AutonomyControlPanel({ projectId, onBack }: AutonomyControlPanelProps) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [goal, setGoal] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [showTasks, setShowTasks] = useState(true);
  
  const [config, setConfig] = useState({
    autoCheckpoint: true,
    autoTest: true,
    autoRollback: true,
    riskThreshold: 'medium' as RiskThreshold,
    maxDurationMinutes: 240,
  });

  const {
    session,
    progress,
    tasks,
    isLoadingSession,
    isLoadingProgress,
    isLoadingTasks,
    sessionError,
    progressError,
    isPolling,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    isStartingSession,
    isPausingSession,
    isResumingSession,
    isStoppingSession,
  } = useMaxAutonomy(activeSessionId, projectId);

  const handleStartSession = useCallback(() => {
    if (!goal.trim()) return;
    
    startSession({
      projectId,
      goal: goal.trim(),
      ...config,
    }, {
      onSuccess: (response) => {
        if (response.success) {
          setActiveSessionId(response.session.id);
          setGoal('');
        }
      },
    });
  }, [goal, config, projectId, startSession]);

  const handleStopSession = useCallback(() => {
    if (!activeSessionId) return;
    stopSession({ sessionId: activeSessionId, projectId }, {
      onSuccess: () => {
        setActiveSessionId(null);
      },
    });
  }, [stopSession, activeSessionId, projectId]);

  const progressPercent = useMemo(() => {
    if (!progress || !progress.tasksTotal) return 0;
    return Math.round((progress.tasksCompleted / progress.tasksTotal) * 100);
  }, [progress]);

  const hasActiveSession = session && ['active', 'paused', 'pending'].includes(session.status);
  const isSessionRunning = session?.status === 'active';
  const isSessionPaused = session?.status === 'paused';
  const isLoading = isLoadingSession || isLoadingProgress;
  const error = sessionError || progressError;
  const isBusy = isStartingSession || isPausingSession || isResumingSession || isStoppingSession;

  const currentTask = useMemo(() => {
    if (!progress?.currentTaskId || !tasks.length) return null;
    return tasks.find(t => t.id === progress.currentTaskId) || null;
  }, [progress?.currentTaskId, tasks]);

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-[var(--ecode-surface)]" data-testid="autonomy-control-panel">
        <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
          <div className="flex items-center gap-1.5">
            {onBack && (
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]" onClick={onBack} data-testid="button-back">
                <ArrowLeft className="w-3.5 h-3.5" />
              </Button>
            )}
            <Zap className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs font-medium text-[var(--ecode-text)]">Autonomy</span>
          </div>
          
          <div className="flex items-center gap-1">
            {session && (
              <>
                {isPolling && (
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center gap-1 text-[9px] text-[var(--ecode-text-muted)]">
                        <div className="h-1.5 w-1.5 rounded-full bg-[hsl(142,72%,42%)] animate-pulse" />
                        Live
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Polling every 2 seconds</TooltipContent>
                  </Tooltip>
                )}
                <Badge 
                  className={cn("h-4 px-1 text-[9px] rounded", STATUS_CONFIG[session.status].color, "text-white")}
                  data-testid="badge-session-status"
                >
                  {STATUS_CONFIG[session.status].label}
                </Badge>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2" data-testid="error-display">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 text-[13px]">
                <p className="font-medium text-destructive">Error</p>
                <p className="text-muted-foreground text-[11px]">{error.message}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.reload()}
                data-testid="button-retry"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          )}

          {!hasActiveSession ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="goal-input" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Goal
                </Label>
                <Input
                  id="goal-input"
                  placeholder="Describe what you want the AI to accomplish..."
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && goal.trim() && !isStartingSession) {
                      handleStartSession();
                    }
                  }}
                  disabled={isStartingSession}
                  data-testid="input-goal"
                />
              </div>

              <Collapsible open={showConfig} onOpenChange={setShowConfig}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between" data-testid="button-toggle-config">
                    <span className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Configuration
                    </span>
                    {showConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Save className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="auto-checkpoint" className="text-[13px]">Auto-Checkpoint</Label>
                      </div>
                      <Switch
                        id="auto-checkpoint"
                        checked={config.autoCheckpoint}
                        onCheckedChange={(checked) => setConfig(c => ({ ...c, autoCheckpoint: checked }))}
                        data-testid="switch-auto-checkpoint"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TestTube className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="auto-test" className="text-[13px]">Auto-Test</Label>
                      </div>
                      <Switch
                        id="auto-test"
                        checked={config.autoTest}
                        onCheckedChange={(checked) => setConfig(c => ({ ...c, autoTest: checked }))}
                        data-testid="switch-auto-test"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="auto-rollback" className="text-[13px]">Auto-Rollback on Failure</Label>
                      </div>
                      <Switch
                        id="auto-rollback"
                        checked={config.autoRollback}
                        onCheckedChange={(checked) => setConfig(c => ({ ...c, autoRollback: checked }))}
                        data-testid="switch-auto-rollback"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Risk Threshold
                    </Label>
                    <Select
                      value={config.riskThreshold}
                      onValueChange={(value: RiskThreshold) => setConfig(c => ({ ...c, riskThreshold: value }))}
                    >
                      <SelectTrigger data-testid="select-risk-threshold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(RISK_THRESHOLD_INFO) as RiskThreshold[]).map((key) => (
                          <SelectItem key={key} value={key} data-testid={`option-risk-${key}`}>
                            {RISK_THRESHOLD_INFO[key].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className={cn("text-[11px]", RISK_THRESHOLD_INFO[config.riskThreshold].color)}>
                      {RISK_THRESHOLD_INFO[config.riskThreshold].description}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Max Duration: {config.maxDurationMinutes} minutes
                    </Label>
                    <Slider
                      value={[config.maxDurationMinutes]}
                      onValueChange={([value]) => setConfig(c => ({ ...c, maxDurationMinutes: value }))}
                      min={30}
                      max={480}
                      step={30}
                      data-testid="slider-max-duration"
                    />
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>30m</span>
                      <span>8h</span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Button 
                className="w-full" 
                size="lg"
                onClick={handleStartSession}
                disabled={!goal.trim() || isStartingSession}
                data-testid="button-start-session"
              >
                {isStartingSession ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Autonomous Session
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">Goal:</span>
                  <span className="font-medium truncate ml-2 flex-1 text-right" data-testid="text-session-goal">
                    {session.goal}
                  </span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium" data-testid="text-progress-count">
                      {progress?.tasksCompleted ?? 0} / {progress?.tasksTotal ?? 0} tasks
                    </span>
                  </div>
                  <Progress 
                    value={progressPercent} 
                    className="h-2"
                    data-testid="progress-bar"
                  />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{progressPercent}% complete</span>
                    {progress?.estimatedRemainingMs != null && progress.estimatedRemainingMs > 0 && (
                      <span className="flex items-center gap-1" data-testid="text-eta">
                        <Clock className="h-3 w-3" />
                        ETA: {formatDuration(progress.estimatedRemainingMs)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {currentTask && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3" data-testid="current-task-display">
                  <div className="flex items-center gap-2 text-[13px]">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="font-medium">Current Task:</span>
                    <span className="truncate">{currentTask.title}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2 text-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <div className="text-[15px] font-bold text-green-600" data-testid="stat-completed">
                        {progress?.tasksCompleted ?? 0}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Done</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Completed tasks</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <div className="text-[15px] font-bold text-red-600" data-testid="stat-failed">
                        {progress?.tasksFailed ?? 0}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Failed</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Failed tasks</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <div className="text-[15px] font-bold text-blue-600" data-testid="stat-checkpoints">
                        {progress?.checkpointsCreated ?? 0}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Checkpoints</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Checkpoints created</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <div className="text-[15px] font-bold text-emerald-600" data-testid="stat-tests">
                        {progress?.testsPassed ?? 0}/{progress?.testsRun ?? 0}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Tests</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Tests passed / Tests run</TooltipContent>
                </Tooltip>
              </div>

              <div className="flex gap-2">
                {isSessionRunning ? (
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => activeSessionId && pauseSession({ sessionId: activeSessionId, projectId })}
                    disabled={!activeSessionId || isBusy}
                    data-testid="button-pause"
                  >
                    {isPausingSession ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Pause className="h-4 w-4 mr-2" />
                    )}
                    Pause
                  </Button>
                ) : isSessionPaused ? (
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => activeSessionId && resumeSession({ sessionId: activeSessionId, projectId })}
                    disabled={!activeSessionId || isBusy}
                    data-testid="button-resume"
                  >
                    {isResumingSession ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Resume
                  </Button>
                ) : null}
                
                <Button 
                  variant="destructive" 
                  className="flex-1"
                  onClick={handleStopSession}
                  disabled={!activeSessionId || isBusy}
                  data-testid="button-stop"
                >
                  {isStoppingSession ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4 mr-2" />
                  )}
                  Stop
                </Button>
              </div>

              <Collapsible open={showTasks} onOpenChange={setShowTasks} className="flex-1 overflow-hidden flex flex-col">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between" data-testid="button-toggle-tasks">
                    <span className="flex items-center gap-2">
                      Task Queue ({tasks.length})
                    </span>
                    {showTasks ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="flex-1 overflow-hidden">
                  <ScrollArea className="h-[200px] pr-4" data-testid="task-list">
                    <div className="space-y-2">
                      {isLoadingTasks ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : tasks.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-[13px]">
                          No tasks yet
                        </div>
                      ) : (
                        tasks.map((task) => (
                          <TaskItem 
                            key={task.id} 
                            task={task} 
                            isCurrentTask={task.id === progress?.currentTaskId}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>

              {(session.status === 'completed' || session.status === 'failed' || session.status === 'cancelled') && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="text-[13px] text-muted-foreground">
                    Session ended: {session.status}
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setActiveSessionId(null)}
                    data-testid="button-new-session"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Start New Session
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default AutonomyControlPanel;
