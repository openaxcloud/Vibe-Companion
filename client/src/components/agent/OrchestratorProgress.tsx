import { useState, useEffect } from 'react';
import { Clock, TrendingUp, Target, CheckCircle2, XCircle, Pause, Play, BarChart3, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface CurrentTaskDelegation {
  tier: 'fast' | 'balanced' | 'quality';
  model: string;
  provider: string;
  reason?: string;
  taskComplexity?: number;
}

export interface SessionProgressData {
  sessionId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  goal: string;
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksSkipped: number;
  tasksPending: number;
  currentTaskId: string | null;
  currentTaskTitle: string | null;
  checkpointsCreated: number;
  rollbacksPerformed: number;
  testsRun: number;
  testsPassed: number;
  totalTokensUsed: number;
  totalCostUsd: string;
  elapsedTimeMs: number;
  estimatedRemainingMs: number;
  etaConfidence: number;
  etaBasedOnSamples: number;
  startedAt: string | null;
  pausedAt: string | null;
  currentTaskDelegation?: CurrentTaskDelegation;
}

interface OrchestratorProgressProps {
  progress: SessionProgressData;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  className?: string;
}

function formatTime(ms: number): string {
  if (ms < 0) return '0s';
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

function getConfidenceLabel(confidence: number): { label: string; color: string } {
  if (confidence >= 0.8) return { label: 'High', color: 'text-green-600 dark:text-green-400' };
  if (confidence >= 0.5) return { label: 'Medium', color: 'text-yellow-600 dark:text-yellow-400' };
  return { label: 'Low', color: 'text-red-600 dark:text-red-400' };
}

function getStatusBadge(status: string) {
  const configs: Record<string, { color: string; icon: typeof Play }> = {
    running: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: Play },
    paused: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Pause },
    completed: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle2 },
    failed: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
    cancelled: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400', icon: XCircle },
    pending: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400', icon: Clock }
  };
  const config = configs[status] || configs.pending;
  const Icon = config.icon;
  
  return (
    <Badge variant="outline" className={cn("gap-1", config.color)}>
      <Icon className="h-3 w-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export function OrchestratorProgress({
  progress,
  onPause,
  onResume,
  onStop,
  className
}: OrchestratorProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(progress.elapsedTimeMs);
  
  useEffect(() => {
    if (progress.status !== 'running') {
      setElapsedTime(progress.elapsedTimeMs);
      return;
    }
    
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1000);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [progress.status, progress.elapsedTimeMs]);
  
  const taskProgress = progress.tasksTotal > 0 
    ? (progress.tasksCompleted / progress.tasksTotal) * 100 
    : 0;
  
  const testPassRate = progress.testsRun > 0 
    ? (progress.testsPassed / progress.testsRun) * 100 
    : 0;
  
  const confidenceInfo = getConfidenceLabel(progress.etaConfidence);
  
  return (
    <Card className={cn("bg-gradient-to-br from-violet-50/50 to-indigo-50/50 dark:from-violet-950/20 dark:to-indigo-950/20 border-violet-200 dark:border-violet-800", className)}>
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              <h3 className="font-semibold text-violet-900 dark:text-violet-100 truncate">
                {progress.goal || 'Autonomous Session'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(progress.status)}
              {progress.currentTaskTitle && progress.status === 'running' && (
                <span className="text-[11px] text-muted-foreground truncate">
                  Working on: {progress.currentTaskTitle}
                </span>
              )}
            </div>
          </div>
          
          {(onPause || onResume || onStop) && progress.status === 'running' && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {progress.status === 'running' && onPause && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onPause}
                  data-testid="button-pause-session"
                >
                  <Pause className="h-4 w-4" />
                </Button>
              )}
              {onStop && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={onStop}
                  data-testid="button-stop-session"
                >
                  Stop
                </Button>
              )}
            </div>
          )}
          
          {progress.status === 'paused' && onResume && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={onResume}
              data-testid="button-resume-session"
            >
              <Play className="h-4 w-4 mr-1" />
              Resume
            </Button>
          )}
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">Task Progress</span>
            <span className="font-medium">
              {progress.tasksCompleted}/{progress.tasksTotal}
              {progress.tasksFailed > 0 && (
                <span className="text-red-500 ml-1">({progress.tasksFailed} failed)</span>
              )}
            </span>
          </div>
          <Progress 
            value={taskProgress} 
            className="h-2 bg-violet-200 dark:bg-violet-800"
            data-testid="progress-tasks"
          />
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              Elapsed
            </div>
            <p className="text-[13px] font-medium tabular-nums">
              {formatTime(elapsedTime)}
            </p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              ETA
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-[13px] font-medium tabular-nums cursor-help">
                    {progress.estimatedRemainingMs > 0 
                      ? formatTime(progress.estimatedRemainingMs)
                      : '--'
                    }
                    <span className={cn("text-[11px] ml-1", confidenceInfo.color)}>
                      ({confidenceInfo.label})
                    </span>
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Based on {progress.etaBasedOnSamples} historical samples</p>
                  <p className="text-[11px] text-muted-foreground">
                    Confidence: {Math.round(progress.etaConfidence * 100)}%
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <BarChart3 className="h-3 w-3" />
              Tokens
            </div>
            <p className="text-[13px] font-medium tabular-nums">
              {progress.totalTokensUsed.toLocaleString()}
            </p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" />
              Tests
            </div>
            <p className="text-[13px] font-medium tabular-nums">
              {progress.testsPassed}/{progress.testsRun}
              {progress.testsRun > 0 && (
                <span className={cn(
                  "text-[11px] ml-1",
                  testPassRate >= 80 && "text-green-600 dark:text-green-400",
                  testPassRate >= 50 && testPassRate < 80 && "text-yellow-600 dark:text-yellow-400",
                  testPassRate < 50 && "text-red-600 dark:text-red-400"
                )}>
                  ({Math.round(testPassRate)}%)
                </span>
              )}
            </p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              Cost
            </div>
            <p className="text-[13px] font-medium tabular-nums text-green-600 dark:text-green-400">
              ${parseFloat(progress.totalCostUsd).toFixed(4)}
            </p>
          </div>
        </div>
        
        {(progress.checkpointsCreated > 0 || progress.rollbacksPerformed > 0) && (
          <div className="flex items-center gap-4 pt-2 border-t border-violet-200 dark:border-violet-800 text-[11px] text-muted-foreground">
            {progress.checkpointsCreated > 0 && (
              <span>{progress.checkpointsCreated} checkpoints</span>
            )}
            {progress.rollbacksPerformed > 0 && (
              <span className="text-yellow-600 dark:text-yellow-400">
                {progress.rollbacksPerformed} rollbacks
              </span>
            )}
            {parseFloat(progress.totalCostUsd) > 0 && (
              <span className="ml-auto">
                Cost: ${progress.totalCostUsd}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export function MiniProgressIndicator({ 
  completed, 
  total, 
  eta,
  etaConfidence,
  className 
}: { 
  completed: number; 
  total: number; 
  eta?: number;
  etaConfidence?: number;
  className?: string;
}) {
  const progress = total > 0 ? (completed / total) * 100 : 0;
  const confidenceInfo = etaConfidence !== undefined ? getConfidenceLabel(etaConfidence) : null;
  
  return (
    <div className={cn("flex items-center gap-2", className)} data-testid="mini-progress-indicator">
      <div className="flex-1 min-w-[60px]">
        <Progress value={progress} className="h-1.5" data-testid="progress-mini" />
      </div>
      <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
        {completed}/{total}
        {eta && eta > 0 && (
          <>
            {' · '}{formatTime(eta)}
            {confidenceInfo && (
              <span className={cn("ml-1", confidenceInfo.color)} data-testid="text-eta-confidence">
                ({confidenceInfo.label})
              </span>
            )}
          </>
        )}
      </span>
    </div>
  );
}
