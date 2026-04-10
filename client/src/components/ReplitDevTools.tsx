import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bug, Play, Square, Pause, SkipForward, StepForward,
  RotateCcw, Target, Layers, Monitor, Cpu, 
  MemoryStick, Gauge, Activity, AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Breakpoint {
  id: string;
  file: string;
  line: number;
  column?: number;
  condition?: string;
  enabled: boolean;
}

interface DebugSession {
  id: string;
  status: 'running' | 'paused' | 'stopped';
  currentLine?: number;
  currentFile?: string;
  callStack: Array<{
    function: string;
    file: string;
    line: number;
  }>;
  variables: Record<string, any>;
}

interface PerformanceMetrics {
  cpu: number;
  memory: {
    used: number;
    total: number;
  };
  heap: {
    used: number;
    total: number;
  };
  eventLoop: {
    delay: number;
    utilization: number;
  };
}

interface ReplitDevToolsProps {
  projectId: number;
}

export function ReplitDevTools({ projectId }: ReplitDevToolsProps) {
  const { toast } = useToast();
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [debugSession, setDebugSession] = useState<DebugSession | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    cpu: 0,
    memory: { used: 0, total: 0 },
    heap: { used: 0, total: 0 },
    eventLoop: { delay: 0, utilization: 0 }
  });
  const [isDebugging, setIsDebugging] = useState(false);
  const [isProfiler, setIsProfiler] = useState(false);
  const metricsIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    fetchBreakpoints();
    startMetricsCollection();
    
    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, [projectId]);

  const fetchBreakpoints = async () => {
    try {
      const response = await fetch(`/api/debug/${projectId}/breakpoints`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setBreakpoints(data.breakpoints || []);
      }
    } catch (error) {
      console.error('Error fetching breakpoints:', error);
    }
  };

  const startMetricsCollection = () => {
    metricsIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/metrics/${projectId}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setMetrics(data.metrics);
        }
      } catch (error) {
        console.error('Error fetching metrics:', error);
      }
    }, 1000);
  };

  const startDebugSession = async () => {
    try {
      const response = await apiRequest('POST', `/api/debug/${projectId}/start`, {});

      if (response.ok) {
        const data = await response.json();
        setDebugSession(data.session);
        setIsDebugging(true);
        toast({
          title: "Debug Session Started",
          description: "Debugger is now attached to your application"
        });
      }
    } catch (error) {
      toast({
        title: "Debug Error",
        description: "Failed to start debug session",
        variant: "destructive"
      });
    }
  };

  const stopDebugSession = async () => {
    try {
      const response = await apiRequest('POST', `/api/debug/${projectId}/stop`, {});

      if (response.ok) {
        setDebugSession(null);
        setIsDebugging(false);
        toast({
          title: "Debug Session Stopped",
          description: "Debugger has been detached"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to stop debug session",
        variant: "destructive"
      });
    }
  };

  const addBreakpoint = async (file: string, line: number) => {
    try {
      const response = await apiRequest('POST', `/api/debug/${projectId}/breakpoints`, { file, line });

      if (response.ok) {
        fetchBreakpoints();
        toast({
          title: "Breakpoint Added",
          description: `Breakpoint set at ${file}:${line}`
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add breakpoint",
        variant: "destructive"
      });
    }
  };

  const removeBreakpoint = async (breakpointId: string) => {
    try {
      const response = await apiRequest('DELETE', `/api/debug/${projectId}/breakpoints/${breakpointId}`, {});

      if (response.ok) {
        fetchBreakpoints();
        toast({
          title: "Breakpoint Removed",
          description: "Breakpoint has been deleted"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove breakpoint",
        variant: "destructive"
      });
    }
  };

  const debugAction = async (action: 'continue' | 'step' | 'stepinto' | 'stepout') => {
    try {
      const response = await apiRequest('POST', `/api/debug/${projectId}/${action}`, {});

      if (response.ok) {
        const data = await response.json();
        setDebugSession(data.session);
      }
    } catch (error) {
      toast({
        title: "Debug Error",
        description: `Failed to execute ${action}`,
        variant: "destructive"
      });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getMetricColor = (percentage: number) => {
    if (percentage < 50) return 'text-green-600';
    if (percentage < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="debugger" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="debugger">Debugger</TabsTrigger>
          <TabsTrigger value="profiler">Profiler</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="console">Console</TabsTrigger>
        </TabsList>

        <TabsContent value="debugger" className="space-y-4">
          {/* Debug Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Debug Session
              </CardTitle>
              <CardDescription>
                Control debugging session and execution flow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                {!isDebugging ? (
                  <Button onClick={startDebugSession}>
                    <Play className="h-4 w-4 mr-2" />
                    Start Debugging
                  </Button>
                ) : (
                  <>
                    <Button onClick={stopDebugSession} variant="destructive">
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                    </Button>
                    
                    <Button 
                      onClick={() => debugAction('continue')}
                      disabled={debugSession?.status !== 'paused'}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Continue
                    </Button>
                    
                    <Button 
                      onClick={() => debugAction('step')}
                      disabled={debugSession?.status !== 'paused'}
                    >
                      <StepForward className="h-4 w-4 mr-2" />
                      Step Over
                    </Button>
                    
                    <Button 
                      onClick={() => debugAction('stepinto')}
                      disabled={debugSession?.status !== 'paused'}
                    >
                      <SkipForward className="h-4 w-4 mr-2" />
                      Step Into
                    </Button>
                    
                    <Button 
                      onClick={() => debugAction('stepout')}
                      disabled={debugSession?.status !== 'paused'}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Step Out
                    </Button>
                  </>
                )}
              </div>
              
              {debugSession && (
                <div className="flex items-center gap-2">
                  <Badge 
                    className={
                      debugSession.status === 'running' 
                        ? 'text-green-600 bg-green-50 border-green-200'
                        : debugSession.status === 'paused'
                        ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
                        : 'text-gray-600 bg-gray-50 border-gray-200'
                    }
                  >
                    {debugSession.status.toUpperCase()}
                  </Badge>
                  
                  {debugSession.currentFile && (
                    <span className="text-[13px] text-muted-foreground">
                      {debugSession.currentFile}:{debugSession.currentLine}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Breakpoints */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Breakpoints ({breakpoints.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {breakpoints.length === 0 ? (
                <p className="text-[13px] text-muted-foreground text-center py-4">
                  No breakpoints set. Click in the gutter next to line numbers to add breakpoints.
                </p>
              ) : (
                <div className="space-y-2">
                  {breakpoints.map((bp) => (
                    <div key={bp.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${bp.enabled ? 'bg-red-500' : 'bg-gray-400'}`} />
                        <span className="font-mono text-[13px]">{bp.file}:{bp.line}</span>
                        {bp.condition && (
                          <Badge variant="outline" className="text-[11px]">
                            {bp.condition}
                          </Badge>
                        )}
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeBreakpoint(bp.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Call Stack & Variables */}
          {debugSession && debugSession.status === 'paused' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Call Stack
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {debugSession.callStack.map((frame, index) => (
                      <div key={index} className="p-2 border rounded font-mono text-[13px]">
                        <div className="font-medium">{frame.function}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {frame.file}:{frame.line}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Variables</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {Object.entries(debugSession.variables).map(([name, value]) => (
                      <div key={name} className="flex justify-between p-2 border rounded">
                        <span className="font-mono text-[13px] font-medium">{name}</span>
                        <span className="font-mono text-[13px] text-muted-foreground">
                          {JSON.stringify(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="profiler" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                CPU Profiler
              </CardTitle>
              <CardDescription>
                Profile your application's performance and identify bottlenecks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Button 
                  onClick={() => setIsProfiler(!isProfiler)}
                  variant={isProfiler ? "destructive" : "default"}
                >
                  {isProfiler ? (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      Stop Profiling
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start Profiling
                    </>
                  )}
                </Button>
                
                <Button variant="outline">
                  <Monitor className="h-4 w-4 mr-2" />
                  Take Heap Snapshot
                </Button>
              </div>
              
              {isProfiler && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-yellow-600 animate-pulse" />
                    <span className="text-[13px] text-yellow-800">
                      Profiling in progress... Performance data is being collected.
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {/* Real-time Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-[13px] text-muted-foreground">CPU Usage</p>
                    <p className={`text-2xl font-bold ${getMetricColor(metrics.cpu)}`}>
                      {metrics.cpu.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <MemoryStick className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-[13px] text-muted-foreground">Memory</p>
                    <p className="text-2xl font-bold">
                      {formatBytes(metrics.memory.used)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      of {formatBytes(metrics.memory.total)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-[13px] text-muted-foreground">Heap</p>
                    <p className="text-2xl font-bold">
                      {formatBytes(metrics.heap.used)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      of {formatBytes(metrics.heap.total)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-[13px] text-muted-foreground">Event Loop</p>
                    <p className="text-2xl font-bold">
                      {metrics.eventLoop.delay.toFixed(1)}ms
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {metrics.eventLoop.utilization.toFixed(1)}% utilized
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Warnings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Performance Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics.cpu > 80 && (
                  <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-[13px] text-red-800">
                      High CPU usage detected. Consider optimizing computationally intensive operations.
                    </span>
                  </div>
                )}
                
                {(metrics.memory.used / metrics.memory.total) > 0.8 && (
                  <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="text-[13px] text-yellow-800">
                      Memory usage is high. Check for memory leaks or consider optimizing data structures.
                    </span>
                  </div>
                )}
                
                {metrics.eventLoop.delay > 50 && (
                  <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span className="text-[13px] text-orange-800">
                      Event loop delay is high. This may cause slow response times.
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="console" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Developer Console</CardTitle>
              <CardDescription>
                Interactive console for debugging and testing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-[13px] h-64 overflow-y-auto">
                  <div>E-Code Developer Console</div>
                  <div>Type commands to interact with your application</div>
                  <div className="mt-2">
                    {'>'} console.log('Hello from E-Code!')
                  </div>
                  <div>Hello from E-Code!</div>
                  <div>{'>'} <span className="animate-pulse">_</span></div>
                </div>
                
                <div className="flex gap-2">
                  <Input 
                    placeholder="Enter JavaScript commands..."
                    className="font-mono"
                  />
                  <Button>Execute</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}