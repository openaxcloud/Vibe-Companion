import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Zap,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Maximize2,
  Minimize2,
  Settings,
  Info
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Line, Area } from 'recharts';
import { LineChart, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

interface ResourceMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    cores: number;
    processes: number;
    temperature?: number;
  };
  memory: {
    used: number;
    total: number;
    available: number;
    cached: number;
  };
  disk: {
    used: number;
    total: number;
    readSpeed: number;
    writeSpeed: number;
  };
  network: {
    download: number;
    upload: number;
    latency: number;
    packetLoss: number;
  };
}

interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  status: 'running' | 'sleeping' | 'stopped';
}

interface ResourceMonitorProps {
  projectId: number;
  className?: string;
}

export function ReplitResourceMonitor({ projectId, className }: ResourceMonitorProps) {
  const [timeRange, setTimeRange] = useState<'1m' | '5m' | '15m' | '1h'>('5m');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  // Fetch current metrics
  const { data: currentMetrics } = useQuery<ResourceMetrics>({
    queryKey: [`/api/monitoring/${projectId}/current`],
    refetchInterval: autoRefresh ? 5000 : false
  });

  // Fetch historical metrics
  const { data: historicalMetrics = [] } = useQuery<ResourceMetrics[]>({
    queryKey: [`/api/monitoring/${projectId}/history`, timeRange],
    refetchInterval: autoRefresh ? 30000 : false
  });

  // Fetch running processes
  const { data: processes = [] } = useQuery<ProcessInfo[]>({
    queryKey: [`/api/monitoring/${projectId}/processes`],
    refetchInterval: autoRefresh ? 10000 : false
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-500';
    if (percentage >= 70) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getUsageBg = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500/10';
    if (percentage >= 70) return 'bg-yellow-500/10';
    return 'bg-green-500/10';
  };

  const cpuUsage = currentMetrics?.cpu.usage || 0;
  const memoryUsage = currentMetrics ? (currentMetrics.memory.used / currentMetrics.memory.total) * 100 : 0;
  const diskUsage = currentMetrics ? (currentMetrics.disk.used / currentMetrics.disk.total) * 100 : 0;

  return (
    <TooltipProvider>
      <Card className={cn("h-full flex flex-col", className, isFullscreen && "fixed inset-0 z-50")}>
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Resource Monitor
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={autoRefresh ? "default" : "secondary"}>
                {autoRefresh ? "Live" : "Paused"}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshCw className={cn("h-4 w-4", autoRefresh && "animate-spin")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className={cn("p-4 rounded-lg border", getUsageBg(cpuUsage))}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  <span className="text-[13px] font-medium">CPU</span>
                </div>
                <span className={cn("text-2xl font-bold", getUsageColor(cpuUsage))}>
                  {cpuUsage.toFixed(1)}%
                </span>
              </div>
              <Progress value={cpuUsage} className="h-2" />
              <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                <span>{currentMetrics?.cpu.cores} cores</span>
                <span>{currentMetrics?.cpu.processes} processes</span>
              </div>
            </div>

            <div className={cn("p-4 rounded-lg border", getUsageBg(memoryUsage))}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MemoryStick className="h-4 w-4" />
                  <span className="text-[13px] font-medium">Memory</span>
                </div>
                <span className={cn("text-2xl font-bold", getUsageColor(memoryUsage))}>
                  {memoryUsage.toFixed(1)}%
                </span>
              </div>
              <Progress value={memoryUsage} className="h-2" />
              <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                <span>{formatBytes(currentMetrics?.memory.used || 0)}</span>
                <span>{formatBytes(currentMetrics?.memory.total || 0)}</span>
              </div>
            </div>

            <div className={cn("p-4 rounded-lg border", getUsageBg(diskUsage))}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  <span className="text-[13px] font-medium">Disk</span>
                </div>
                <span className={cn("text-2xl font-bold", getUsageColor(diskUsage))}>
                  {diskUsage.toFixed(1)}%
                </span>
              </div>
              <Progress value={diskUsage} className="h-2" />
              <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                <span>{formatBytes(currentMetrics?.disk.used || 0)}</span>
                <span>{formatBytes(currentMetrics?.disk.total || 0)}</span>
              </div>
            </div>

            <div className="p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  <span className="text-[13px] font-medium">Network</span>
                </div>
                <Zap className="h-4 w-4 text-green-500" />
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">↓ Download</span>
                  <span>{formatSpeed(currentMetrics?.network.download || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">↑ Upload</span>
                  <span>{formatSpeed(currentMetrics?.network.upload || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Latency</span>
                  <span>{currentMetrics?.network.latency || 0}ms</span>
                </div>
              </div>
            </div>
          </div>

          <Tabs defaultValue="graphs" className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="graphs">Graphs</TabsTrigger>
                <TabsTrigger value="processes">
                  Processes
                  <Badge variant="secondary" className="ml-2">
                    {processes.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="alerts">Alerts</TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                {['1m', '5m', '15m', '1h'].map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimeRange(range as any)}
                  >
                    {range}
                  </Button>
                ))}
              </div>
            </div>

            <TabsContent value="graphs" className="flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                {/* CPU Chart */}
                <div className="border rounded-lg p-4">
                  <h3 className="text-[13px] font-medium mb-4 flex items-center gap-2">
                    <Cpu className="h-4 w-4" />
                    CPU Usage
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={historicalMetrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(time) => new Date(time).toLocaleTimeString()}
                      />
                      <YAxis domain={[0, 100]} />
                      <RechartsTooltip />
                      <Area 
                        type="monotone" 
                        dataKey="cpu.usage" 
                        stroke="#3b82f6" 
                        fill="#3b82f6" 
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Memory Chart */}
                <div className="border rounded-lg p-4">
                  <h3 className="text-[13px] font-medium mb-4 flex items-center gap-2">
                    <MemoryStick className="h-4 w-4" />
                    Memory Usage
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={historicalMetrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(time) => new Date(time).toLocaleTimeString()}
                      />
                      <YAxis tickFormatter={(value) => formatBytes(value)} />
                      <RechartsTooltip formatter={(value: number) => formatBytes(value)} />
                      <Area 
                        type="monotone" 
                        dataKey="memory.used" 
                        stroke="#10b981" 
                        fill="#10b981" 
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Network Chart */}
                <div className="border rounded-lg p-4">
                  <h3 className="text-[13px] font-medium mb-4 flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    Network I/O
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={historicalMetrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(time) => new Date(time).toLocaleTimeString()}
                      />
                      <YAxis tickFormatter={(value) => formatSpeed(value)} />
                      <RechartsTooltip formatter={(value: number) => formatSpeed(value)} />
                      <Line 
                        type="monotone" 
                        dataKey="network.download" 
                        stroke="#10b981" 
                        name="Download"
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="network.upload" 
                        stroke="#ef4444" 
                        name="Upload"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Disk I/O Chart */}
                <div className="border rounded-lg p-4">
                  <h3 className="text-[13px] font-medium mb-4 flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    Disk I/O
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={historicalMetrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(time) => new Date(time).toLocaleTimeString()}
                      />
                      <YAxis tickFormatter={(value) => formatSpeed(value)} />
                      <RechartsTooltip formatter={(value: number) => formatSpeed(value)} />
                      <Line 
                        type="monotone" 
                        dataKey="disk.readSpeed" 
                        stroke="#3b82f6" 
                        name="Read"
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="disk.writeSpeed" 
                        stroke="#f59e0b" 
                        name="Write"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="processes" className="flex-1">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {processes
                    .sort((a, b) => b.cpu - a.cpu)
                    .map((process) => (
                      <div
                        key={process.pid}
                        className="flex items-center justify-between p-3 rounded-md border hover:bg-muted"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={process.status === 'running' ? 'default' : 'secondary'}
                            className="w-16 justify-center"
                          >
                            {process.status}
                          </Badge>
                          <div>
                            <p className="font-medium">{process.name}</p>
                            <p className="text-[13px] text-muted-foreground">PID: {process.pid}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={cn("text-[13px] font-medium", getUsageColor(process.cpu))}>
                              {process.cpu.toFixed(1)}% CPU
                            </p>
                            <p className="text-[13px] text-muted-foreground">
                              {formatBytes(process.memory)} RAM
                            </p>
                          </div>
                          <Button variant="ghost" size="icon">
                            <Info className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="alerts" className="flex-1">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {cpuUsage >= 80 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        High CPU usage detected ({cpuUsage.toFixed(1)}%). Consider optimizing your code or upgrading resources.
                      </AlertDescription>
                    </Alert>
                  )}
                  {memoryUsage >= 80 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        High memory usage detected ({memoryUsage.toFixed(1)}%). Consider optimizing memory usage or upgrading resources.
                      </AlertDescription>
                    </Alert>
                  )}
                  {diskUsage >= 90 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Critical disk usage ({diskUsage.toFixed(1)}%). Clean up unnecessary files or upgrade storage immediately.
                      </AlertDescription>
                    </Alert>
                  )}
                  {currentMetrics && currentMetrics.network.packetLoss > 1 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Network packet loss detected ({currentMetrics.network.packetLoss}%). Check your network connection.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}