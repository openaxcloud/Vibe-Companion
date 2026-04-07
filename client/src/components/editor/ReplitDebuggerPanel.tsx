import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { LazyMotionDiv } from '@/lib/motion';
import {
  Bug,
  Play,
  Pause,
  Square,
  SkipForward,
  ArrowDown,
  ArrowUp,
  ArrowRight,
  Circle,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  X
} from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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

function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <LazyMotionDiv
      className={cn("bg-muted rounded-lg", className)}
      animate={{
        backgroundPosition: ["200% 0", "-200% 0"],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "linear",
      }}
      style={{
        backgroundImage: "linear-gradient(90deg, transparent, hsl(var(--accent)), transparent)",
        backgroundSize: "200% 100%",
      }}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-3 space-y-3">
      <ShimmerSkeleton className="h-8 w-full" />
      <ShimmerSkeleton className="h-8 w-3/4" />
      <ShimmerSkeleton className="h-8 w-5/6" />
      <ShimmerSkeleton className="h-8 w-2/3" />
    </div>
  );
}

function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  actionLabel, 
  onAction 
}: { 
  icon: any;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-3">
      <Icon className="w-12 h-12 text-muted-foreground opacity-40 mb-3" />
      <h4 className="text-[15px] leading-[20px] font-medium text-foreground mb-1">
        {title}
      </h4>
      <p className="text-[13px] text-muted-foreground text-center mb-4">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[13px]"
          data-testid="button-empty-state-action"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function ReplitDebuggerPanel({ projectId = '1' }: { projectId?: string }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('breakpoints');
  const [expandedVariables, setExpandedVariables] = useState<Set<string>>(new Set());
  const [newWatchExpression, setNewWatchExpression] = useState('');

  const { data: session, refetch, isLoading } = useQuery<DebugSession>({
    queryKey: ['/api/debug/session', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/debug/session/${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch debug session');
      return res.json();
    },
  });

  const startDebugMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/debug/start/${projectId}`, {});
    },
    onSuccess: () => {
      refetch();
      toast({ description: 'Debug session started' });
    },
    onError: (error: any) => {
      toast({ description: error.message || 'Failed to start debugging', variant: 'destructive' });
    },
  });

  const stopDebugMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/debug/stop/${projectId}`, {});
    },
    onSuccess: () => {
      refetch();
      toast({ description: 'Debug session stopped' });
    },
  });

  const pauseDebugMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/debug/pause/${projectId}`, {});
    },
    onSuccess: () => {
      refetch();
      toast({ description: 'Paused at breakpoint' });
    },
  });

  const continueDebugMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/debug/continue/${projectId}`, {});
    },
    onSuccess: () => {
      refetch();
      toast({ description: 'Resumed execution' });
    },
  });

  const stepOverMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/debug/step-over/${projectId}`, {});
    },
    onSuccess: () => refetch(),
  });

  const stepIntoMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/debug/step-into/${projectId}`, {});
    },
    onSuccess: () => refetch(),
  });

  const stepOutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/debug/step-out/${projectId}`, {});
    },
    onSuccess: () => refetch(),
  });

  const toggleBreakpointMutation = useMutation({
    mutationFn: async ({ breakpointId }: { breakpointId: string }) => {
      return apiRequest('POST', `/api/debug/breakpoint/enable/${projectId}/${breakpointId}`, {});
    },
    onSuccess: () => refetch(),
  });

  const deleteBreakpointMutation = useMutation({
    mutationFn: async ({ breakpointId }: { breakpointId: string }) => {
      return apiRequest('DELETE', `/api/debug/breakpoint/${projectId}/${breakpointId}`, {});
    },
    onSuccess: () => refetch(),
  });

  const addWatchMutation = useMutation({
    mutationFn: async ({ expression }: { expression: string }) => {
      return apiRequest('POST', `/api/debug/watch/add/${projectId}`, { expression });
    },
    onSuccess: () => {
      refetch();
      setNewWatchExpression('');
    },
  });

  const deleteWatchMutation = useMutation({
    mutationFn: async ({ index }: { index: number }) => {
      return apiRequest('DELETE', `/api/debug/watch/${projectId}/${index}`, {});
    },
    onSuccess: () => refetch(),
  });

  const toggleVariableExpansion = (name: string) => {
    const newExpanded = new Set(expandedVariables);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedVariables(newExpanded);
  };

  const handleAddWatch = () => {
    if (newWatchExpression.trim()) {
      addWatchMutation.mutate({ expression: newWatchExpression.trim() });
    }
  };

  const renderVariableValue = (value: any, type: string) => {
    if (type === 'object') {
      return <span className="text-muted-foreground">{'{ ... }'}</span>;
    }
    if (type === 'string') {
      return <span className="text-primary">"{value}"</span>;
    }
    if (type === 'boolean') {
      return <span className="text-primary">{value.toString()}</span>;
    }
    if (type === 'number') {
      return <span className="text-primary">{value}</span>;
    }
    return <span className="text-foreground">{value}</span>;
  };

  const isRunning = session?.isRunning || false;
  const isPaused = session?.isPaused || false;
  const breakpoints = session?.breakpoints || [];
  const variables = session?.variables || [];
  const callStack = session?.callStack || [];
  const watchExpressions = session?.watchExpressions || [];

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-card">
        <div className="p-3 min-h-[48px] border-b border-border">
          <ShimmerSkeleton className="h-6 w-24" />
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ecode-surface)]">
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Bug className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">Debugger</span>
          {isRunning && (
            <Badge className={cn(
              "h-4 px-1 text-[9px] rounded",
              isPaused 
                ? "bg-[var(--ecode-sidebar-hover)] text-[var(--ecode-text-muted)]" 
                : "bg-[hsl(142,72%,42%)]/10 text-[hsl(142,72%,42%)]"
            )}>
              {isPaused ? 'Paused' : 'Running'}
            </Badge>
          )}
        </div>
      </div>

      <div className="px-2.5 py-1.5 border-b border-[var(--ecode-border)] shrink-0">

        {/* Debug Controls */}
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <Button
              onClick={() => startDebugMutation.mutate(undefined)}
              disabled={startDebugMutation.isPending}
              className="h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[13px] px-3"
              data-testid="button-debug-start"
            >
              <Play className="w-[18px] h-[18px] mr-2" />
              Start Debug
            </Button>
          ) : (
            <>
              {isPaused ? (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg border-border bg-transparent hover:bg-accent"
                  onClick={() => continueDebugMutation.mutate(undefined)}
                  disabled={continueDebugMutation.isPending}
                  data-testid="button-debug-continue"
                >
                  <Play className="w-[18px] h-[18px] text-primary" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg border-border bg-transparent hover:bg-accent"
                  onClick={() => pauseDebugMutation.mutate(undefined)}
                  disabled={pauseDebugMutation.isPending}
                  data-testid="button-debug-pause"
                >
                  <Pause className="w-[18px] h-[18px] text-muted-foreground" />
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg border-border bg-transparent hover:bg-accent"
                onClick={() => stopDebugMutation.mutate(undefined)}
                disabled={stopDebugMutation.isPending}
                data-testid="button-debug-stop"
              >
                <Square className="w-[18px] h-[18px] text-muted-foreground" />
              </Button>
              <div className="w-px h-6 bg-border mx-1" />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg border-border bg-transparent hover:bg-accent"
                disabled={!isPaused || stepOverMutation.isPending}
                onClick={() => stepOverMutation.mutate(undefined)}
                data-testid="button-debug-step-over"
              >
                <ArrowRight className="w-[18px] h-[18px] text-muted-foreground" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg border-border bg-transparent hover:bg-accent"
                disabled={!isPaused || stepIntoMutation.isPending}
                onClick={() => stepIntoMutation.mutate(undefined)}
                data-testid="button-debug-step-into"
              >
                <ArrowDown className="w-[18px] h-[18px] text-muted-foreground" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg border-border bg-transparent hover:bg-accent"
                disabled={!isPaused || stepOutMutation.isPending}
                onClick={() => stepOutMutation.mutate(undefined)}
                data-testid="button-debug-step-out"
              >
                <ArrowUp className="w-[18px] h-[18px] text-muted-foreground" />
              </Button>
              <div className="w-px h-6 bg-border mx-1" />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg border-border bg-transparent hover:bg-accent"
                onClick={() => refetch()}
                data-testid="button-debug-refresh"
              >
                <RefreshCw className="w-[18px] h-[18px] text-muted-foreground" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4 p-3 bg-card gap-1">
          <TabsTrigger 
            value="breakpoints" 
            className="text-[11px] uppercase tracking-wider h-8 rounded-lg data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground"
          >
            Breakpoints
          </TabsTrigger>
          <TabsTrigger 
            value="variables" 
            className="text-[11px] uppercase tracking-wider h-8 rounded-lg data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground"
          >
            Variables
          </TabsTrigger>
          <TabsTrigger 
            value="watch" 
            className="text-[11px] uppercase tracking-wider h-8 rounded-lg data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground"
          >
            Watch
          </TabsTrigger>
          <TabsTrigger 
            value="callstack" 
            className="text-[11px] uppercase tracking-wider h-8 rounded-lg data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground"
          >
            Call Stack
          </TabsTrigger>
        </TabsList>

        {/* Breakpoints Tab */}
        <TabsContent value="breakpoints" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {breakpoints.length > 0 ? (
                breakpoints.map((bp) => (
                  <div
                    key={bp.id}
                    className={cn(
                      "flex items-center gap-3 p-3 hover:bg-accent rounded-lg transition-colors",
                      !bp.isEnabled && "opacity-50"
                    )}
                    data-testid={`breakpoint-${bp.id}`}
                  >
                    <input
                      type="checkbox"
                      checked={bp.isEnabled}
                      onChange={() => toggleBreakpointMutation.mutate({ breakpointId: bp.id })}
                      className="rounded border-border bg-muted w-4 h-4"
                    />
                    <Circle className={cn(
                      "w-[18px] h-[18px]",
                      bp.isEnabled ? "text-primary fill-primary" : "text-muted-foreground"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] leading-[20px] font-mono text-foreground truncate">
                        {bp.file}:{bp.line}
                      </div>
                      {bp.condition && (
                        <div className="text-[13px] text-muted-foreground">
                          Condition: {bp.condition}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[11px] uppercase tracking-wider px-2 py-0.5 border-border text-muted-foreground rounded-lg">
                      {bp.hitCount}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg hover:bg-accent"
                      onClick={() => deleteBreakpointMutation.mutate({ breakpointId: bp.id })}
                      data-testid={`button-delete-breakpoint-${bp.id}`}
                    >
                      <Trash2 className="w-[18px] h-[18px] text-muted-foreground hover:text-primary" />
                    </Button>
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={Circle}
                  title="No breakpoints set"
                  description="Click on line numbers in the editor to add breakpoints"
                />
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Variables Tab */}
        <TabsContent value="variables" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {isRunning && isPaused && variables.length > 0 ? (
                variables.map((variable) => (
                  <div key={variable.name} className="space-y-1">
                    <div
                      className={cn(
                        "flex items-center gap-3 p-3 hover:bg-accent rounded-lg cursor-pointer transition-colors",
                        variable.children && "font-medium"
                      )}
                      onClick={() => variable.children && toggleVariableExpansion(variable.name)}
                    >
                      {variable.children ? (
                        expandedVariables.has(variable.name) ? (
                          <ChevronDown className="w-[18px] h-[18px] text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-[18px] h-[18px] text-muted-foreground" />
                        )
                      ) : (
                        <div className="w-[18px]" />
                      )}
                      <span className="text-[15px] leading-[20px] text-foreground font-mono">
                        {variable.name}
                      </span>
                      <span className="text-[15px] leading-[20px] text-muted-foreground">:</span>
                      <span className="text-[15px] leading-[20px] font-mono">
                        {renderVariableValue(variable.value, variable.type)}
                      </span>
                    </div>

                    {variable.children && expandedVariables.has(variable.name) && (
                      <div className="ml-8 space-y-1">
                        {variable.children.map((child) => (
                          <div
                            key={child.name}
                            className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg transition-colors"
                          >
                            <div className="w-[18px]" />
                            <span className="text-[15px] leading-[20px] text-foreground font-mono">
                              {child.name}
                            </span>
                            <span className="text-[15px] leading-[20px] text-muted-foreground">:</span>
                            <span className="text-[15px] leading-[20px] font-mono">
                              {renderVariableValue(child.value, child.type)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={AlertCircle}
                  title={isRunning ? 'Not paused' : 'No active debug session'}
                  description={isRunning ? 'Pause execution to inspect variables' : 'Start debugging to see variables'}
                  actionLabel={!isRunning ? 'Start Debug' : undefined}
                  onAction={!isRunning ? () => startDebugMutation.mutate(undefined) : undefined}
                />
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Watch Tab */}
        <TabsContent value="watch" className="flex-1 mt-0">
          <div className="p-3 space-y-3">
            <div className="flex gap-2">
              <Input
                value={newWatchExpression}
                onChange={(e) => setNewWatchExpression(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddWatch()}
                placeholder="Add watch expression..."
                className="flex-1 h-8 rounded-lg text-[13px] font-mono bg-muted border-border text-foreground placeholder:text-muted-foreground"
                data-testid="input-watch-expression"
              />
              <Button
                onClick={handleAddWatch}
                className="h-8 w-8 rounded-lg bg-primary hover:bg-primary/90 p-0"
                disabled={!newWatchExpression.trim() || addWatchMutation.isPending}
                data-testid="button-add-watch"
              >
                <Plus className="w-[18px] h-[18px] text-primary-foreground" />
              </Button>
            </div>

            <ScrollArea className="h-full">
              <div className="space-y-2">
                {watchExpressions.length > 0 ? (
                  watchExpressions.map((expr, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg transition-colors"
                      data-testid={`watch-${index}`}
                    >
                      <span className="text-[15px] leading-[20px] font-mono text-foreground flex-1">
                        {expr}
                      </span>
                      <span className="text-[15px] leading-[20px] text-muted-foreground font-mono">
                        {isRunning && isPaused ? (
                          <span className="text-primary">"value"</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-accent"
                        onClick={() => deleteWatchMutation.mutate({ index })}
                        data-testid={`button-delete-watch-${index}`}
                      >
                        <Trash2 className="w-[18px] h-[18px] text-muted-foreground hover:text-primary" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={AlertCircle}
                    title="No watch expressions"
                    description="Add expressions to monitor during debugging"
                  />
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        {/* Call Stack Tab */}
        <TabsContent value="callstack" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {isRunning && isPaused && callStack.length > 0 ? (
                callStack.map((frame) => (
                  <div
                    key={frame.id}
                    className={cn(
                      "flex items-center gap-3 p-3 hover:bg-accent rounded-lg cursor-pointer transition-colors",
                      frame.isActive && "bg-muted"
                    )}
                    data-testid={`callstack-${frame.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] leading-[20px] font-mono text-foreground truncate">
                        {frame.name}
                      </div>
                      <div className="text-[13px] text-muted-foreground truncate">
                        {frame.file}:{frame.line}
                      </div>
                    </div>
                    {frame.isActive && (
                      <Badge className="bg-primary text-primary-foreground text-[11px] rounded-lg">
                        Current
                      </Badge>
                    )}
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={AlertCircle}
                  title={isRunning ? 'Not paused' : 'No active debug session'}
                  description={isRunning ? 'Pause execution to see the call stack' : 'Start debugging to see the call stack'}
                  actionLabel={!isRunning ? 'Start Debug' : undefined}
                  onAction={!isRunning ? () => startDebugMutation.mutate(undefined) : undefined}
                />
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
