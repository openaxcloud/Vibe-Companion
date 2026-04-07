import { useQuery } from '@tanstack/react-query';

export interface TerminalCapacity {
  current: number;
  maximum: number;
  utilizationPercent: number;
  available: number;
}

export interface TerminalHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  underBackpressure: boolean;
  message: string;
}

export interface TerminalSessionMetrics {
  sessionId: string;
  commandsExecuted: number;
  commandsQueued: number;
  commandsFailed: number;
  age: number;
}

export interface TerminalMetrics {
  capacity: TerminalCapacity;
  health: TerminalHealth;
  sessions: TerminalSessionMetrics[];
}

export interface TerminalMetricsResponse {
  success: boolean;
  timestamp: string;
  metrics: TerminalMetrics;
}

export interface TerminalHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  timestamp: string;
  metrics: {
    activeSessions: number;
    maxSessions: number;
    utilizationPercent: number;
  };
}

/**
 * Hook to fetch real-time terminal metrics from Fortune 500 infrastructure
 * Provides capacity, health status, and per-session metrics
 */
export function useTerminalMetrics(options?: {
  enabled?: boolean;
  refetchInterval?: number;
}) {
  const { enabled = true, refetchInterval = 5000 } = options || {};

  return useQuery<TerminalMetricsResponse>({
    queryKey: ['/api/terminal/metrics'],
    enabled,
    refetchInterval,
    refetchIntervalInBackground: false,
    staleTime: 3000,
  });
}

/**
 * Hook to fetch terminal health status
 * Lightweight endpoint for quick health checks
 */
export function useTerminalHealth(options?: {
  enabled?: boolean;
  refetchInterval?: number;
}) {
  const { enabled = true, refetchInterval = 10000 } = options || {};

  return useQuery<TerminalHealthResponse>({
    queryKey: ['/api/terminal/health'],
    enabled,
    refetchInterval,
    refetchIntervalInBackground: false,
    staleTime: 5000,
  });
}
