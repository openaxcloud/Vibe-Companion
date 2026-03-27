// @ts-nocheck
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Play, Pause, SkipForward, CornerDownRight, CornerUpLeft, Square,
  Circle, Eye, Trash2, Bug, Loader2
} from 'lucide-react';

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

interface CallStackFrame {
  id: string;
  name: string;
  file: string;
  line: number;
  isActive: boolean;
}

interface DebugSession {
  projectId: string;
  isRunning: boolean;
  isPaused: boolean;
  breakpoints: Breakpoint[];
  variables: Variable[];
  callStack: CallStackFrame[];
  watchExpressions: string[];
  currentFile?: string;
  currentLine?: number;
}

interface DebuggerPanelProps {
  projectId: number | string;
  onFileSelect?: (filePath: string, line?: number) => void;
}

export function DebuggerPanel({ projectId, onFileSelect }: DebuggerPanelProps) {
  const [watchExpression, setWatchExpression] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const projectIdStr = String(projectId);

  // Fetch debug session
  const { data: session, isLoading, refetch } = useQuery<DebugSession>({
    queryKey: ['/api/debug/session', projectIdStr],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/debug/session/${projectIdStr}`);
      return response;
    },
    refetchInterval: (query) => {
      const data = query.state.data as DebugSession | undefined;
      return data?.isRunning ? 2000 : false; // Poll every 2 seconds when running
    }
  });

  // Mutations
  const startMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/debug/start/${projectIdStr}`, {});
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Debugger started" });
    }
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/debug/stop/${projectIdStr}`, {});
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Debugger stopped" });
    }
  });

  const pauseMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/debug/pause/${projectIdStr}`, {});
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Paused at breakpoint", description: "Inspect variables and call stack" });
    }
  });

  const continueMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/debug/continue/${projectIdStr}`, {});
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Resumed" });
    }
  });

  const stepOverMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/debug/step-over/${projectIdStr}`, {});
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Step over" });
    }
  });

  const stepIntoMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/debug/step-into/${projectIdStr}`, {});
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Step into" });
    }
  });

  const stepOutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/debug/step-out/${projectIdStr}`, {});
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Step out" });
    }
  });

  const toggleEnableMutation = useMutation({
    mutationFn: async (breakpointId: string) => {
      return await apiRequest('POST', `/api/debug/breakpoint/enable/${projectIdStr}/${breakpointId}`, {});
    },
    onSuccess: () => {
      refetch();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (breakpointId: string) => {
      return await apiRequest('DELETE', `/api/debug/breakpoint/${projectIdStr}/${breakpointId}`, {});
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Breakpoint deleted" });
    }
  });

  const handleStart = () => {
    startMutation.mutate(undefined as any);
  };

  const handleStop = () => {
    stopMutation.mutate(undefined as any);
  };

  const handlePause = () => {
    if (session?.isPaused) {
      continueMutation.mutate(undefined as any);
    } else {
      pauseMutation.mutate(undefined as any);
    }
  };

  const handleStepOver = () => {
    stepOverMutation.mutate(undefined as any);
  };

  const handleStepInto = () => {
    stepIntoMutation.mutate(undefined as any);
  };

  const handleStepOut = () => {
    stepOutMutation.mutate(undefined as any);
  };

  const toggleBreakpoint = (id: string) => {
    toggleEnableMutation.mutate(id);
  };

  const deleteBreakpoint = (id: string) => {
    deleteMutation.mutate(id);
  };

  const addWatch = () => {
    if (!watchExpression.trim()) return;
    toast({ title: `Watching: ${watchExpression}` });
    setWatchExpression('');
  };

  const isDebugging = session?.isRunning || false;
  const isPaused = session?.isPaused || false;
  const breakpoints = session?.breakpoints || [];
  const variables = session?.variables || [];
  const callStack = session?.callStack || [];

  const renderValue = (value: any): string => {
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return `[${value.length} items]`;
      }
      return `{${Object.keys(value).length} props}`;
    }
    return JSON.stringify(value);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--ecode-surface)]" data-testid="debugger-panel">
      {/* Header */}
      <div className="h-9 border-b border-[var(--ecode-border)] flex items-center justify-between px-2.5 bg-[var(--ecode-surface)]">
        <h3 className="text-xs font-medium text-[var(--ecode-text-muted)] flex items-center gap-1.5">
          <Bug className="h-3.5 w-3.5" />
          Debugger
        </h3>
        <div className="flex items-center gap-1.5">
          {isLoading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--ecode-text-muted)]" />
          )}
          {!isLoading && isDebugging && (
            <Badge variant={isPaused ? "secondary" : "default"} className="text-[10px] h-4 px-1.5">
              {isPaused ? 'Paused' : 'Running'}
            </Badge>
          )}
        </div>
      </div>
      
      {/* Debug Controls */}
      <div className="p-2.5 border-b border-[var(--ecode-border)] space-y-2">

        <div className="flex gap-2">
          {!isDebugging ? (
            <Button
              onClick={handleStart}
              className="flex-1"
              disabled={startMutation.isPending || isLoading}
              data-testid="button-start-debug"
            >
              {startMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Start
            </Button>
          ) : (
            <>
              <Button
                variant={isPaused ? "default" : "secondary"}
                onClick={handlePause}
                disabled={pauseMutation.isPending || continueMutation.isPending}
                data-testid="button-pause-debug"
              >
                {pauseMutation.isPending || continueMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPaused ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={handleStepOver}
                disabled={!isPaused || stepOverMutation.isPending}
                title="Step Over"
                data-testid="button-step-over"
              >
                {stepOverMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SkipForward className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={handleStepInto}
                disabled={!isPaused || stepIntoMutation.isPending}
                title="Step Into"
                data-testid="button-step-into"
              >
                {stepIntoMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CornerDownRight className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={handleStepOut}
                disabled={!isPaused || stepOutMutation.isPending}
                title="Step Out"
                data-testid="button-step-out"
              >
                {stepOutMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CornerUpLeft className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="destructive"
                onClick={handleStop}
                disabled={stopMutation.isPending}
                data-testid="button-stop-debug"
              >
                {stopMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Debug Info */}
      <Tabs defaultValue="breakpoints" className="flex-1 flex flex-col">
        <TabsList className="h-9 w-full justify-start border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)] rounded-none p-0 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <TabsTrigger value="breakpoints" className="h-full rounded-none text-xs px-2.5 whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-[hsl(142,72%,42%)]" data-testid="tab-breakpoints">
            Breakpoints {breakpoints.length > 0 && `(${breakpoints.length})`}
          </TabsTrigger>
          <TabsTrigger value="variables" className="h-full rounded-none text-xs px-2.5 whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-[hsl(142,72%,42%)]" data-testid="tab-variables">
            Variables
          </TabsTrigger>
          <TabsTrigger value="call-stack" className="h-full rounded-none text-xs px-2.5 whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-[hsl(142,72%,42%)]" data-testid="tab-call-stack">
            Call Stack
          </TabsTrigger>
          <TabsTrigger value="watch" className="h-full rounded-none text-xs px-2.5 whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-[hsl(142,72%,42%)]" data-testid="tab-watch">
            Watch
          </TabsTrigger>
        </TabsList>

        <TabsContent value="breakpoints" className="flex-1 overflow-auto m-0 p-4 space-y-2">
          <h4 className="text-[13px] font-semibold mb-2">Active Breakpoints</h4>
          
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {!isLoading && breakpoints.length === 0 && (
            <div className="text-center text-[13px] text-muted-foreground py-8">
              <Bug className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p>No breakpoints set</p>
              <p className="text-[11px] mt-1">Click line numbers in editor to add</p>
            </div>
          )}

          {!isLoading && breakpoints.map((bp) => (
            <Card
              key={bp.id}
              className="p-3 cursor-pointer hover:bg-accent transition-colors"
              onClick={() => onFileSelect?.(bp.file, bp.line)}
              data-testid={`breakpoint-${bp.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBreakpoint(bp.id);
                    }}
                    className={`${bp.isEnabled ? 'text-red-500' : 'text-gray-400'}`}
                    disabled={toggleEnableMutation.isPending}
                  >
                    <Circle className={`h-4 w-4 ${bp.isEnabled ? 'fill-current' : ''}`} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[13px] truncate">{bp.file}</div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>Line {bp.line}</span>
                      {bp.hitCount > 0 && (
                        <Badge variant="outline" className="text-[11px]">
                          Hit {bp.hitCount}×
                        </Badge>
                      )}
                      {bp.condition && (
                        <Badge variant="outline" className="text-[11px]">
                          Condition: {bp.condition}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteBreakpoint(bp.id);
                  }}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-bp-${bp.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="variables" className="flex-1 overflow-auto m-0 p-4 space-y-2">
          <h4 className="text-[13px] font-semibold mb-2">Local Variables</h4>
          {!isPaused ? (
            <div className="text-center text-[13px] text-muted-foreground py-8">
              <Pause className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p>Pause execution to view variables</p>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
              
              {!isLoading && variables.length === 0 && (
                <div className="text-center text-[13px] text-muted-foreground py-8">
                  <Bug className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p>No variables in current scope</p>
                </div>
              )}

              {!isLoading && variables.map((variable, idx) => (
                <Card key={idx} className="p-3" data-testid={`variable-${variable.name}`}>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-[13px]">{variable.name}</span>
                      <Badge variant="secondary" className="text-[11px]">{variable.type}</Badge>
                    </div>
                    <code className="text-[11px] text-muted-foreground break-all">
                      {renderValue(variable.value)}
                    </code>
                  </div>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="call-stack" className="flex-1 overflow-auto m-0 p-4 space-y-2">
          <h4 className="text-[13px] font-semibold mb-2">Call Stack</h4>
          {!isPaused ? (
            <div className="text-center text-[13px] text-muted-foreground py-8">
              <Pause className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p>Pause execution to view call stack</p>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}

              {!isLoading && callStack.length === 0 && (
                <div className="text-center text-[13px] text-muted-foreground py-8">
                  <Bug className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p>No call stack available</p>
                </div>
              )}

              {!isLoading && callStack.map((frame, idx) => (
                <Card
                  key={idx}
                  className={`p-3 cursor-pointer hover:bg-accent transition-colors ${frame.isActive ? 'border-primary' : ''}`}
                  onClick={() => onFileSelect?.(frame.file, frame.line)}
                  data-testid={`stack-frame-${idx}`}
                >
                  <div className="space-y-1">
                    <div className="font-mono text-[13px]">{frame.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {frame.file}:{frame.line}
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="watch" className="flex-1 overflow-auto m-0 p-4 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Expression to watch..."
              value={watchExpression}
              onChange={(e) => setWatchExpression(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addWatch()}
              data-testid="input-watch-expression"
            />
            <Button
              onClick={addWatch}
              disabled={!watchExpression.trim()}
              data-testid="button-add-watch"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-center text-[13px] text-muted-foreground py-8">
            <Eye className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p>Add expressions to watch</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
