import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Play, 
  Pause, 
  Square, 
  ChevronDown, 
  ChevronRight,
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  Clock,
  Zap,
  Shield,
  RotateCcw,
  TestTube,
  DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMaxAutonomy, type SessionProgress, type MaxAutonomyTask, type SessionStatus } from '@/hooks/useMaxAutonomy';

interface MaxAutonomyProgressProps {
  sessionId: string;
  projectId: number;
  onStop?: () => void;
  compact?: boolean;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function formatCost(cost: string | number): string {
  const num = typeof cost === 'string' ? parseFloat(cost) : cost;
  if (isNaN(num)) return '$0.00';
  return `$${num.toFixed(4)}`;
}

function getStatusColor(status: SessionStatus): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-950 text-emerald-600 border-emerald-500';
    case 'paused':
      return 'bg-amber-950 text-amber-600 border-amber-500';
    case 'completed':
      return 'bg-blue-950 text-blue-600 border-blue-500';
    case 'failed':
    case 'cancelled':
      return 'bg-red-950 text-red-600 border-red-500';
    default:
      return 'bg-surface-solid text-muted-foreground border-border';
  }
}

function getTaskStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    case 'running':
      return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
    case 'failed':
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case 'skipped':
      return <Circle className="h-3.5 w-3.5 text-gray-400" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-gray-300" />;
  }
}

