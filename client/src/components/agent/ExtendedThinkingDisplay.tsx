import { Brain, ChevronDown, ChevronUp, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface ThinkingStep {
  id: string;
  type: 'reasoning' | 'analysis' | 'planning';
  title: string;
  content: string;
  status: 'active' | 'completed' | 'error';
  timestamp: Date;
  duration?: number;
  isStreaming?: boolean;
}

interface ExtendedThinkingDisplayProps {
  steps: ThinkingStep[];
  isThinking?: boolean;
  className?: string;
}

export function ExtendedThinkingDisplay({ 
  steps, 
  isThinking = false,
  className 
}: ExtendedThinkingDisplayProps) {
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set(steps.map(s => s.id)));

  const toggleStep = (stepId: string) => {
    setOpenSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (openSteps.size === steps.length) {
      setOpenSteps(new Set());
    } else {
      setOpenSteps(new Set(steps.map(s => s.id)));
    }
  };

  if (steps.length === 0 && !isThinking) {
    return null;
  }

  return (
    <Card className={cn("bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800", className)}>
      <div className="p-4 border-b border-purple-200 dark:border-purple-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-semibold text-purple-900 dark:text-purple-100">
              Extended Thinking
            </h3>
            {isThinking && (
              <Badge variant="outline" className="border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300">
                <Sparkles className="h-3 w-3 mr-1 animate-pulse" />
                Thinking...
              </Badge>
            )}
          </div>
          {steps.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAll}
              className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
              data-testid="button-toggle-all-thinking"
            >
              {openSteps.size === steps.length ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Collapse All
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Expand All
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="divide-y divide-purple-200 dark:divide-purple-800" data-testid="container-thinking-steps">
        {steps.map((step, index) => (
          <Collapsible
            key={step.id}
            open={openSteps.has(step.id)}
            onOpenChange={() => toggleStep(step.id)}
          >
            <div className="p-4">
              <CollapsibleTrigger asChild>
                <button 
                  className="flex items-start justify-between w-full text-left group"
                  data-testid={`button-toggle-thinking-${index}`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className={cn(
                      "mt-0.5 rounded-full p-1.5",
                      step.status === 'active' && "bg-purple-200 dark:bg-purple-800",
                      step.status === 'completed' && "bg-green-200 dark:bg-green-800",
                      step.status === 'error' && "bg-red-200 dark:bg-red-800"
                    )}>
                      {step.status === 'active' && step.isStreaming ? (
                        <Sparkles className="h-3 w-3 text-purple-700 dark:text-purple-300 animate-pulse" />
                      ) : (
                        <Brain className={cn(
                          "h-3 w-3",
                          step.status === 'active' && "text-purple-700 dark:text-purple-300",
                          step.status === 'completed' && "text-green-700 dark:text-green-300",
                          step.status === 'error' && "text-red-700 dark:text-red-300"
                        )} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-purple-900 dark:text-purple-100">
                          {step.title}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[11px]",
                            step.type === 'reasoning' && "border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300",
                            step.type === 'analysis' && "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300",
                            step.type === 'planning' && "border-green-300 text-green-700 dark:border-green-700 dark:text-green-300"
                          )}
                        >
                          {step.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                        {step.duration && (
                          <>
                            <span>•</span>
                            <span>{step.duration}ms</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "ml-2 transition-transform",
                    openSteps.has(step.id) ? "rotate-180" : "rotate-0"
                  )}>
                    <ChevronDown className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="mt-3 ml-9 text-[13px]">
                  {step.isStreaming && step.content.length === 0 ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full bg-purple-200 dark:bg-purple-800" />
                      <Skeleton className="h-4 w-3/4 bg-purple-200 dark:bg-purple-800" />
                    </div>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-purple-900 dark:text-purple-100 bg-white dark:bg-purple-950/30 p-3 rounded-md border border-purple-200 dark:border-purple-800">
                        {step.content}
                        {step.isStreaming && (
                          <span className="inline-block w-2 h-4 ml-1 bg-purple-500 animate-pulse" />
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}

        {isThinking && steps.length === 0 && (
          <div className="p-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 animate-pulse" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full bg-purple-200 dark:bg-purple-800" />
                <Skeleton className="h-4 w-2/3 bg-purple-200 dark:bg-purple-800" />
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
