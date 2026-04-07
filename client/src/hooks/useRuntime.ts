/**
 * Hook for managing project runtimes
 * This provides an interface to start, stop and monitor project runtimes
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export type RuntimeStatus = 'starting' | 'running' | 'stopped' | 'error' | 'unknown';

export interface RuntimeState {
  isRunning: boolean;
  status: RuntimeStatus;
  logs: string[];
  url?: string;
}

export interface RuntimeStartResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface RuntimeStopResult {
  success: boolean;
  error?: string;
}

export interface RuntimeLogs {
  logs: string[];
}

/**
 * Hook for managing project runtimes
 */
export function useRuntime(projectId: number) {
  const queryClient = useQueryClient();
  const queryKey = [`/api/projects/${projectId}/runtime`];
  const logsQueryKey = [`/api/projects/${projectId}/runtime/logs`];

  /**
   * Get runtime status
   */
  const { data: runtimeStatus, isLoading, error } = useQuery<RuntimeState>({
    queryKey,
    refetchInterval: (data) => {
      // Poll more frequently when starting, less often when running/stopped
      if (data?.status === 'starting') return 1000;
      if (data?.status === 'running') return 5000;
      return false; // Don't poll when stopped/error
    },
  });

  /**
   * Get runtime logs
   */
  const { data: runtimeLogs } = useQuery<RuntimeLogs>({
    queryKey: logsQueryKey,
    enabled: Boolean(runtimeStatus?.isRunning),
    refetchInterval: runtimeStatus?.isRunning ? 2000 : false,
  });

  /**
   * Start runtime
   */
  const startRuntime = useMutation<RuntimeStartResult, Error>({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/runtime/start`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  /**
   * Stop runtime
   */
  const stopRuntime = useMutation<RuntimeStopResult, Error>({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/runtime/stop`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  /**
   * Execute command in runtime
   */
  const executeCommand = useMutation<{ success: boolean; output: string }, Error, string>({
    mutationFn: async (command: string) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/runtime/execute`, { command });
      return await res.json();
    },
  });

  return {
    status: runtimeStatus?.status || 'unknown',
    isRunning: runtimeStatus?.isRunning || false, 
    url: runtimeStatus?.url,
    logs: [...(runtimeStatus?.logs || []), ...(runtimeLogs?.logs || [])],
    isLoading,
    error,
    startRuntime,
    stopRuntime,
    executeCommand,
  };
}