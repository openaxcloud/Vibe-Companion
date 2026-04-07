// @ts-nocheck
import { useState } from 'react';
import { ChevronDown, ChevronRight, Brain, CheckCircle, Loader2, Sparkles, Code, Search, FileText, Zap } from 'lucide-react';
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

export function ThinkingDisplay({ 
  steps, 
  isActive = false, 
  className,
  onStepClick,
  mode = 'detailed'
}: ThinkingDisplayProps) {
  // ✅ FIX (Nov 30, 2025): Add null safety for bootstrap session loading
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

  return (
    <Card 
      className={cn(
        "border transition-all duration-300",
        isActive ? "border-[#2a3040] bg-[#151b2b]/80 shadow-md" : "border-[#1e2536] bg-[#111827]/60",
        className
      )}
      data-testid="thinking-display"
    >
      {/* Header */}
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
          {mode === 'detailed' && safeSteps.length > 0 && (
            <span className="text-[11px] text-muted-foreground" data-testid="thinking-progress">
              {safeSteps.filter(s => s.status === 'complete').length} / {safeSteps.length} steps
            </span>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-border">
        {safeSteps.map((step, index) => {
          const isExpanded = expandedSteps.has(step.id);
          const stepType = step.type || 'reasoning';
          const Icon = STEP_ICONS[stepType] || Brain;
          const iconColor = STEP_COLORS[stepType] || 'text-purple-600 dark:text-purple-400';
          
          return (
            <div key={step.id} className="group">
              {/* Step Header */}
              <button
                onClick={() => toggleStep(step.id)}
                className={cn(
                  "w-full px-4 py-3 flex items-center gap-3 hover:bg-[#1a2235] transition-colors text-left",
                  step.status === 'active' && "bg-[#161d2e]"
                )}
                data-testid={`thinking-step-${step.id}`}
              >
                {/* Expand/Collapse Icon */}
                <div className="flex-shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* Step Icon */}
                <div className={cn(
                  "flex-shrink-0 rounded-full p-1.5",
                  step.status === 'complete' && "bg-green-900/50",
                  step.status === 'active' && "bg-blue-900/40",
                  step.status === 'pending' && "bg-[#1e2536]",
                  step.status === 'error' && "bg-red-900/50"
                )}>
                  {step.status === 'active' ? (
                    <Loader2 className={cn("h-4 w-4 animate-spin", iconColor)} />
                  ) : step.status === 'complete' ? (
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <Icon className={cn("h-4 w-4", iconColor)} />
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
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

                {/* Status Badge */}
                <div className="flex-shrink-0">
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

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 bg-background space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Main Content */}
                  <div className="pl-12">
                    <p className="text-[13px] text-foreground whitespace-pre-wrap">
                      {step.content}
                      {step.isStreaming && (
                        <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-1 align-middle" />
                      )}
                    </p>

                    {/* Progress Bar (if active with progress) */}
                    {step.status === 'active' && step.progress !== undefined && (
                      <Progress value={step.progress} className="h-1 mt-2" />
                    )}

                    {/* Details */}
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

                    {/* Timestamp */}
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      {step.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              )}

              {/* Visual Breakpoint Line */}
              {index < safeSteps.length - 1 && (
                <div className="pl-[52px]">
                  <div className={cn(
                    "w-0.5 h-2 ml-[11px]",
                    step.status === 'complete' ? "bg-green-300 dark:bg-green-700" : "bg-muted"
                  )} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active Indicator */}
      {isActive && safeSteps.length === 0 && (
        <div className="px-4 py-8 text-center space-y-2" data-testid="thinking-initializing">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" data-testid="thinking-loader" />
          <p className="text-[13px] text-muted-foreground" data-testid="thinking-init-message">Initializing thinking process...</p>
        </div>
      )}
    </Card>
  );
}

// Compact version for mobile/tablet
export function ThinkingDisplayCompact({ steps, isActive, className }: ThinkingDisplayProps) {
  // ✅ FIX (Nov 30, 2025): Add null safety for bootstrap session loading
  const safeSteps = steps || [];
  const activeStep = safeSteps.find(s => s.status === 'active');
  const completedCount = safeSteps.filter(s => s.status === 'complete').length;

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
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary flex-shrink-0" data-testid="thinking-compact-loader" />
        ) : (
          <Brain className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" data-testid="thinking-compact-icon" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium truncate" data-testid="thinking-compact-text">
            {activeStep ? activeStep.title : `Thinking (${completedCount}/${safeSteps.length})`}
          </p>
        </div>
        {isActive && (
          <Sparkles className="h-3 w-3 animate-pulse text-primary flex-shrink-0" data-testid="thinking-compact-active" />
        )}
      </div>
    </div>
  );
}
