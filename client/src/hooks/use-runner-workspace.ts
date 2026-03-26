import { useState, useEffect, useCallback, useRef } from 'react';

interface RunnerWorkspace {
  id: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped';
  previewUrl?: string;
}

interface UseRunnerWorkspaceReturn {
  isRunnerEnabled: boolean;
  isActive: boolean;
  isStarting: boolean;
  isStopping: boolean;
  startWorkspace: () => void;
  stopWorkspace: () => void;
  workspace: RunnerWorkspace | null;
}

export function useRunnerWorkspace(projectId: string): UseRunnerWorkspaceReturn {
  const [isRunnerEnabled, setIsRunnerEnabled] = useState(false);
  const [workspace, setWorkspace] = useState<RunnerWorkspace | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/workspaces/${projectId}/status`, { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.status === 'running') {
          setIsRunnerEnabled(true);
          setWorkspace({
            id: data.workspaceId || projectId,
            status: 'running',
            previewUrl: data.previewUrl,
          });
        } else if (data.status === 'none' || data.status === 'stopped') {
          setIsRunnerEnabled(false);
        }
      } catch {
        setIsRunnerEnabled(false);
      }
    })();
    return () => { cancelled = true; mountedRef.current = false; };
  }, [projectId]);

  const startWorkspace = useCallback(async () => {
    setIsStarting(true);
    try {
      const res = await fetch(`/api/workspaces/${projectId}/start`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok && mountedRef.current) {
        const data = await res.json();
        setWorkspace({
          id: data.workspaceId || projectId,
          status: 'running',
          previewUrl: data.previewUrl,
        });
        setIsRunnerEnabled(true);
      }
    } catch {} finally {
      if (mountedRef.current) setIsStarting(false);
    }
  }, [projectId]);

  const stopWorkspace = useCallback(async () => {
    setIsStopping(true);
    try {
      await fetch(`/api/workspaces/${projectId}/stop`, {
        method: 'POST',
        credentials: 'include',
      });
      if (mountedRef.current) {
        setWorkspace(null);
        setIsRunnerEnabled(false);
      }
    } catch {} finally {
      if (mountedRef.current) setIsStopping(false);
    }
  }, [projectId]);

  return {
    isRunnerEnabled,
    isActive: workspace?.status === 'running',
    isStarting,
    isStopping,
    startWorkspace,
    stopWorkspace,
    workspace,
  };
}
