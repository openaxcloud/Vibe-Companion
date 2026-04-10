import { useState, useEffect, useCallback, useRef } from 'react';
import { useConnectionStatus } from './use-connection-status';

interface ServiceHealthState {
  api: HealthStatus;
  websocket: HealthStatus;
  ai: HealthStatus;
  database: HealthStatus;
  overall: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: Date | null;
  latencyMs: number | null;
  error?: string;
}

interface UseServiceHealthOptions {
  checkInterval?: number;
  enabled?: boolean;
}

const DEFAULT_CHECK_INTERVAL = 30000;
const MAX_BACKOFF_MULTIPLIER = 4;

const createDefaultHealth = (): HealthStatus => ({
  status: 'unknown',
  lastCheck: null,
  latencyMs: null,
});

export function useServiceHealth(options: UseServiceHealthOptions = {}) {
  const { checkInterval = DEFAULT_CHECK_INTERVAL, enabled = true } = options;
  const connectionStatus = useConnectionStatus();
  const isOnline = connectionStatus.isOnline;
  const backendHealthy = connectionStatus.backendHealthy;
  const wsConnected = connectionStatus.wsConnected;
  
  const [health, setHealth] = useState<ServiceHealthState>({
    api: createDefaultHealth(),
    websocket: createDefaultHealth(),
    ai: createDefaultHealth(),
    database: createDefaultHealth(),
    overall: 'unknown',
  });

  const [isChecking, setIsChecking] = useState(false);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const consecutiveFailuresRef = useRef(0);
  const currentIntervalRef = useRef(checkInterval);

  const checkEndpoint = useCallback(async (
    url: string, 
    timeoutMs = 5000
  ): Promise<HealthStatus> => {
    const start = performance.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      
      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - start);
      
      if (!response.ok) {
        return {
          status: response.status >= 500 ? 'unhealthy' : 'degraded',
          lastCheck: new Date(),
          latencyMs,
          error: `HTTP ${response.status}`,
        };
      }

      return {
        status: latencyMs > 2000 ? 'degraded' : 'healthy',
        lastCheck: new Date(),
        latencyMs,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        latencyMs: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, []);

  const calculateOverallHealth = useCallback((services: ServiceHealthState): ServiceHealthState['overall'] => {
    const statuses = [services.api.status, services.websocket.status];
    
    if (statuses.every(s => s === 'healthy')) return 'healthy';
    if (statuses.some(s => s === 'unhealthy')) return 'unhealthy';
    if (statuses.some(s => s === 'degraded')) return 'degraded';
    return 'unknown';
  }, []);

  const checkAllServices = useCallback(async () => {
    if (!isOnline || isChecking) return;
    
    setIsChecking(true);
    
    try {
      const [apiHealth, aiHealth] = await Promise.all([
        checkEndpoint('/api/health/liveness'),
        checkEndpoint('/api/ai/health'),
      ]);

      const hasFailures = apiHealth.status === 'unhealthy' || aiHealth.status === 'unhealthy';
      
      if (hasFailures) {
        consecutiveFailuresRef.current = Math.min(
          consecutiveFailuresRef.current + 1,
          MAX_BACKOFF_MULTIPLIER
        );
        currentIntervalRef.current = checkInterval * Math.pow(2, consecutiveFailuresRef.current - 1);
      } else {
        consecutiveFailuresRef.current = 0;
        currentIntervalRef.current = checkInterval;
      }

      const wsHealth: HealthStatus = {
        status: wsConnected ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        latencyMs: null,
      };

      const dbHealth: HealthStatus = backendHealthy 
        ? { status: 'healthy', lastCheck: new Date(), latencyMs: null }
        : { status: 'unhealthy', lastCheck: new Date(), latencyMs: null, error: 'Backend unreachable' };

      setHealth(() => {
        const newState: ServiceHealthState = {
          api: apiHealth,
          websocket: wsHealth,
          ai: aiHealth,
          database: dbHealth,
          overall: 'unknown',
        };
        newState.overall = calculateOverallHealth(newState);
        return newState;
      });
    } finally {
      setIsChecking(false);
    }
  }, [isOnline, isChecking, wsConnected, backendHealthy, checkEndpoint, calculateOverallHealth, checkInterval]);

  const refreshHealth = useCallback(() => {
    checkAllServices();
  }, [checkAllServices]);

  useEffect(() => {
    if (!enabled || !isOnline) return;

    checkAllServices();

    const scheduleNextCheck = () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
      checkTimeoutRef.current = setTimeout(() => {
        checkAllServices();
        scheduleNextCheck();
      }, currentIntervalRef.current);
    };

    scheduleNextCheck();

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [enabled, isOnline, checkAllServices]);

  useEffect(() => {
    setHealth(prev => ({
      ...prev,
      websocket: {
        status: wsConnected ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        latencyMs: null,
      },
    }));
  }, [wsConnected]);

  return {
    ...health,
    isChecking,
    refreshHealth,
  };
}

export function useServiceHealthBadge() {
  const { overall } = useServiceHealth({ checkInterval: 60000 });
  
  const getBadgeProps = useCallback(() => {
    switch (overall) {
      case 'healthy':
        return { color: 'green', label: 'All systems operational', icon: '✓' };
      case 'degraded':
        return { color: 'yellow', label: 'Partial outage', icon: '!' };
      case 'unhealthy':
        return { color: 'red', label: 'Service disruption', icon: '✕' };
      default:
        return { color: 'gray', label: 'Checking status...', icon: '?' };
    }
  }, [overall]);

  return { overall, getBadgeProps };
}
