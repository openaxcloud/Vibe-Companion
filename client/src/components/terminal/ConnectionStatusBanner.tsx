/**
 * Fortune 500-Grade Terminal Connection Status Banner
 * Shows reconnection state with countdown and retry options
 */

import { memo, useCallback } from 'react';
import { 
  Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle2, Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectionState } from '@/lib/websocket-resilience';
import { useRetryCountdown } from '@/hooks/use-resilient-websocket';
import { Button } from '@/components/ui/button';

interface ConnectionStatusBannerProps {
  state: ConnectionState;
  reconnectAttempt: number;
  maxAttempts: number;
  nextRetryMs: number | null;
  error: string | null;
  latency: number | null;
  onForceReconnect: () => void;
  className?: string;
}

export const ConnectionStatusBanner = memo(function ConnectionStatusBanner({
  state,
  reconnectAttempt,
  maxAttempts,
  nextRetryMs,
  error,
  latency,
  onForceReconnect,
  className,
}: ConnectionStatusBannerProps) {
  const countdown = useRetryCountdown(nextRetryMs);

  const handleRetry = useCallback(() => {
    onForceReconnect();
  }, [onForceReconnect]);

  // Don't show banner when connected (unless showing latency briefly)
  if (state === 'connected') {
    return null;
  }

  const getStatusConfig = () => {
    switch (state) {
      case 'connecting':
        return {
          icon: Loader2,
          iconClass: 'animate-spin text-blue-500',
          bgClass: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
          title: 'Connecting...',
          description: 'Establishing connection to terminal',
        };
      
      case 'reconnecting':
        return {
          icon: RefreshCw,
          iconClass: 'animate-spin text-amber-500',
          bgClass: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
          title: `Reconnecting (${reconnectAttempt}/${maxAttempts})`,
          description: countdown > 0 
            ? `Next attempt in ${countdown}s...` 
            : 'Attempting to reconnect...',
        };
      
      case 'disconnected':
        return {
          icon: WifiOff,
          iconClass: 'text-gray-500',
          bgClass: 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700',
          title: 'Disconnected',
          description: error || 'Connection closed',
        };
      
      case 'failed':
        return {
          icon: AlertTriangle,
          iconClass: 'text-red-500',
          bgClass: 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800',
          title: 'Connection Failed',
          description: error || 'Unable to connect after multiple attempts',
        };
      
      case 'circuit_open':
        return {
          icon: AlertTriangle,
          iconClass: 'text-orange-500',
          bgClass: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800',
          title: 'Connection Paused',
          description: countdown > 0 
            ? `Cooling down - retry in ${countdown}s` 
            : 'Too many failures, waiting before retry',
        };
      
      default:
        return {
          icon: Wifi,
          iconClass: 'text-gray-500',
          bgClass: 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700',
          title: 'Unknown State',
          description: 'Connection status unknown',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const showRetryButton = state === 'failed' || state === 'disconnected' || state === 'circuit_open';

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-3 py-2',
        'border-b text-[13px]',
        'animate-in slide-in-from-top duration-200',
        config.bgClass,
        className
      )}
      role="status"
      aria-live="polite"
      data-testid="terminal-connection-status"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={cn('h-4 w-4 flex-shrink-0', config.iconClass)} />
        <div className="min-w-0">
          <span className="font-medium text-gray-900 dark:text-white">
            {config.title}
          </span>
          <span className="text-gray-500 dark:text-gray-400 ml-2 text-[11px]">
            {config.description}
          </span>
        </div>
      </div>

      {showRetryButton && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          className="flex-shrink-0 h-7 px-3 text-[11px]"
          data-testid="button-retry-connection"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry Now
        </Button>
      )}

      {state === 'reconnecting' && countdown > 0 && (
        <div className="flex-shrink-0 flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="font-mono">{countdown}s</span>
          <button
            onClick={handleRetry}
            className="text-blue-600 dark:text-blue-400 hover:underline"
            data-testid="button-retry-now"
          >
            retry now
          </button>
        </div>
      )}
    </div>
  );
});

/**
 * Compact inline connection indicator for mobile
 */
export const ConnectionIndicator = memo(function ConnectionIndicator({
  state,
  latency,
  className,
}: {
  state: ConnectionState;
  latency: number | null;
  className?: string;
}) {
  const getIndicatorConfig = () => {
    switch (state) {
      case 'connected':
        return {
          color: 'bg-green-500',
          pulse: false,
          label: latency ? `${latency}ms` : 'Connected',
        };
      case 'connecting':
      case 'reconnecting':
        return {
          color: 'bg-amber-500',
          pulse: true,
          label: 'Reconnecting...',
        };
      case 'disconnected':
      case 'failed':
      case 'circuit_open':
        return {
          color: 'bg-red-500',
          pulse: false,
          label: 'Disconnected',
        };
      default:
        return {
          color: 'bg-gray-500',
          pulse: false,
          label: 'Unknown',
        };
    }
  };

  const config = getIndicatorConfig();

  return (
    <div 
      className={cn('flex items-center gap-1.5', className)}
      title={config.label}
    >
      <span 
        className={cn(
          'w-2 h-2 rounded-full',
          config.color,
          config.pulse && 'animate-pulse'
        )}
      />
      <span className="text-[11px] text-gray-500 dark:text-gray-400 hidden sm:inline">
        {config.label}
      </span>
    </div>
  );
});
