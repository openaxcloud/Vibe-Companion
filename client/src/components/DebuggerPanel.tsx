import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Bug, 
  Play, 
  Pause,
  Square,
  SkipForward,
  StepForward,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  Circle,
  X,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Info,
  Terminal,
  FileText,
  Variable,
  Layers
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation } from '@tanstack/react-query';

interface Breakpoint {
  id: string;
  file: string;
  line: number;
  enabled: boolean;
  condition?: string;
}

interface StackFrame {
  id: string;
  name: string;
  file: string;
  line: number;
  column: number;
}

interface Variable {
  name: string;
  value: any;
  type: string;
  expandable: boolean;
  children?: Variable[];
}

interface DebugSession {
  id: string;
  status: 'running' | 'paused' | 'stopped';
  currentFile?: string;
  currentLine?: number;
  stackFrames: StackFrame[];
  variables: Variable[];
  breakpoints: Breakpoint[];
}

export function DebuggerPanel({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [selectedFrame, setSelectedFrame] = useState<string>('');
  const [expandedVariables, setExpandedVariables] = useState<Set<string>>(new Set());
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);

  // Fetch debug session
  const { data: debugSession, refetch: refetchSession } = useQuery<DebugSession>({
    queryKey: [`/api/projects/${projectId}/debug/session`],
    enabled: !!projectId,
    refetchInterval: debugSession?.status === 'running' ? 1000 : false
  });

  // Start debugging
  const startDebugMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/debug/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to start debugging');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Debugging started",
        description: "Debug session is now active"
      });
      refetchSession();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start debugging",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Debug control mutations
  const debugControlMutation = useMutation({
    mutationFn: async (action: 'continue' | 'pause' | 'stop' | 'step_over' | 'step_into' | 'step_out') => {
      const response = await fetch(`/api/projects/${projectId}/debug/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error(`Failed to ${action}`);
      return response.json();
    },
    onSuccess: () => {
      refetchSession();
    }
  });

  // Toggle breakpoint
  const toggleBreakpointMutation = useMutation({
    mutationFn: async ({ file, line }: { file: string; line: number }) => {
      const response = await fetch(`/api/projects/${projectId}/debug/breakpoints/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file, line })
      });
      if (!response.ok) throw new Error('Failed to toggle breakpoint');
      return response.json();
    },
    onSuccess: () => {
      refetchSession();
    }
  });

  const toggleVariableExpansion = (varPath: string) => {
    const newExpanded = new Set(expandedVariables);
    if (newExpanded.has(varPath)) {
      newExpanded.delete(varPath);
    } else {
      newExpanded.add(varPath);
    }
    setExpandedVariables(newExpanded);
  };

  const renderVariable = (variable: Variable, path: string = '', depth: number = 0) => {
    const varPath = path ? `${path}.${variable.name}` : variable.name;
    const isExpanded = expandedVariables.has(varPath);

    return (
      <div key={varPath} style={{ paddingLeft: `${depth * 16}px` }}>
        <div
          className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded cursor-pointer"
          onClick={() => variable.expandable && toggleVariableExpansion(varPath)}
        >
          {variable.expandable && (
            isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
          )}
          {!variable.expandable && <div className="w-3" />}
          
          <span className="font-mono text-sm font-medium">{variable.name}</span>
          <span className="font-mono text-sm text-muted-foreground">:</span>
          <span className="font-mono text-sm truncate flex-1">
            {typeof variable.value === 'object' 
              ? variable.type 
              : String(variable.value)
            }
          </span>
          <Badge variant="outline" className="text-xs">{variable.type}</Badge>
        </div>
        
        {isExpanded && variable.children?.map(child => 
          renderVariable(child, varPath, depth + 1)
        )}
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b bg-muted/20 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            <div>
              <CardTitle className="text-lg">Debugger</CardTitle>
              <CardDescription>
                {debugSession?.status === 'running' 
                  ? 'Debug session active' 
                  : debugSession?.status === 'paused'
                  ? 'Paused at breakpoint'
                  : 'Debug when ready'
                }
              </CardDescription>
            </div>
          </div>
          
          {/* Debug Controls */}
          <div className="flex items-center gap-1">
            {!debugSession || debugSession.status === 'stopped' ? (
              <Button
                size="sm"
                variant="default"
                onClick={() => startDebugMutation.mutate()}
                disabled={startDebugMutation.isPending}
              >
                {startDebugMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Start
              </Button>
            ) : (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => debugControlMutation.mutate(
                    debugSession.status === 'running' ? 'pause' : 'continue'
                  )}
                  disabled={debugControlMutation.isPending}
                >
                  {debugSession.status === 'running' ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => debugControlMutation.mutate('stop')}
                  disabled={debugControlMutation.isPending}
                >
                  <Square className="h-4 w-4" />
                </Button>
                <Separator orientation="vertical" className="h-6 mx-1" />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => debugControlMutation.mutate('step_over')}
                  disabled={debugSession.status !== 'paused' || debugControlMutation.isPending}
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => debugControlMutation.mutate('step_into')}
                  disabled={debugSession.status !== 'paused' || debugControlMutation.isPending}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => debugControlMutation.mutate('step_out')}
                  disabled={debugSession.status !== 'paused' || debugControlMutation.isPending}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <div className="flex-1 flex">
        <Tabs defaultValue="variables" className="flex-1">
          <TabsList className="mx-4 mt-4">
            <TabsTrigger value="variables">Variables</TabsTrigger>
            <TabsTrigger value="stack">Call Stack</TabsTrigger>
            <TabsTrigger value="breakpoints">Breakpoints</TabsTrigger>
            <TabsTrigger value="console">Console</TabsTrigger>
          </TabsList>

          <TabsContent value="variables" className="flex-1 m-0">
            <ScrollArea className="h-[calc(100%-60px)]">
              <div className="p-4">
                {debugSession?.variables.length ? (
                  <div className="space-y-1">
                    {debugSession.variables.map(variable => renderVariable(variable))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Variable className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">No variables in scope</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="stack" className="flex-1 m-0">
            <ScrollArea className="h-[calc(100%-60px)]">
              <div className="p-4">
                {debugSession?.stackFrames.length ? (
                  <div className="space-y-1">
                    {debugSession.stackFrames.map((frame, index) => (
                      <button
                        key={frame.id}
                        onClick={() => setSelectedFrame(frame.id)}
                        className={`w-full text-left p-3 rounded-md transition-colors ${
                          selectedFrame === frame.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{frame.name}</span>
                          <Badge variant="outline" className="text-xs">
                            Frame {index}
                          </Badge>
                        </div>
                        <p className="text-xs mt-1 opacity-80">
                          {frame.file}:{frame.line}:{frame.column}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Layers className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">No stack frames</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="breakpoints" className="flex-1 m-0">
            <ScrollArea className="h-[calc(100%-60px)]">
              <div className="p-4">
                {debugSession?.breakpoints.length ? (
                  <div className="space-y-2">
                    {debugSession.breakpoints.map((bp) => (
                      <div
                        key={bp.id}
                        className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleBreakpointMutation.mutate({ 
                              file: bp.file, 
                              line: bp.line 
                            })}
                            className={`h-3 w-3 rounded-full border-2 ${
                              bp.enabled 
                                ? 'bg-red-500 border-red-500' 
                                : 'border-muted-foreground'
                            }`}
                          />
                          <div>
                            <p className="text-sm font-medium">{bp.file}:{bp.line}</p>
                            {bp.condition && (
                              <p className="text-xs text-muted-foreground">
                                Condition: {bp.condition}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => toggleBreakpointMutation.mutate({ 
                            file: bp.file, 
                            line: bp.line 
                          })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Circle className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">No breakpoints set</p>
                    <p className="text-xs mt-1">Click on line numbers to add breakpoints</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="console" className="flex-1 m-0">
            <ScrollArea className="h-[calc(100%-60px)]">
              <div className="p-4 font-mono text-sm space-y-1">
                {consoleOutput.length > 0 ? (
                  consoleOutput.map((line, index) => (
                    <div key={index} className="py-1">
                      {line}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Terminal className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm font-sans">Console output will appear here</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}