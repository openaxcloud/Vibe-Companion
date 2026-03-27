// @ts-nocheck
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Cpu, MemoryStick, HardDrive, Wifi, Activity, Zap, Clock,
  AlertTriangle, TrendingUp, TrendingDown, Minus, RefreshCw,
  Server, Database, Globe, Terminal, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';

interface ResourceMetrics {
  cpu: {
    usage: number;
    cores: number;
    temperature?: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  storage: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    latency: number;
  };
  processes: {
    name: string;
    pid: number;
    cpu: number;
    memory: number;
    status: 'running' | 'sleeping' | 'stopped';
  }[];
  uptime: number;
  timestamp: string;
}

interface ResourcesPanelProps {
  projectId: string;
  className?: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDuration = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const getUsageColor = (percentage: number): string => {
  if (percentage >= 90) return 'text-red-500';
  if (percentage >= 70) return 'text-yellow-500';
  return 'text-green-500';
};

const getUsageBarColor = (percentage: number): string => {
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 70) return 'bg-yellow-500';
  return 'bg-green-500';
};

const getTrendIcon = (current: number, previous: number) => {
  const diff = current - previous;
  if (diff > 5) return <TrendingUp className="h-3 w-3 text-red-500" />;
  if (diff < -5) return <TrendingDown className="h-3 w-3 text-green-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
};

export function ResourcesPanel({ projectId, className }: ResourcesPanelProps) {
  const [previousMetrics, setPreviousMetrics] = useState<ResourceMetrics | null>(null);

  const { data: metrics, isLoading, isError, refetch } = useQuery<ResourceMetrics>({
    queryKey: ['/api/resources', projectId],
    queryFn: async () => {
      return await apiRequest('GET', `/api/resources?projectId=${projectId}`);
    },
    enabled: !!projectId,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    retry: 2,
  });

  useEffect(() => {
    if (metrics && previousMetrics === null) {
      setPreviousMetrics(metrics);
    }
  }, [metrics, previousMetrics]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (metrics) {
        setPreviousMetrics(metrics);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [metrics]);

  const ResourceCard = ({ 
    icon: Icon, 
    title, 
    value, 
    percentage, 
    detail,
    trend
  }: { 
    icon: any; 
    title: string; 
    value: string; 
    percentage: number;
    detail?: string;
    trend?: number;
  }) => (
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded", getUsageColor(percentage).replace('text-', 'bg-').replace('500', '100'))}>
              <Icon className={cn("h-3.5 w-3.5", getUsageColor(percentage))} />
            </div>
            <span className="text-[11px] font-medium">{title}</span>
          </div>
          <div className="flex items-center gap-1">
            {trend !== undefined && previousMetrics && getTrendIcon(percentage, trend)}
            <span className={cn("text-[13px] font-bold", getUsageColor(percentage))}>
              {percentage.toFixed(1)}%
            </span>
          </div>
        </div>
        <Progress 
          value={percentage} 
          className={cn("h-1.5 mb-1", getUsageBarColor(percentage))}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{value}</span>
          {detail && <span>{detail}</span>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className={cn("h-full flex flex-col bg-[var(--ecode-surface)]", className)}>
      <div className="h-9 border-b border-[var(--ecode-border)] flex items-center justify-between px-2.5 bg-[var(--ecode-surface)]">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text-muted)]">Resources</span>
          {metrics && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
              <Clock className="h-2.5 w-2.5 mr-1" />
              {formatDuration(metrics.uptime)}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="h-6 w-6 p-0 text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {isLoading && !metrics ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : metrics ? (
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <ResourceCard
                icon={Cpu}
                title="CPU"
                value={`${metrics.cpu.cores} cores`}
                percentage={metrics.cpu.usage}
                trend={previousMetrics?.cpu.usage}
              />
              <ResourceCard
                icon={MemoryStick}
                title="Memory"
                value={formatBytes(metrics.memory.used)}
                percentage={metrics.memory.percentage}
                detail={`/ ${formatBytes(metrics.memory.total)}`}
                trend={previousMetrics?.memory.percentage}
              />
            </div>

            <ResourceCard
              icon={HardDrive}
              title="Storage"
              value={formatBytes(metrics.storage.used)}
              percentage={metrics.storage.percentage}
              detail={`/ ${formatBytes(metrics.storage.total)}`}
              trend={previousMetrics?.storage.percentage}
            />

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-medium">Network</span>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant={(metrics?.network?.latency || 0) < 50 ? "secondary" : "destructive"} className="text-[10px]">
                        {(metrics?.network?.latency || 0).toFixed(0)}ms
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-[11px]">Network latency</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-surface-tertiary-solid rounded text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingDown className="h-3 w-3 text-green-500" />
                    <span className="text-[10px] text-muted-foreground">IN</span>
                  </div>
                  <span className="text-[11px] font-medium">{formatBytes(metrics?.network?.bytesIn || 0)}</span>
                </div>
                <div className="p-2 bg-surface-tertiary-solid rounded text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp className="h-3 w-3 text-blue-500" />
                    <span className="text-[10px] text-muted-foreground">OUT</span>
                  </div>
                  <span className="text-[11px] font-medium">{formatBytes(metrics?.network?.bytesOut || 0)}</span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-medium">Processes</span>
                <Badge variant="outline" className="text-[10px]">
                  {(metrics?.processes || []).filter(p => p?.status === 'running').length} active
                </Badge>
              </div>
              <div className="space-y-1">
                {(metrics?.processes || []).map((process) => (
                  <div
                    key={process?.pid}
                    className="flex items-center justify-between p-2 bg-muted/30 rounded text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        process?.status === 'running' ? "bg-green-500" :
                        process?.status === 'sleeping' ? "bg-yellow-500" : "bg-red-500"
                      )} />
                      <span className="font-medium">{process?.name}</span>
                      <span className="text-muted-foreground">PID {process?.pid}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className={getUsageColor(process?.cpu || 0)}>
                        {(process?.cpu || 0).toFixed(1)}% CPU
                      </span>
                      <span>{formatBytes(process?.memory || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(metrics.cpu.usage > 80 || metrics.memory.percentage > 80) && (
              <>
                <Separator />
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                    <AlertTriangle className="h-4 w-4" />
                    <div>
                      <p className="text-[11px] font-medium">High Resource Usage</p>
                      <p className="text-[10px] opacity-80">
                        Consider upgrading your plan for better performance
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-48 p-4 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4 opacity-50" />
            <p className="text-[13px] font-medium mb-1">Failed to load resources</p>
            <p className="text-[11px] text-muted-foreground mb-3">
              Unable to connect to the resources API
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Retry
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 p-4 text-center">
            <Activity className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-[13px] font-medium mb-1">Resource monitoring unavailable</p>
            <p className="text-[11px] text-muted-foreground">
              Start your project to see resource usage
            </p>
          </div>
        )}
      </ScrollArea>

      {metrics && (
        <div className="p-2 border-t bg-muted/30">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}</span>
            <span>Auto-refresh: 30s</span>
          </div>
        </div>
      )}
    </div>
  );
}
