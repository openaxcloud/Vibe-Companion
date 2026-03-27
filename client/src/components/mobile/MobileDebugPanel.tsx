// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Bug,
  Play,
  Pause,
  Square,
  Circle,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface Breakpoint {
  id: string;
  file: string;
  line: number;
  condition?: string;
  isEnabled: boolean;
  hitCount: number;
}

interface Variable {
  name: string;
  value: any;
  type: string;
  children?: Variable[];
}

interface DebugSession {
  projectId: string;
  isRunning: boolean;
  isPaused: boolean;
  breakpoints: Breakpoint[];
  variables: Variable[];
  callStack: any[];
  watchExpressions: string[];
  currentFile?: string;
  currentLine?: number;
}

interface MobileDebugPanelProps {
  projectId: string;
  className?: string;
}

function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-muted rounded-lg animate-opacity-pulse", className)} />
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-card">
          <ShimmerSkeleton className="w-5 h-5 rounded-full" />
          <div className="flex-1 space-y-2">
            <ShimmerSkeleton className="h-4 w-3/4" />
            <ShimmerSkeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MobileDebugPanel({ projectId, className }: MobileDebugPanelProps) {
  const [activeTab, setActiveTab] = useState<'breakpoints' | 'variables'>('breakpoints');
  const [expandedVariables, setExpandedVariables] = useState<Set<string>>(new Set());

  // Local state for debug session (pause/continue managed client-side)
  const [localDebugState, setLocalDebugState] = useState({
    isPaused: false,
    breakpoints: new Map<string, Breakpoint>(),
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: session, isLoading, refetch } = useQuery<DebugSession>({
    queryKey: [`/api/projects/${projectId}/debug-run`, projectId],
    queryFn: async () => {
      // Fetch debug session state from the backend
      // Note: The real backend doesn't have a session endpoint yet,
      // so we return a default state. WebSocket will provide real-time updates.
      return {
        projectId,
        isRunning: false,
        isPaused: false,
        breakpoints: [],
        variables: [],
        callStack: [],
        watchExpressions: [],
      } as DebugSession;
    },
    refetchInterval: (query) => {
      const data = query.state.data as DebugSession | undefined;
      return data?.isRunning ? 1000 : false;
    }
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/projects/${projectId}/debug-run`, {});
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Debug session started",
        description: "You can now set breakpoints and inspect variables"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start debugging",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      // Stop is a local action: close WebSocket connection (if exists) and reset state
      // In a real implementation, this would close the ws://[host]/ws/debugger connection
      setLocalDebugState({
        isPaused: false,
        breakpoints: new Map(),
      });
      return {};
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Debug session stopped"
      });
    }
  });

  const pauseMutation = useMutation({
    mutationFn: async () => {
      // Pause is a local state change: no backend API call needed
      setLocalDebugState(prev => ({
        ...prev,
        isPaused: true,
      }));
      return {};
    },
    onSuccess: () => {
      toast({
        title: "Paused at breakpoint",
        description: "Execution paused, inspect variables"
      });
    }
  });

  const continueMutation = useMutation({
    mutationFn: async () => {
      // Continue is a local state change: no backend API call needed
      setLocalDebugState(prev => ({
        ...prev,
        isPaused: false,
      }));
      return {};
    },
    onSuccess: () => {
      toast({
        title: "Resumed execution"
      });
    }
  });

  const toggleEnableMutation = useMutation({
    mutationFn: async (breakpointId: string) => {
      // Toggle breakpoint is a local state change: no backend API call needed
      setLocalDebugState(prev => {
        const newBreakpoints = new Map(prev.breakpoints);
        const bp = newBreakpoints.get(breakpointId);
        if (bp) {
          bp.isEnabled = !bp.isEnabled;
        }
        return {
          ...prev,
          breakpoints: newBreakpoints,
        };
      });
      return {};
    },
    onSuccess: () => {
      // No refetch needed, local state is already updated
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (breakpointId: string) => {
      // Delete breakpoint is a local state change: no backend API call needed
      setLocalDebugState(prev => {
        const newBreakpoints = new Map(prev.breakpoints);
        newBreakpoints.delete(breakpointId);
        return {
          ...prev,
          breakpoints: newBreakpoints,
        };
      });
      return {};
    },
    onSuccess: () => {
      toast({
        title: "Breakpoint removed"
      });
    }
  });

  const handleStart = () => {
    startMutation.mutate(undefined as any);
  };

  const handlePause = () => {
    pauseMutation.mutate(undefined as any);
  };

  const handleContinue = () => {
    continueMutation.mutate(undefined as any);
  };

  const handleStop = () => {
    stopMutation.mutate(undefined as any);
  };

  const toggleBreakpoint = (id: string) => {
    toggleEnableMutation.mutate(id);
  };

  const deleteBreakpoint = (id: string) => {
    deleteMutation.mutate(id);
  };

  const toggleVariable = (name: string) => {
    const newExpanded = new Set(expandedVariables);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedVariables(newExpanded);
  };

  const renderValue = (value: any): string => {
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return `[${value.length} items]`;
      }
      return `{${Object.keys(value).length} props}`;
    }
    return JSON.stringify(value);
  };

  const breakpoints = Array.from(localDebugState.breakpoints.values());
  const variables = session?.variables || [];
  const isRunning = session?.isRunning || false;
  const isPaused = localDebugState.isPaused;

  return (
    <div className={cn("h-full flex flex-col bg-background", className)}>
      {/* Header */}
      <div className="p-4 border-b border-border bg-card min-h-[56px] flex flex-col justify-center">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bug className="w-[18px] h-[18px] text-primary" />
            <h3 className="text-[17px] font-medium leading-tight text-foreground">Debugger</h3>
          </div>
          {isLoading && (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
          {!isLoading && isRunning && (
            <Badge 
              className={cn(
                "text-[11px] uppercase tracking-wider font-medium rounded-lg",
                isPaused 
                  ? "bg-muted text-muted-foreground" 
                  : "bg-primary text-primary-foreground"
              )}
            >
              {isPaused ? 'Paused' : 'Running'}
            </Badge>
          )}
        </div>

        {/* Debug Controls */}
        <div className="flex gap-2">
          {!isRunning ? (
            <Button 
              className="flex-1 h-11 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[15px] leading-[20px]"
              onClick={handleStart}
              disabled={startMutation.isPending || isLoading}
              data-testid="button-debug-start"
            >
              {startMutation.isPending ? (
                <div className="w-[18px] h-[18px] border-2 border-primary-foreground border-t-transparent rounded-full mr-2 animate-spin" />
              ) : (
                <Play className="w-[18px] h-[18px] mr-2" />
              )}
              Start
            </Button>
          ) : (
            <>
              {isPaused ? (
                <Button 
                  className="flex-1 h-10 rounded-lg bg-muted hover:bg-accent text-foreground text-[15px] leading-[20px] border border-border"
                  onClick={handleContinue}
                  disabled={continueMutation.isPending}
                  data-testid="button-debug-continue"
                >
                  {continueMutation.isPending ? (
                    <div className="w-[18px] h-[18px] border-2 border-foreground border-t-transparent rounded-full mr-2 animate-spin" />
                  ) : (
                    <Play className="w-[18px] h-[18px] mr-2" />
                  )}
                  Continue
                </Button>
              ) : (
                <Button 
                  className="flex-1 h-10 rounded-lg bg-muted hover:bg-accent text-foreground text-[15px] leading-[20px] border border-border"
                  onClick={handlePause}
                  disabled={pauseMutation.isPending}
                  data-testid="button-debug-pause"
                >
                  {pauseMutation.isPending ? (
                    <div className="w-[18px] h-[18px] border-2 border-foreground border-t-transparent rounded-full mr-2 animate-spin" />
                  ) : (
                    <Pause className="w-[18px] h-[18px] mr-2" />
                  )}
                  Pause
                </Button>
              )}
              <Button 
                className="w-11 h-11 rounded-lg bg-muted hover:bg-accent text-foreground border border-border p-0"
                onClick={handleStop}
                disabled={stopMutation.isPending}
                data-testid="button-debug-stop"
              >
                {stopMutation.isPending ? (
                  <div className="w-[18px] h-[18px] border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Square className="w-[18px] h-[18px]" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-card">
        {(['breakpoints', 'variables'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-3 text-[15px] leading-[20px] font-medium capitalize transition-colors flex items-center justify-center gap-2",
              activeTab === tab
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            )}
            data-testid={`tab-${tab}`}
          >
            {tab}
            {tab === 'breakpoints' && breakpoints.length > 0 && (
              <Badge className="text-[11px] uppercase tracking-wider bg-muted text-muted-foreground rounded-lg">
                {breakpoints.length}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {activeTab === 'breakpoints' && (
          <div className="p-4 space-y-2">
            {isLoading && <LoadingSkeleton />}

            {!isLoading && breakpoints.map((bp) => (
              <div 
                key={bp.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg",
                  bp.isEnabled 
                    ? "bg-primary/10 border border-primary/30"
                    : "bg-card border border-border"
                )}
                data-testid={`breakpoint-${bp.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => toggleBreakpoint(bp.id)}
                    className="flex-shrink-0 w-11 h-11 flex items-center justify-center"
                    disabled={toggleEnableMutation.isPending}
                    data-testid={`button-toggle-breakpoint-${bp.id}`}
                  >
                    <Circle 
                      className={cn(
                        "w-[18px] h-[18px]",
                        bp.isEnabled 
                          ? "fill-primary text-primary"
                          : "text-muted-foreground"
                      )}
                    />
                  </button>
                  <div className="min-w-0">
                    <div className="text-[15px] leading-[20px] font-mono text-foreground truncate">{bp.file}</div>
                    <div className="text-[13px] text-muted-foreground">
                      Line {bp.line}
                      {bp.hitCount > 0 && ` • Hit ${bp.hitCount}×`}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="w-11 h-11 flex-shrink-0 rounded-lg hover:bg-accent p-0"
                  onClick={() => deleteBreakpoint(bp.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-breakpoint-${bp.id}`}
                >
                  <Trash2 className="w-[18px] h-[18px] text-muted-foreground" />
                </Button>
              </div>
            ))}

            {!isLoading && breakpoints.length === 0 && (
              <div className="text-center py-16">
                <Bug className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                <h4 className="text-[17px] font-medium leading-tight text-foreground mb-2">No breakpoints set</h4>
                <p className="text-[13px] text-muted-foreground mb-6">Click line numbers in the editor to add breakpoints</p>
                <Button 
                  className="h-11 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[15px] leading-[20px] px-6"
                  data-testid="button-add-breakpoint-empty"
                  disabled
                >
                  <Plus className="w-[18px] h-[18px] mr-2" />
                  Add Breakpoint
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'variables' && (
          <div className="p-4 space-y-1">
            {!isRunning || !isPaused ? (
              <div className="text-center py-16">
                <Bug className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                <h4 className="text-[17px] font-medium leading-tight text-foreground mb-2">No variables available</h4>
                <p className="text-[13px] text-muted-foreground mb-6">Start debugging and pause execution to inspect variables</p>
                <Button 
                  className="h-11 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[15px] leading-[20px] px-6"
                  onClick={handleStart}
                  disabled={startMutation.isPending || isRunning}
                  data-testid="button-start-debug-variables"
                >
                  <Play className="w-[18px] h-[18px] mr-2" />
                  Start Debugging
                </Button>
              </div>
            ) : (
              <>
                {isLoading && <LoadingSkeleton />}
                
                {!isLoading && variables.length === 0 && (
                  <div className="text-center py-16">
                    <Bug className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                    <h4 className="text-[17px] font-medium leading-tight text-foreground mb-2">No variables in scope</h4>
                    <p className="text-[13px] text-muted-foreground">No variables are available in the current execution context</p>
                  </div>
                )}

                {!isLoading && variables.map((variable) => (
                  <div key={variable.name}>
                    <button
                      onClick={() => toggleVariable(variable.name)}
                      className="w-full flex items-center gap-2 p-3 hover:bg-muted rounded-lg text-left min-h-[44px]"
                      data-testid={`variable-${variable.name}`}
                    >
                      {variable.type === 'object' || variable.type === 'array' ? (
                        expandedVariables.has(variable.name) ? (
                          <ChevronDown className="w-[18px] h-[18px] flex-shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-[18px] h-[18px] flex-shrink-0 text-muted-foreground" />
                        )
                      ) : (
                        <div className="w-[18px]" />
                      )}
                      <span className="font-mono text-[15px] leading-[20px] text-foreground flex-1">{variable.name}:</span>
                      <span className="text-[13px] text-muted-foreground">
                        {renderValue(variable.value)}
                      </span>
                      <Badge className="text-[11px] uppercase tracking-wider bg-muted text-muted-foreground rounded-lg">
                        {variable.type}
                      </Badge>
                    </button>
                    
                    {expandedVariables.has(variable.name) && variable.children && (
                      <div className="ml-6 pl-3 border-l-2 border-border space-y-1 mt-1">
                        {variable.children.map((child) => (
                          <div 
                            key={child.name}
                            className="flex items-center gap-2 p-3 text-[13px] font-mono min-h-[44px]"
                          >
                            <span className="text-muted-foreground">{child.name}:</span>
                            <span className="text-foreground">{JSON.stringify(child.value)}</span>
                            <Badge className="text-[11px] uppercase tracking-wider bg-muted text-muted-foreground rounded-lg ml-auto">
                              {child.type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {expandedVariables.has(variable.name) && !variable.children && (
                      <div className="ml-6 pl-3 border-l-2 border-border space-y-1 mt-1">
                        {typeof variable.value === 'object' && variable.value !== null && (
                          Object.entries(variable.value).map(([key, val]) => (
                            <div 
                              key={key}
                              className="flex items-center gap-2 p-3 text-[13px] font-mono min-h-[44px]"
                            >
                              <span className="text-muted-foreground">{key}:</span>
                              <span className="text-foreground">{JSON.stringify(val)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Bottom Action Bar - Fixed with safe-area padding */}
      {activeTab === 'breakpoints' && breakpoints.length > 0 && (
        <div className="p-4 border-t border-border bg-card pb-[calc(16px+env(safe-area-inset-bottom))]">
          <Button 
            className="w-full h-11 rounded-lg bg-muted hover:bg-accent text-foreground text-[15px] leading-[20px] border border-border"
            data-testid="button-add-breakpoint"
            disabled
          >
            <Plus className="w-[18px] h-[18px] mr-2" />
            Add Breakpoint
          </Button>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground text-center mt-3">
            Click line numbers in code editor to add breakpoints
          </p>
        </div>
      )}
    </div>
  );
}
