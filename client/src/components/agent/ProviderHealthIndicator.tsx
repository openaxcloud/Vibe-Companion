import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CheckCircle, XCircle, AlertTriangle, Activity, Zap, Cpu, Sparkles } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export interface ProviderHealth {
  available: boolean;
  failures: number;
}

export interface OrchestratorHealth {
  success: boolean;
  providers: Record<string, ProviderHealth>;
  tiers: {
    fast: { threshold: number; description: string };
    balanced: { threshold: number; description: string };
    quality: { threshold: number; description: string };
  };
  globalStats: {
    totalTasks: number;
    successRate: number;
    uniqueTaskTypes: number;
    bufferSize: number;
  };
}

interface ProviderHealthIndicatorProps {
  className?: string;
  compact?: boolean;
}

const PROVIDER_DISPLAY: Record<string, { name: string; color: string }> = {
  openai: { name: 'OpenAI', color: 'text-emerald-600 dark:text-emerald-400' },
  anthropic: { name: 'Anthropic', color: 'text-orange-600 dark:text-orange-400' },
  google: { name: 'Google', color: 'text-blue-600 dark:text-blue-400' },
  xai: { name: 'xAI', color: 'text-gray-600 dark:text-gray-400' },
  moonshot: { name: 'Moonshot', color: 'text-indigo-600 dark:text-indigo-400' }
};

function getHealthIcon(available: boolean, failures: number) {
  if (!available) {
    return <XCircle className="h-3 w-3 text-red-500" />;
  }
  if (failures > 0) {
    return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
  }
  return <CheckCircle className="h-3 w-3 text-green-500" />;
}

export function ProviderHealthIndicator({ className, compact = false }: ProviderHealthIndicatorProps) {
  const { data, isLoading, error } = useQuery<OrchestratorHealth>({
    queryKey: ['/api/autonomy/orchestrator/health'],
    queryFn: async () => {
      const response = await apiRequest<OrchestratorHealth>('GET', '/api/autonomy/orchestrator/health');
      return response;
    },
    refetchInterval: 30000,
    staleTime: 15000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <Badge variant="outline" className={cn("gap-1 animate-pulse", className)} data-testid="badge-provider-loading">
        <Activity className="h-3 w-3" />
        <span className="text-[11px]">...</span>
      </Badge>
    );
  }

  if (error || !data?.providers) {
    if (compact) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className={cn("gap-1 bg-gray-100 text-gray-500 dark:bg-gray-800", className)}
                data-testid="badge-provider-unavailable"
              >
                <AlertTriangle className="h-3 w-3" />
                <span className="text-[11px]">N/A</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Provider health data unavailable</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return (
      <div className={cn("rounded-lg border bg-muted/50 p-3", className)} data-testid="panel-provider-error">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <span>Provider health data unavailable</span>
        </div>
      </div>
    );
  }

  const availableCount = Object.values(data.providers).filter(p => p.available).length;
  const totalCount = Object.keys(data.providers).length;
  const allHealthy = availableCount === totalCount;
  const someUnavailable = availableCount < totalCount;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline"
              className={cn(
                "gap-1 cursor-help",
                allHealthy ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                someUnavailable ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                className
              )}
              data-testid="badge-provider-health"
            >
              <Activity className="h-3 w-3" />
              {availableCount}/{totalCount}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="w-64" data-testid="tooltip-provider-health">
            <div className="space-y-2">
              <p className="font-medium flex items-center gap-1">
                <Activity className="h-4 w-4" />
                AI Provider Health
              </p>
              <div className="space-y-1">
                {Object.entries(data.providers).map(([provider, health]) => (
                  <div key={provider} className="flex items-center justify-between text-[11px]">
                    <span className={PROVIDER_DISPLAY[provider]?.color}>
                      {PROVIDER_DISPLAY[provider]?.name || provider}
                    </span>
                    <div className="flex items-center gap-1">
                      {getHealthIcon(health.available, health.failures)}
                      {health.failures > 0 && (
                        <span className="text-muted-foreground">
                          ({health.failures} errors)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {data.globalStats.totalTasks > 0 && (
                <div className="pt-2 border-t text-[11px] text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Tasks executed:</span>
                    <span>{data.globalStats.totalTasks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Success rate:</span>
                    <span>{(data.globalStats.successRate * 100).toFixed(1)}%</span>
                  </div>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-card p-3 space-y-3", className)} data-testid="panel-provider-health">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          AI Provider Health
        </h4>
        <Badge 
          variant="outline"
          className={cn(
            "text-[11px]",
            allHealthy ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
            "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
          )}
        >
          {availableCount}/{totalCount} available
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {Object.entries(data.providers).map(([provider, health]) => (
          <div 
            key={provider}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-md border",
              health.available ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" :
              "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
            )}
            data-testid={`provider-${provider}`}
          >
            {getHealthIcon(health.available, health.failures)}
            <span className={cn("text-[11px] font-medium", PROVIDER_DISPLAY[provider]?.color)}>
              {PROVIDER_DISPLAY[provider]?.name || provider}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-green-500" />
          <span className="text-muted-foreground">Fast</span>
          <span className="ml-auto">{"<"}3</span>
        </div>
        <div className="flex items-center gap-1">
          <Cpu className="h-3 w-3 text-blue-500" />
          <span className="text-muted-foreground">Balanced</span>
          <span className="ml-auto">3-7</span>
        </div>
        <div className="flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-purple-500" />
          <span className="text-muted-foreground">Quality</span>
          <span className="ml-auto">{">"}7</span>
        </div>
      </div>

      {data.globalStats.totalTasks > 0 && (
        <div className="pt-2 border-t grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          <div className="flex justify-between">
            <span>Total tasks:</span>
            <span className="font-medium text-foreground">{data.globalStats.totalTasks}</span>
          </div>
          <div className="flex justify-between">
            <span>Accuracy:</span>
            <span className={cn(
              "font-medium",
              data.globalStats.successRate >= 0.9 ? "text-green-600" :
              data.globalStats.successRate >= 0.7 ? "text-yellow-600" : "text-red-600"
            )}>
              {(data.globalStats.successRate * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span>Task types:</span>
            <span className="font-medium text-foreground">
              {data.globalStats.uniqueTaskTypes}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Buffer size:</span>
            <span className="font-medium text-foreground">
              {data.globalStats.bufferSize.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProviderHealthBadge({ className }: { className?: string }) {
  return <ProviderHealthIndicator compact className={className} />;
}
