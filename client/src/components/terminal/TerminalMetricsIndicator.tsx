import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Activity, AlertTriangle, CheckCircle2, XCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { useTerminalHealth, useTerminalMetrics } from '@/hooks/use-terminal-metrics';
import { cn } from '@/lib/utils';

interface TerminalMetricsIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  showDetailed?: boolean;
  compact?: boolean;
}

export function TerminalMetricsIndicator({
  className,
  showDetailed = false,
  compact = false,
  ...rest
}: TerminalMetricsIndicatorProps) {
  const { data: healthData, isLoading: healthLoading } = useTerminalHealth({
    refetchInterval: 30000, // RATE LIMIT FIX: Increased from 10s to 30s (hook sets refetchIntervalInBackground: false internally)
  });
  
  const { data: metricsData, isLoading: metricsLoading } = useTerminalMetrics({
    enabled: showDetailed,
    refetchInterval: 30000, // RATE LIMIT FIX: Increased from 5s to 30s (hook sets refetchIntervalInBackground: false internally)
  });

  if (healthLoading && !healthData) {
    return null;
  }

  const health = healthData?.status || 'unknown';
  const utilizationPercent = healthData?.metrics?.utilizationPercent || 0;
  const activeSessions = healthData?.metrics?.activeSessions || 0;
  const maxSessions = healthData?.metrics?.maxSessions || 100;

  // Determine health status icon and color
  const getHealthIcon = () => {
    switch (health) {
      case 'healthy':
        return <CheckCircle2 className="h-3 w-3" data-testid="icon-health-healthy" />;
      case 'degraded':
        return <AlertTriangle className="h-3 w-3" data-testid="icon-health-degraded" />;
      case 'unhealthy':
        return <XCircle className="h-3 w-3" data-testid="icon-health-unhealthy" />;
      default:
        return <Activity className="h-3 w-3" data-testid="icon-health-unknown" />;
    }
  };

  const getHealthColor = () => {
    switch (health) {
      case 'healthy':
        return 'bg-surface-solid text-green-600 dark:text-green-400 border-border';
      case 'degraded':
        return 'bg-surface-solid text-yellow-600 dark:text-yellow-400 border-border';
      case 'unhealthy':
        return 'bg-surface-solid text-red-600 dark:text-red-400 border-border';
      default:
        return 'bg-surface-solid text-gray-600 dark:text-gray-400 border-border';
    }
  };

  const getCapacityColor = () => {
    if (utilizationPercent < 50) return 'text-green-600 dark:text-green-400';
    if (utilizationPercent < 80) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'inline-flex items-center gap-1.5 text-[11px] font-medium cursor-help rounded-md border px-2.5 py-0.5 transition-colors',
                getHealthColor(),
                className
              )}
              {...rest}
            >
              {getHealthIcon()}
              <span className={getCapacityColor()} data-testid="text-capacity">
                {activeSessions}/{maxSessions}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] text-muted-foreground">Terminal Health:</span>
                <span className="text-[11px] font-medium capitalize">{health}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] text-muted-foreground">Active Sessions:</span>
                <span className="text-[11px] font-medium">{activeSessions} / {maxSessions}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] text-muted-foreground">Capacity Used:</span>
                <span className="text-[11px] font-medium">{utilizationPercent.toFixed(1)}%</span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Detailed view
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 bg-card',
        className
      )}
      {...rest}
    >
      {/* Health Status */}
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn('flex items-center gap-1.5', getHealthColor())}
          data-testid="badge-health-status"
        >
          {getHealthIcon()}
          <span className="capitalize text-[11px]">{health}</span>
        </Badge>
      </div>

      {/* Capacity */}
      <div className="flex items-center gap-2 text-[13px]">
        <Activity className="h-4 w-4 text-muted-foreground" data-testid="icon-activity" />
        <span className="text-muted-foreground">Capacity:</span>
        <span className={cn('font-medium', getCapacityColor())} data-testid="text-capacity-detailed">
          {activeSessions}/{maxSessions}
        </span>
        <span className="text-muted-foreground text-[11px]">
          ({utilizationPercent.toFixed(1)}%)
        </span>
      </div>

      {/* Backpressure indicator */}
      {metricsData?.metrics?.health?.underBackpressure && (
        <Badge
          variant="outline"
          className="flex items-center gap-1.5 bg-surface-solid text-orange-600 dark:text-orange-400 border-border"
          data-testid="badge-backpressure"
        >
          <TrendingUp className="h-3 w-3" />
          <span className="text-[11px]">High Load</span>
        </Badge>
      )}

      {/* Session metrics (if available) */}
      {showDetailed && metricsData?.metrics?.sessions && metricsData.metrics.sessions.length > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground ml-auto">
          <TrendingDown className="h-3 w-3" />
          <span data-testid="text-sessions-count">
            {metricsData.metrics.sessions.length} active sessions
          </span>
        </div>
      )}
    </div>
  );
}
