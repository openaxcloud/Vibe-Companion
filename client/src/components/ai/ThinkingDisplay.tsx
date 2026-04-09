// @ts-nocheck
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Brain, CheckCircle, Loader2, Sparkles, Code, Search, FileText, Zap, Database, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export interface ThinkingStep {
  id: string;
  type?: 'reasoning' | 'analysis' | 'planning' | 'implementation' | 'verification' | 'tool_use';
  title: string;
  content?: string;
  description?: string;
  status: 'pending' | 'active' | 'complete' | 'completed' | 'error';
  timestamp: Date;
  details?: string[];
  progress?: number;
  duration?: number;
  isStreaming?: boolean;
  metadata?: Record<string, any>;
}

export interface ThinkingDisplayProps {
  steps: ThinkingStep[];
  isActive?: boolean;
  className?: string;
  onStepClick?: (stepId: string) => void;
  mode?: 'compact' | 'detailed';
}

const STEP_ICONS = {
  reasoning: Brain,
  analysis: Search,
  planning: FileText,
  implementation: Code,
  verification: CheckCircle,
} as const;

const STEP_COLORS = {
  reasoning: 'text-purple-600 dark:text-purple-400',
  analysis: 'text-blue-600 dark:text-blue-400',
  planning: 'text-green-600 dark:text-green-400',
  implementation: 'text-orange-600 dark:text-orange-400',
  verification: 'text-emerald-600 dark:text-emerald-400',
} as const;

function AgentThinkingPulse() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="px-4 py-6 flex flex-col items-center gap-3" data-testid="thinking-initializing">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 border border-primary/30">
          <Brain className="h-5 w-5 text-primary animate-pulse" data-testid="thinking-loader" />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] font-medium text-foreground" data-testid="thinking-init-message">
          Agent is thinking{dots}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

