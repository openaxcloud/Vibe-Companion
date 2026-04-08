/**
 * Task Message Component
 * Displays task execution with status, progress, and artifacts
 */

import { CheckCircle2, Circle, Loader2, XCircle, Clock, Package, FileText, Terminal, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Task, TaskStatus } from './types';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface TaskMessageProps {
  tasks: Task[];
  className?: string;
}

const STATUS_CONFIG: Record<TaskStatus, { icon: typeof Circle; label: string; color: string; bgColor: string; borderColor: string }> = {
  pending: {
    icon: Circle,
    label: 'Pending',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-950/10',
    borderColor: 'border-gray-200 dark:border-gray-800'
  },
  in_progress: {
    icon: Loader2,
    label: 'In Progress',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/10',
    borderColor: 'border-blue-200 dark:border-blue-800'
  },
  completed: {
    icon: CheckCircle2,
    label: 'Completed',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/10',
    borderColor: 'border-green-200 dark:border-green-800'
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/10',
    borderColor: 'border-red-200 dark:border-red-800'
  },
  cancelled: {
    icon: XCircle,
    label: 'Cancelled',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/10',
    borderColor: 'border-orange-200 dark:border-orange-800'
  }
};

export function TaskMessage({ tasks, className }: TaskMessageProps) {
  // ✅ FIX (Nov 30, 2025): Add null safety for bootstrap session loading
  const safeTasks = tasks || [];
  
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleTask = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  if (safeTasks.length === 0) return null;

  const completedTasks = safeTasks.filter(t => t.status === 'completed').length;
  const totalTasks = safeTasks.length;
  const overallProgress = (completedTasks / totalTasks) * 100;

  return (
    <div className={cn("space-y-3 max-w-full overflow-hidden", className)} data-testid="task-message">
      {/* Overall Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-[var(--ecode-text)]">
              Tasks Progress
            </span>
            <span className="text-[11px] text-[var(--ecode-text-secondary)]">
              {completedTasks} / {totalTasks}
            </span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>
      </div>

      {/* Individual Tasks */}
      <div className="space-y-2">
        {safeTasks.map((task) => {
          const config = STATUS_CONFIG[task.status];
          const Icon = config.icon;
          const isExpanded = expandedTasks.has(task.id);
          const hasArtifacts = task.artifacts && (
            task.artifacts.filesCreated?.length || 
            task.artifacts.filesModified?.length || 
            task.artifacts.packagesInstalled?.length ||
            task.artifacts.commands?.length
          );

          return (
            <div
              key={task.id}
              className={cn(
                "rounded-lg border transition-all",
                config.bgColor,
                config.borderColor
              )}
            >
              <Collapsible open={isExpanded} onOpenChange={() => toggleTask(task.id)}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 min-h-[44px] cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors touch-manipulation overflow-hidden">
                    {/* Status Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      <Icon className={cn("h-4 w-4", config.color, task.status === 'in_progress' && 'animate-spin')} />
                    </div>

                    {/* Task Content */}
                    <div className="flex-1 min-w-0 text-left overflow-hidden">
                      <div className="flex flex-wrap items-start gap-1 sm:gap-2 mb-1">
                        <span className="text-[12px] sm:text-[13px] font-medium text-[var(--ecode-text)] break-words" style={{ overflowWrap: 'anywhere' }}>
                          {task.title}
                        </span>
                        <Badge variant="outline" className="text-[11px]">
                          {config.label}
                        </Badge>
                        {task.estimatedTime && task.status === 'pending' && (
                          <Badge variant="outline" className="text-[11px] flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {task.estimatedTime}
                          </Badge>
                        )}
                      </div>
                      
                      {task.description && (
                        <div className="text-[11px] text-[var(--ecode-text-secondary)] mb-2">
                          {task.description}
                        </div>
                      )}

                      {/* Task Progress */}
                      {task.progress !== undefined && task.status === 'in_progress' && (
                        <div className="mt-2">
                          <Progress value={task.progress} className="h-1.5" />
                        </div>
                      )}

                      {/* Error Message */}
                      {task.error && (
                        <div className="mt-2 flex items-start gap-2 p-2 rounded-md bg-red-100 dark:bg-red-950/20">
                          <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                          <span className="text-[11px] text-red-700 dark:text-red-300">
                            {task.error}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Expand Icon */}
                    {hasArtifacts && (
                      <div className="flex-shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-[var(--ecode-text-secondary)]" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-[var(--ecode-text-secondary)]" />
                        )}
                      </div>
                    )}
                  </div>
                </CollapsibleTrigger>

                {/* Artifacts (Expandable) */}
                {hasArtifacts && (
                  <CollapsibleContent>
                    <div className="px-3 pb-3 space-y-2 border-t border-[var(--ecode-border)]">
                      {task.artifacts?.filesCreated && task.artifacts.filesCreated.length > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-3 w-3 text-green-600 dark:text-green-400" />
                            <span className="text-[11px] font-medium text-[var(--ecode-text)]">
                              Files Created ({task.artifacts.filesCreated.length})
                            </span>
                          </div>
                          <div className="pl-5 space-y-1">
                            {task.artifacts.filesCreated.map((file, idx) => (
                              <div key={idx} className="text-[11px] font-mono text-[var(--ecode-text-secondary)]">
                                {file}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {task.artifacts?.filesModified && task.artifacts.filesModified.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            <span className="text-[11px] font-medium text-[var(--ecode-text)]">
                              Files Modified ({task.artifacts.filesModified.length})
                            </span>
                          </div>
                          <div className="pl-5 space-y-1">
                            {task.artifacts.filesModified.map((file, idx) => (
                              <div key={idx} className="text-[11px] font-mono text-[var(--ecode-text-secondary)]">
                                {file}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {task.artifacts?.packagesInstalled && task.artifacts.packagesInstalled.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Package className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                            <span className="text-[11px] font-medium text-[var(--ecode-text)]">
                              Packages Installed ({task.artifacts.packagesInstalled.length})
                            </span>
                          </div>
                          <div className="pl-5 space-y-1">
                            {task.artifacts.packagesInstalled.map((pkg, idx) => (
                              <div key={idx} className="text-[11px] font-mono text-[var(--ecode-text-secondary)]">
                                {pkg}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {task.artifacts?.commands && task.artifacts.commands.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Terminal className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                            <span className="text-[11px] font-medium text-[var(--ecode-text)]">
                              Commands Executed ({task.artifacts.commands.length})
                            </span>
                          </div>
                          <div className="pl-5 space-y-1">
                            {task.artifacts.commands.map((cmd, idx) => (
                              <div key={idx} className="text-[11px] font-mono text-[var(--ecode-text-secondary)]">
                                $ {cmd}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                )}
              </Collapsible>
            </div>
          );
        })}
      </div>
    </div>
  );
}
