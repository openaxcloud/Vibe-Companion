/**
 * Thinking Message Component
 * Displays AI extended thinking process with streaming animation
 */

import { Brain, CheckCircle2, Circle, Loader2, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThinkingStep } from './types';
import { Badge } from '@/components/ui/badge';
import { VibingAnimation } from './VibingAnimation';
import { useState } from 'react';

interface ThinkingMessageProps {
  steps: ThinkingStep[];
  isStreaming: boolean;
  totalTokens?: number;
  thinkingTime?: number;
}

const STEP_TYPE_CONFIG = {
  reasoning: { icon: Brain, label: 'Reasoning', color: 'text-blue-500' },
  analysis: { icon: Brain, label: 'Analysis', color: 'text-purple-500' },
  planning: { icon: Brain, label: 'Planning', color: 'text-green-500' },
  tool_use: { icon: Brain, label: 'Tool Use', color: 'text-orange-500' },
};

export function ThinkingMessage({ steps, isStreaming, totalTokens, thinkingTime }: ThinkingMessageProps) {
  // ✅ FIX (Nov 30, 2025): Add null safety for bootstrap session loading
  const safeSteps = steps || [];
  
  const [isExpanded, setIsExpanded] = useState(true);
  
  if (safeSteps.length === 0 && !isStreaming) return null;

  return (
    <div className="rounded-lg border border-[var(--ecode-border)] bg-[var(--ecode-surface)] overflow-hidden" data-testid="thinking-message">
      {/* Header - Clickable to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 min-h-[44px] hover:bg-[var(--ecode-surface-secondary)] transition-colors touch-manipulation"
        data-testid="thinking-toggle"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 md:h-4 md:w-4 text-[var(--ecode-text-secondary)] flex-shrink-0" />
          ) : (
            <ChevronRight className="h-5 w-5 md:h-4 md:w-4 text-[var(--ecode-text-secondary)] flex-shrink-0" />
          )}
          <div className="p-1.5 rounded-md bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 flex-shrink-0">
            <Brain className="h-5 w-5 md:h-4 md:w-4 text-violet-500" />
          </div>
          <span className="text-[13px] font-medium text-[var(--ecode-text)] truncate">
            {isStreaming ? 'Thinking...' : 'Thought Process'}
          </span>
          {isStreaming && <VibingAnimation size="sm" />}
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {!isStreaming && thinkingTime && (
            <Badge variant="outline" className="text-[11px] whitespace-nowrap">
              {thinkingTime}ms
            </Badge>
          )}
          {!isStreaming && totalTokens && (
            <Badge variant="outline" className="text-[11px] whitespace-nowrap">
              {totalTokens} tokens
            </Badge>
          )}
          {safeSteps.length > 0 && (
            <Badge variant="outline" className="text-[11px] whitespace-nowrap">
              {safeSteps.filter(s => s.status === 'completed').length}/{safeSteps.length} steps
            </Badge>
          )}
        </div>
      </button>

      {/* Thinking Steps - Collapsible */}
      {isExpanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-[var(--ecode-border)] pt-3">
          {safeSteps.map((step, index) => {
          const config = STEP_TYPE_CONFIG[step.type];
          const Icon = config.icon;
          
          return (
            <div
              key={step.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-md border transition-all",
                step.status === 'completed' && "bg-green-50 dark:bg-green-950/10 border-green-200 dark:border-green-900",
                step.status === 'active' && "bg-blue-50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900",
                step.status === 'error' && "bg-red-50 dark:bg-red-950/10 border-red-200 dark:border-red-900"
              )}
            >
              {/* Status Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {step.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />}
                {step.status === 'active' && <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />}
                {step.status === 'error' && <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("text-[11px] font-medium", config.color)}>
                    {config.label}
                  </span>
                  {step.duration && (
                    <span className="text-[11px] text-[var(--ecode-text-secondary)]">
                      {step.duration}ms
                    </span>
                  )}
                </div>
                <div className="text-[13px] font-medium text-[var(--ecode-text)] mb-1">
                  {step.title}
                </div>
                {step.content && (
                  <div className="text-[11px] text-[var(--ecode-text-secondary)] leading-relaxed">
                    {step.content}
                  </div>
                )}
              </div>
            </div>
          );
        })}

          {/* Streaming Indicator */}
          {isStreaming && safeSteps.length === 0 && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-blue-50 dark:bg-blue-950/10 border border-blue-200 dark:border-blue-800">
              <VibingAnimation />
              <span className="text-[13px] text-[var(--ecode-text)]">
                Processing your request...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