export function MaxAutonomyProgress({ 
  sessionId, 
  projectId,
  onStop,
  compact = false 
}: MaxAutonomyProgressProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [showAllTasks, setShowAllTasks] = useState(false);
  
  const {
    session,
    progress,
    tasks,
    isLoadingSession,
    pauseSession,
    resumeSession,
    stopSession,
    isPausingSession,
    isResumingSession,
    isStoppingSession
  } = useMaxAutonomy(sessionId, projectId);

  // ✅ FIX (Nov 30, 2025): Add null safety for tasks during session loading
  const safeTasks = tasks || [];
  
  const isActive = session?.status === 'active';
  const isPaused = session?.status === 'paused';
  const isTerminal = ['completed', 'failed', 'cancelled'].includes(session?.status || '');

  const progressPercent = useMemo(() => {
    if (!progress) return 0;
    const total = progress.tasksTotal || 1;
    return Math.round(((progress.tasksCompleted + progress.tasksFailed) / total) * 100);
  }, [progress]);

  const currentTask = useMemo(() => {
    if (!progress?.currentTaskId || !safeTasks.length) return null;
    return safeTasks.find(t => t.id === progress.currentTaskId);
  }, [progress?.currentTaskId, safeTasks]);

  const visibleTasks = useMemo(() => {
    if (showAllTasks) return safeTasks;
    return safeTasks.slice(0, 5);
  }, [safeTasks, showAllTasks]);

  if (isLoadingSession) {
    return (
      <div className="flex items-center gap-2 p-3 bg-surface-solid rounded-lg animate-pulse" data-testid="autonomy-progress-loading">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-[13px] text-muted-foreground">Loading autonomous session...</span>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div 
      className="border border-border rounded-lg bg-background overflow-hidden"
      data-testid="autonomy-progress-container"
    >
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <div 
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-surface-hover-solid transition-colors"
            data-testid="autonomy-progress-header"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Zap className="h-4 w-4 text-amber-500" />
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="text-[13px] font-medium">Max Autonomy</span>
                <Badge 
                  variant="outline" 
                  className={cn("text-[10px] px-1.5 py-0 h-4", getStatusColor(session.status))}
                  data-testid="autonomy-status-badge"
                >
                  {session.status === 'active' && <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />}
                  {session.status}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                {progressPercent}% • {progress?.tasksCompleted || 0}/{progress?.tasksTotal || 0} tasks
              </span>
              
              {!isTerminal && (
                <div className="flex items-center gap-1">
                  {isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => { e.stopPropagation(); pauseSession(); }}
                      disabled={isPausingSession}
                      data-testid="button-pause-session"
                    >
                      {isPausingSession ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Pause className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                  
                  {isPaused && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => { e.stopPropagation(); resumeSession(); }}
                      disabled={isResumingSession}
                      data-testid="button-resume-session"
                    >
                      {isResumingSession ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-950"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      stopSession();
                      onStop?.();
                    }}
                    disabled={isStoppingSession}
                    data-testid="button-stop-session"
                  >
                    {isStoppingSession ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-1.5" />
            </div>

            <div className="text-[11px] text-muted-foreground line-clamp-2" data-testid="autonomy-goal">
              <span className="font-medium">Goal:</span> {session.goal}
            </div>

            {currentTask && (
              <div className="flex items-start gap-2 p-2 bg-blue-950 border border-blue-500 rounded-md">
                <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin mt-0.5 shrink-0" />
                <div className="text-[11px]">
                  <div className="font-medium text-blue-600 dark:text-blue-400">
                    Current: {currentTask.title}
                  </div>
                  {currentTask.description && (
                    <div className="text-muted-foreground line-clamp-1 mt-0.5">
                      {currentTask.description}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="flex items-center gap-1.5 text-[11px]">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span>{formatDuration(progress?.elapsedTimeMs || 0)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <DollarSign className="h-3 w-3 text-muted-foreground" />
                <span>{formatCost(progress?.totalCostUsd || '0')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <Shield className="h-3 w-3 text-muted-foreground" />
                <span>{progress?.checkpointsCreated || 0} checkpoints</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <TestTube className="h-3 w-3 text-muted-foreground" />
                <span>{progress?.testsPassed || 0}/{progress?.testsRun || 0} tests</span>
              </div>
            </div>

            {progress?.estimatedRemainingMs && progress.estimatedRemainingMs > 0 && (
              <div className="text-[11px] text-muted-foreground">
                <span className="font-medium">ETA:</span> ~{formatDuration(progress.estimatedRemainingMs)} remaining
              </div>
            )}

            {safeTasks.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                  <span>Tasks ({safeTasks.length})</span>
                  {safeTasks.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px]"
                      onClick={() => setShowAllTasks(!showAllTasks)}
                      data-testid="button-toggle-tasks"
                    >
                      {showAllTasks ? 'Show less' : `Show all (${safeTasks.length})`}
                    </Button>
                  )}
                </div>
                
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {visibleTasks.map((task) => (
                    <div 
                      key={task.id}
                      className={cn(
                        "flex items-center gap-2 p-1.5 rounded text-[11px]",
                        task.status === 'running' && "bg-blue-950",
                        task.status === 'completed' && "opacity-70",
                        task.status === 'failed' && "bg-red-950"
                      )}
                      data-testid={`task-item-${task.id}`}
                    >
                      {getTaskStatusIcon(task.status)}
                      <span className={cn(
                        "flex-1 truncate",
                        task.status === 'completed' && "line-through"
                      )}>
                        {task.title}
                      </span>
                      {task.status === 'failed' && task.errorMessage && (
                        <span className="text-[10px] text-red-500 truncate max-w-[100px]">
                          {task.errorMessage}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(progress?.rollbacksPerformed ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                <RotateCcw className="h-3 w-3" />
                <span>{progress?.rollbacksPerformed} rollback(s) performed</span>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface MaxAutonomyStartFormProps {
  projectId: number;
  onStart: (goal: string, options: {
    model?: string;
    maxDurationMinutes?: number;
    autoCheckpoint?: boolean;
    autoTest?: boolean;
    autoRollback?: boolean;
    riskThreshold?: 'low' | 'medium' | 'high' | 'critical';
  }) => void;
  isStarting?: boolean;
}

export function MaxAutonomyStartForm({ 
  projectId, 
  onStart, 
  isStarting = false 
}: MaxAutonomyStartFormProps) {
  const [goal, setGoal] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [riskThreshold, setRiskThreshold] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [maxDuration, setMaxDuration] = useState(240);
  const [autoCheckpoint, setAutoCheckpoint] = useState(true);
  const [autoTest, setAutoTest] = useState(true);
  const [autoRollback, setAutoRollback] = useState(true);

  const handleSubmit = () => {
    if (!goal.trim()) return;
    onStart(goal, {
      maxDurationMinutes: maxDuration,
      autoCheckpoint,
      autoTest,
      autoRollback,
      riskThreshold
    });
  };

  return (
    <div className="space-y-3 p-3 border border-amber-500 bg-amber-950 rounded-lg" data-testid="autonomy-start-form">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-500" />
        <span className="text-[13px] font-medium">Max Autonomy Mode</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-950 text-amber-600 border-amber-500">
          Up to {maxDuration} min
        </Badge>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Describe your goal and the AI will work autonomously to achieve it, with automatic checkpoints, testing, and rollback.
      </p>

      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="Example: Build a todo app with user authentication, dark mode, and PostgreSQL database..."
        className="w-full min-h-[80px] p-2 text-[13px] bg-background border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        data-testid="input-autonomy-goal"
      />

      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" data-testid="button-toggle-advanced">
            {showAdvanced ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
            Advanced options
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                checked={autoCheckpoint}
                onChange={(e) => setAutoCheckpoint(e.target.checked)}
                className="rounded border-border"
                data-testid="checkbox-auto-checkpoint"
              />
              Auto-checkpoint
            </label>
            <label className="flex items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                checked={autoTest}
                onChange={(e) => setAutoTest(e.target.checked)}
                className="rounded border-border"
                data-testid="checkbox-auto-test"
              />
              Auto-test
            </label>
            <label className="flex items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                checked={autoRollback}
                onChange={(e) => setAutoRollback(e.target.checked)}
                className="rounded border-border"
                data-testid="checkbox-auto-rollback"
              />
              Auto-rollback on failure
            </label>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-[11px]">Risk threshold:</label>
            <select 
              value={riskThreshold}
              onChange={(e) => setRiskThreshold(e.target.value as any)}
              className="text-[11px] bg-background border border-border rounded px-2 py-1"
              data-testid="select-risk-threshold"
            >
              <option value="low">Low (Fast)</option>
              <option value="medium">Medium (Balanced)</option>
              <option value="high">High (Conservative)</option>
              <option value="critical">Critical (Paranoid)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px]">Max duration:</label>
            <select 
              value={maxDuration}
              onChange={(e) => setMaxDuration(parseInt(e.target.value))}
              className="text-[11px] bg-background border border-border rounded px-2 py-1"
              data-testid="select-max-duration"
            >
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="120">2 hours</option>
              <option value="240">4 hours</option>
            </select>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Button
        onClick={handleSubmit}
        disabled={!goal.trim() || isStarting}
        className="w-full bg-amber-500 hover:bg-amber-600 text-white"
        data-testid="button-start-autonomy"
      >
        {isStarting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Starting...
          </>
        ) : (
          <>
            <Zap className="h-4 w-4 mr-2" />
            Start Autonomous Session
          </>
        )}
      </Button>
    </div>
  );
}
