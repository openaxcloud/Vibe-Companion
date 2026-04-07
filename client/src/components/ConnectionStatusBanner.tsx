import { useConnectionStatus } from '../hooks/use-connection-status';
import { AlertCircle, Wifi, WifiOff, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ConnectionStatusBanner() {
  const { 
    isOnline, 
    isReconnecting, 
    reconnectAttempt,
    backendHealthy, 
    wsConnected,
    forceReconnect 
  } = useConnectionStatus();

  if (isOnline && backendHealthy && wsConnected) {
    return null;
  }

  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        title: 'No internet connection',
        description: 'Check your network and try again.',
        variant: 'destructive' as const,
      };
    }
    
    if (isReconnecting) {
      return {
        icon: Loader2,
        title: 'Reconnecting...',
        description: reconnectAttempt > 0 ? `Attempt ${reconnectAttempt}` : 'Restoring connection',
        variant: 'warning' as const,
      };
    }
    
    if (!backendHealthy) {
      return {
        icon: AlertCircle,
        title: 'Service unavailable',
        description: 'Some features may not work. We\'re working on it.',
        variant: 'warning' as const,
      };
    }
    
    if (!wsConnected) {
      return {
        icon: Wifi,
        title: 'Real-time updates paused',
        description: 'Live collaboration features may be delayed.',
        variant: 'info' as const,
      };
    }

    return null;
  };

  const status = getStatusInfo();
  if (!status) return null;

  const { icon: Icon, title, description, variant } = status;

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="connection-status-banner"
      className={cn(
        'fixed top-0 left-0 right-0 z-[9999] px-4 py-2 flex items-center justify-between gap-4',
        'text-[13px] font-medium transition-all duration-300 ease-in-out',
        variant === 'destructive' && 'bg-destructive text-destructive-foreground',
        variant === 'warning' && 'bg-yellow-500/90 text-yellow-50 dark:bg-yellow-600/90',
        variant === 'info' && 'bg-blue-500/90 text-blue-50 dark:bg-blue-600/90'
      )}
    >
      <div className="flex items-center gap-3">
        <Icon 
          className={cn(
            'h-4 w-4 flex-shrink-0',
            isReconnecting && 'animate-spin'
          )} 
        />
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
          <span className="font-semibold">{title}</span>
          <span className="text-[11px] sm:text-[13px] opacity-90">{description}</span>
        </div>
      </div>
      
      {!isReconnecting && (
        <Button
          size="sm"
          variant="ghost"
          onClick={forceReconnect}
          className="text-current hover:bg-white/20 flex-shrink-0"
          data-testid="button-retry-connection"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
