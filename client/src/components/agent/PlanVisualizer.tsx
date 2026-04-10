/**
 * Plan Visualizer Component
 * 
 * Displays AI-generated execution plans with:
 * - Task breakdown and dependencies
 * - Critical path visualization
 * - Time/effort estimates
 * - Risk assessment
 * - Parallel execution opportunities
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  ChevronRight, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Circle,
  GitBranch,
  Zap,
  ListTodo
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  type: 'file_operation' | 'command' | 'database' | 'configuration' | 'testing' | 'deployment';
  estimatedMinutes: number;
  riskScore: number;
  dependencies: string[];
  requiredTools: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface ExecutionPlan {
  id: string;
  goal: string;
  tasks: Task[];
  totalEstimatedMinutes: number;
  parallelizableTasks: string[][];
  criticalPath: string[];
  riskAssessment: {
    overallRisk: number;
    highRiskTasks: string[];
    mitigationStrategies: string[];
  };
  alternativeApproaches: string[];
  createdAt: Date;
}

interface PlanVisualizerProps {
  plan: ExecutionPlan | null;
  onTaskClick?: (taskId: string) => void;
  onApprove?: () => void;
  onReject?: () => void;
}

const TASK_TYPE_ICONS: Record<Task['type'], string> = {
  file_operation: '📄',
  command: '⚙️',
  database: '🗄️',
  configuration: '🔧',
  testing: '🧪',
  deployment: '🚀'
};

const PRIORITY_COLORS = {
  critical: 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 border-red-300 dark:border-red-800',
  high: 'bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-800',
  medium: 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800',
  low: 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-800'
};

export function PlanVisualizer({ plan, onTaskClick, onApprove, onReject }: PlanVisualizerProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [showAlternatives, setShowAlternatives] = useState(false);

  if (!plan) {
    return (
      <Card className="border-[var(--ecode-border)]">
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <ListTodo className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No execution plan generated yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const toggleTask = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-red-600 dark:text-red-400';
    if (score >= 50) return 'text-orange-600 dark:text-orange-400';
    if (score >= 30) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const completedTasks = plan.tasks?.filter(t => t.status === 'completed').length ?? 0; // 🔧 Safe access
  const progress = plan.tasks ? (completedTasks / plan.tasks.length) * 100 : 0; // 🔧 Safe division

  return (
    <div className="space-y-4">
      {/* Plan Header */}
      <Card className="border-[var(--ecode-border)]">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-[15px]">{plan.goal}</CardTitle>
              <CardDescription className="mt-2 flex items-center gap-4 text-[13px]">
                <span className="flex items-center gap-1">
                  <ListTodo className="h-4 w-4" />
                  {plan.tasks?.length ?? 0} tasks
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  ~{plan.totalEstimatedMinutes} min
                </span>
                <span className={`flex items-center gap-1 ${getRiskColor(plan.riskAssessment?.overallRisk ?? 50)}`}>
                  <AlertTriangle className="h-4 w-4" />
                  Risk: {plan.riskAssessment?.overallRisk ?? 50}/100
                </span>
              </CardDescription>
            </div>
            
            {onApprove && onReject && (
              <div className="flex gap-2">
                <Button onClick={onReject} variant="outline" size="sm" data-testid="button-reject-plan">
                  Reject
                </Button>
                <Button onClick={onApprove} size="sm" data-testid="button-approve-plan">
                  Approve & Start
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        
        {completedTasks > 0 && (
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{completedTasks} / {plan.tasks?.length ?? 0}</span>
              </div>
              <Progress value={progress} className="h-2" data-testid="progress-plan" />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Task List */}
      <Card className="border-[var(--ecode-border)]">
        <CardHeader>
          <CardTitle className="text-base">Execution Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {plan.tasks?.map((task, index) => {
            const isExpanded = expandedTasks.has(task.id);
            const isOnCriticalPath = plan.criticalPath?.includes(task.id) ?? false; // 🔧 Safe access
            const canRunInParallel = plan.parallelizableTasks?.some(group => 
              group.includes(task.id) && group.length > 1
            ) ?? false; // 🔧 Safe access
            
            return (
              <Collapsible
                key={task.id}
                open={isExpanded}
                onOpenChange={() => toggleTask(task.id)}
              >
                <div className={`border rounded-lg p-3 ${PRIORITY_COLORS[task.priority]}`}>
                  <CollapsibleTrigger asChild>
                    <button
                      className="w-full flex items-start gap-3 text-left"
                      onClick={() => onTaskClick?.(task.id)}
                      data-testid={`task-${task.id}`}
                    >
                      <div className="mt-0.5">
                        {task.status === 'completed' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : task.status === 'in_progress' ? (
                          <Circle className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-pulse" />
                        ) : task.status === 'failed' ? (
                          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                        ) : (
                          <Circle className="h-5 w-5 opacity-40" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-mono opacity-60">#{index + 1}</span>
                          <span className="text-[13px] font-medium">{task.title}</span>
                          {isOnCriticalPath && (
                            <Badge variant="outline" className="text-[11px]">
                              <Zap className="h-3 w-3 mr-1" />
                              Critical
                            </Badge>
                          )}
                          {canRunInParallel && (
                            <Badge variant="outline" className="text-[11px]">
                              <GitBranch className="h-3 w-3 mr-1" />
                              Parallel
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 text-[11px] opacity-75">
                          <span>{TASK_TYPE_ICONS[task.type]} {task.type.replace('_', ' ')}</span>
                          <span>⏱️ {task.estimatedMinutes}min</span>
                          <span className={getRiskColor(task.riskScore)}>
                            Risk: {task.riskScore}/100
                          </span>
                        </div>
                      </div>
                      
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 flex-shrink-0" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="mt-3 pt-3 border-t border-current/20">
                    <div className="space-y-2 text-[13px]">
                      <p className="opacity-90">{task.description}</p>
                      
                      {task.dependencies && task.dependencies.length > 0 && (
                        <div>
                          <span className="font-medium">Dependencies:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {task.dependencies.map(depId => (
                              <Badge key={depId} variant="secondary" className="text-[11px]">
                                {depId}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {task.requiredTools && task.requiredTools.length > 0 && (
                        <div>
                          <span className="font-medium">Tools:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {task.requiredTools.map(tool => (
                              <Badge key={tool} variant="outline" className="text-[11px]">
                                {tool}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>

      {/* Risk Assessment & Mitigation */}
      {plan.riskAssessment?.highRiskTasks && plan.riskAssessment.highRiskTasks.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              Risk Mitigation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {plan.riskAssessment.mitigationStrategies?.map((strategy, idx) => (
              <div key={idx} className="flex items-start gap-2 text-[13px]">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span>{strategy}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Alternative Approaches */}
      {plan.alternativeApproaches && plan.alternativeApproaches.length > 0 && (
        <Collapsible open={showAlternatives} onOpenChange={setShowAlternatives}>
          <Card className="border-[var(--ecode-border)]">
            <CardHeader>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between text-left">
                  <CardTitle className="text-base">Alternative Approaches</CardTitle>
                  {showAlternatives ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-2">
                {plan.alternativeApproaches.map((approach, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[13px]">
                    <GitBranch className="h-4 w-4 mt-0.5 flex-shrink-0 opacity-60" />
                    <span>{approach}</span>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
