import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, Circle, Loader2, XCircle, AlertTriangle, Clock, Zap, Brain, Target, ArrowRight, FileCode, Link2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface DecomposedTask {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  order: number;
  dependencies: string[];
  complexityScore?: number;
  confidenceScore?: number;
  estimatedDurationMs?: number;
  actualDurationMs?: number;
  estimatedTokens?: number;
  metadata?: {
    filesModified?: string[];
    citations?: Array<{ url: string; title: string; snippet: string; domain: string }>;
    tokensUsed?: number;
    costUsd?: number;
  };
}

interface TaskDecompositionDisplayProps {
  tasks: DecomposedTask[];
  currentTaskId?: string | null;
  isExpanded?: boolean;
  className?: string;
}

function getComplexityColor(score: number): string {
  if (score <= 3) return 'text-green-600 dark:text-green-400';
  if (score <= 5) return 'text-blue-600 dark:text-blue-400';
  if (score <= 7) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getComplexityLabel(score: number): string {
  if (score <= 3) return 'Simple';
  if (score <= 5) return 'Moderate';
  if (score <= 7) return 'Complex';
  return 'Very Complex';
}

function getPriorityBadge(priority: string) {
  const variants: Record<string, { color: string; icon: typeof Zap }> = {
    critical: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
    high: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: Zap },
    medium: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Target },
    low: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400', icon: Circle }
  };
  const v = variants[priority] || variants.medium;
  const Icon = v.icon;
  return (
    <Badge variant="outline" className={cn("text-[11px] gap-1", v.color)}>
      <Icon className="h-3 w-3" />
      {priority}
    </Badge>
  );
}

function getStatusIcon(status: string, isCurrentTask: boolean) {
  if (isCurrentTask && status === 'running') {
    return <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />;
  }
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />;
    case 'skipped':
      return <ArrowRight className="h-4 w-4 text-gray-400" />;
    default:
      return <Circle className="h-4 w-4 text-gray-300" />;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function TaskDecompositionDisplay({
  tasks,
  currentTaskId,
  isExpanded: defaultExpanded = true,
  className
}: TaskDecompositionDisplayProps) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const failedCount = tasks.filter(t => t.status === 'failed').length;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  const toggleTask = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  if (tasks.length === 0) {
    return null;
  }

  return (
    <Card className={cn("bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="p-4 border-b border-indigo-200 dark:border-indigo-800">
          <CollapsibleTrigger asChild>
            <button 
              className="flex items-center justify-between w-full text-left group"
              data-testid="button-toggle-task-decomposition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/50">
                  <Brain className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                    Task Decomposition
                    <Badge variant="outline" className="text-[11px] bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700">
                      {completedCount}/{tasks.length}
                    </Badge>
                  </h3>
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400">
                    {failedCount > 0 ? `${failedCount} failed · ` : ''}{tasks.length - completedCount - failedCount} remaining
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24 hidden sm:block">
                  <Progress value={progress} className="h-2 bg-indigo-200 dark:bg-indigo-800" />
                </div>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                )}
              </div>
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="divide-y divide-indigo-200 dark:divide-indigo-800" data-testid="container-decomposed-tasks">
            {tasks.map((task, index) => {
              const isCurrentTask = task.id === currentTaskId;
              const isTaskExpanded = expandedTasks.has(task.id);
              
              return (
                <div 
                  key={task.id} 
                  className={cn(
                    "p-4 transition-colors",
                    isCurrentTask && "bg-violet-50/50 dark:bg-violet-950/20"
                  )}
                  data-testid={`task-item-${task.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-mono text-muted-foreground w-5">
                        {index + 1}.
                      </span>
                      {getStatusIcon(task.status, isCurrentTask)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => toggleTask(task.id)}
                          className="text-left flex-1 min-w-0"
                          data-testid={`button-expand-task-${task.id}`}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "font-medium",
                              task.status === 'completed' && "text-green-700 dark:text-green-400",
                              task.status === 'failed' && "text-red-700 dark:text-red-400 line-through",
                              task.status === 'running' && "text-violet-700 dark:text-violet-400",
                              (task.status === 'pending' || task.status === 'skipped') && "text-gray-700 dark:text-gray-300"
                            )}>
                              {task.title}
                            </span>
                            {getPriorityBadge(task.priority)}
                          </div>
                        </button>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {task.complexityScore !== undefined && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge 
                                    variant="outline" 
                                    className={cn("text-[11px] gap-1", getComplexityColor(task.complexityScore))}
                                  >
                                    <Zap className="h-3 w-3" />
                                    {task.complexityScore}/10
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Complexity: {getComplexityLabel(task.complexityScore)}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          
                          {task.confidenceScore !== undefined && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-[11px]",
                                      task.confidenceScore >= 0.8 && "text-green-600 dark:text-green-400",
                                      task.confidenceScore >= 0.5 && task.confidenceScore < 0.8 && "text-yellow-600 dark:text-yellow-400",
                                      task.confidenceScore < 0.5 && "text-red-600 dark:text-red-400"
                                    )}
                                  >
                                    {Math.round(task.confidenceScore * 100)}%
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Confidence in task success</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                      
                      {isTaskExpanded && task.description && (
                        <p className="mt-2 text-[13px] text-muted-foreground">
                          {task.description}
                        </p>
                      )}
                      
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                          {task.type}
                        </span>
                        
                        {task.estimatedDurationMs && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Est: {formatDuration(task.estimatedDurationMs)}
                          </span>
                        )}
                        
                        {task.actualDurationMs && (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <Clock className="h-3 w-3" />
                            Actual: {formatDuration(task.actualDurationMs)}
                          </span>
                        )}
                        
                        {task.dependencies.length > 0 && (
                          <span className="text-gray-500">
                            Deps: {task.dependencies.length}
                          </span>
                        )}
                      </div>

                      {task.metadata?.filesModified && task.metadata.filesModified.length > 0 && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <FileCode className="h-3 w-3 text-muted-foreground" />
                          {task.metadata.filesModified.map((file, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                // Dispatch event to open file in editor
                                window.dispatchEvent(new CustomEvent('open-file', { detail: { path: file } }));
                              }}
                              className="text-[11px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                              data-testid={`button-file-link-${task.id}-${idx}`}
                              title={`Open ${file}`}
                            >
                              {file.split('/').pop()}
                            </button>
                          ))}
                        </div>
                      )}

                      {task.metadata?.citations && task.metadata.citations.length > 0 && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <Link2 className="h-3 w-3 text-muted-foreground" />
                          {task.metadata.citations.map((citation, idx) => (
                            <a
                              key={idx}
                              href={citation.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex items-center gap-1"
                              data-testid={`link-citation-${task.id}-${idx}`}
                            >
                              <ExternalLink className="h-3 w-3" />
                              {citation.domain || new URL(citation.url).hostname}
                            </a>
                          ))}
                        </div>
                      )}

                      {task.metadata?.costUsd !== undefined && task.metadata.costUsd > 0 && (
                        <span className="text-[11px] text-green-600 dark:text-green-400 ml-auto">
                          ${task.metadata.costUsd.toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
