// @ts-nocheck
/**
 * useRunnerWorkspace
 *
 * Hook pour le mode "Workspace live" de l'IDE.
 *
 * - Vérifie le statut du Runner via GET /api/runner/status
 * - Start: POST /api/workspaces/:projectId → { online, workspaceId, token, terminalWsUrl, previewUrl }
 * - Stop:  DELETE /api/workspaces/:projectId
 *
 * Si runner offline → isRunnerEnabled=false ou isOnline=false, UI affiche badge "Runner hors ligne"
 * sans crash.
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface RunnerStatusResponse {
  online: boolean;
  baseUrl: string | null;
  latencyMs?: number;
  workspaces?: number;
}

export interface WorkspaceSession {
  online: boolean;
  workspaceId?: string;
  runnerUrl?: string | null;
  token?: string;
  terminalWsUrl?: string | null;
  previewUrl?: string | null;
  reason?: string;
}

// ─── Hook ───────────────────────────────────────────────────────────────────
export function useRunnerWorkspace(projectId: string | number | undefined) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const pid = projectId ? String(projectId) : null;

  // 1. Runner status (pings /health — updated every 30s)
  const { data: runnerStatus, isLoading: isCheckingStatus } = useQuery<RunnerStatusResponse>({
    queryKey: ['/api/runner/status'],
    enabled: !!pid,
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });

  const isRunnerEnabled = runnerStatus?.online === true;

  // 2. Current workspace session for this project
  const {
    data: session,
    isLoading: isLoadingSession,
  } = useQuery<WorkspaceSession>({
    queryKey: ['/api/workspaces', pid],
    enabled: !!pid && isRunnerEnabled,
    refetchInterval: (_data, _query) => {
      const d = _data as WorkspaceSession | undefined;
      if (d?.online && !d.workspaceId) return 3_000;
      return false;
    },
    retry: false,
  });

  // 3. Start workspace
  const startMutation = useMutation<WorkspaceSession, Error>({
    mutationFn: async () => {
      return await apiRequest<WorkspaceSession>('POST', `/api/workspaces/${pid}`);
    },
    onSuccess: (data) => {
      qc.setQueryData(['/api/workspaces', pid], data);
      if (!data.online) {
        toast({
          title: 'Runner hors ligne',
          description: data.reason ?? 'Le service Runner est temporairement indisponible.',
          variant: 'destructive',
        });
      }
    },
    onError: (err) => {
      toast({
        title: 'Erreur workspace',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // 4. Stop workspace
  const stopMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<WorkspaceSession>('DELETE', `/api/workspaces/${pid}`);
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['/api/workspaces', pid] });
    },
  });

  // 5. Get fresh token for Runner access (terminal WS, files)
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!pid || !isRunnerEnabled) return null;
    try {
      const data = await apiRequest<{ token?: string }>('GET', `/api/runner/workspaces/${pid}/token`);
      return data.token ?? null;
    } catch {
      return null;
    }
  }, [pid, isRunnerEnabled]);

  const isActive = session?.online === true && !!session.workspaceId;
  const isStarting = startMutation.isPending;
  const isStopping = stopMutation.isPending;

  return {
    // Status
    isRunnerEnabled,
    isCheckingStatus,
    runnerStatus,

    // Session
    session,
    isLoadingSession,
    isActive,
    isStarting,
    isStopping,

    // Actions
    startWorkspace: () => startMutation.mutate(),
    stopWorkspace: () => stopMutation.mutate(),
    getAccessToken,
  };
}