export function ThinkingDisplay({ 
  steps, 
  isActive = false, 
  className,
  onStepClick,
  mode = 'detailed'
}: ThinkingDisplayProps) {
  const safeSteps = steps || [];
  
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(
    new Set(safeSteps.filter(s => s.status === 'active').map(s => s.id))
  );

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
    onStepClick?.(stepId);
  };

  if (safeSteps.length === 0 && !isActive) {
    return null;
  }

  const completedCount = safeSteps.filter(s => s.status === 'complete' || s.status === 'completed').length;
  const totalCount = safeSteps.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Card 
      className={cn(
        "border transition-all duration-300",
        isActive ? "border-[#2a3040] bg-[#151b2b]/80 shadow-md" : "border-[#1e2536] bg-[#111827]/60",
        className
      )}
      data-testid="thinking-display"
    >
      <div className="px-4 py-3 border-b border-[#2a3040] bg-[#151b2b]" data-testid="thinking-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles 
              className={cn(
                "h-4 w-4 transition-all",
                isActive && "animate-pulse text-primary"
              )}
              data-testid="thinking-icon"
            />
            <h3 className="font-semibold text-[13px] text-gray-200" data-testid="thinking-title">AI Thinking</h3>
            {isActive && (
              <Badge variant="secondary" className="text-[11px] animate-pulse bg-blue-900/50 text-blue-300 border-blue-700/50" data-testid="thinking-status-active">
                Active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {mode === 'detailed' && totalCount > 0 && (
              <div className="flex items-center gap-2" data-testid="thinking-progress">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Step {Math.min(completedCount + 1, totalCount)} of {totalCount}
                </span>
                <div className="w-16 h-1.5 bg-[#1e2536] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums">{progressPercent}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="divide-y divide-border">
        {safeSteps.map((step, index) => {
          const isExpanded = expandedSteps.has(step.id);
          const stepType = step.type || 'reasoning';
          const Icon = STEP_ICONS[stepType] || Brain;
          const iconColor = STEP_COLORS[stepType] || 'text-purple-600 dark:text-purple-400';
          const stepNumber = index + 1;
          
          return (
            <div key={step.id} className="group">
              <button
                onClick={() => toggleStep(step.id)}
                className={cn(
                  "w-full px-4 py-3 flex items-center gap-3 hover:bg-[#1a2235] transition-colors text-left",
                  step.status === 'active' && "bg-[#161d2e]"
                )}
                data-testid={`thinking-step-${step.id}`}
              >
                <div className="flex-shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                <div className={cn(
                  "flex-shrink-0 rounded-full p-1.5",
                  step.status === 'complete' || step.status === 'completed' ? "bg-green-900/50" : "",
                  step.status === 'active' && "bg-blue-900/40",
                  step.status === 'pending' && "bg-[#1e2536]",
                  step.status === 'error' && "bg-red-900/50"
                )}>
                  {step.status === 'active' ? (
                    <Loader2 className={cn("h-4 w-4 animate-spin", iconColor)} />
                  ) : step.status === 'complete' || step.status === 'completed' ? (
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <Icon className={cn("h-4 w-4", iconColor)} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground tabular-nums" data-testid={`step-indicator-${step.id}`}>
                      {stepNumber}/{totalCount}
                    </span>
                    <h4 className="font-medium text-[13px] truncate">{step.title}</h4>
                    <Badge variant="outline" className="text-[11px] capitalize border-[#2a3040] text-gray-400 bg-transparent">
                      {step.type}
                    </Badge>
                  </div>
                  
                  {!isExpanded && mode === 'detailed' && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {step.content}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {step.duration && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {step.duration < 1000 ? `${step.duration}ms` : `${(step.duration / 1000).toFixed(1)}s`}
                    </span>
                  )}
                  {step.status === 'active' && step.isStreaming && (
                    <div className="flex items-center gap-1 text-primary">
                      <Zap className="h-3 w-3 animate-pulse" />
                      <span className="text-[11px] font-medium">Streaming...</span>
                    </div>
                  )}
                  {step.progress !== undefined && step.status === 'active' && (
                    <span className="text-[11px] font-medium text-primary">
                      {step.progress}%
                    </span>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-2 bg-background space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="pl-12">
                    <p className="text-[13px] text-foreground whitespace-pre-wrap">
                      {step.content}
                      {step.isStreaming && (
                        <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-1 align-middle" />
                      )}
                    </p>

                    {step.status === 'active' && step.progress !== undefined && (
                      <Progress value={step.progress} className="h-1 mt-2" />
                    )}

                    {step.metadata?.ragFiles && step.metadata.ragFiles.length > 0 && (
                      <div className="mt-3 space-y-1" data-testid="rag-files-list">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1.5">
                          <Database className="h-3 h-3" />
                          <span className="font-medium">Files read ({step.metadata.ragFiles.length})</span>
                          {step.metadata.ragMode && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-blue-700/50 text-blue-400">
                              {step.metadata.ragMode}
                            </Badge>
                          )}
                          {step.metadata.tokenEstimate > 0 && (
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              ~{Math.round(step.metadata.tokenEstimate).toLocaleString()} tokens
                            </span>
                          )}
                        </div>
                        {step.metadata.ragFiles.map((file: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-[11px] py-0.5 px-2 rounded bg-[#1a2235]/60 hover:bg-[#1a2235] transition-colors">
                            <FileCode className="h-3 w-3 text-blue-400 flex-shrink-0" />
                            <span className="text-gray-300 font-mono truncate">{file}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {step.details && step.details.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {step.details.map((detail, i) => (
                          <div key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                            <div className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground flex-shrink-0" />
                            <span className="flex-1">{detail}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 text-[11px] text-muted-foreground">
                      {step.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              )}

              {index < safeSteps.length - 1 && (
                <div className="pl-[52px]">
                  <div className={cn(
                    "w-0.5 h-2 ml-[11px]",
                    step.status === 'complete' || step.status === 'completed' ? "bg-green-300 dark:bg-green-700" : "bg-muted"
                  )} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isActive && safeSteps.length === 0 && (
        <AgentThinkingPulse />
      )}
    </Card>
  );
}

export function ThinkingDisplayCompact({ steps, isActive, className }: ThinkingDisplayProps) {
  const safeSteps = steps || [];
  const activeStep = safeSteps.find(s => s.status === 'active');
  const completedCount = safeSteps.filter(s => s.status === 'complete' || s.status === 'completed').length;
  const totalCount = safeSteps.length;
  const currentStep = Math.min(completedCount + 1, totalCount);

  return (
    <div 
      className={cn(
        "rounded-lg border px-3 py-2 bg-card text-card-foreground",
        isActive && "border-primary",
        className
      )}
      data-testid="thinking-display-compact"
    >
      <div className="flex items-center gap-2">
        {isActive ? (
          totalCount === 0 ? (
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ width: 14, height: 14 }} />
              <Brain className="h-3.5 w-3.5 text-primary animate-pulse" data-testid="thinking-compact-loader" />
            </div>
          ) : (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary flex-shrink-0" data-testid="thinking-compact-loader" />
          )
        ) : (
          <Brain className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" data-testid="thinking-compact-icon" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium truncate" data-testid="thinking-compact-text">
            {isActive && totalCount === 0 
              ? "Agent is thinking..." 
              : activeStep 
                ? `Step ${currentStep}/${totalCount}: ${activeStep.title}` 
                : `Done (${completedCount}/${totalCount})`
            }
          </p>
        </div>
        {totalCount > 0 && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-10 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
        {isActive && (
          <Sparkles className="h-3 w-3 animate-pulse text-primary flex-shrink-0" data-testid="thinking-compact-active" />
        )}
      </div>
    </div>
  );
}
