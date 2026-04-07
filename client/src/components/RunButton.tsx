import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square, Loader2 } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface RunButtonProps {
  projectId: string | number;
  language?: string;
  onRunning?: (running: boolean, executionId?: string) => void;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

interface PreviewStatus {
  previewUrl: string | null;
  status: 'running' | 'stopped' | 'starting' | 'error' | 'static' | 'no_runnable_files';
  runId?: string;
  frameworkType?: string;
}

interface RuntimeStatus {
  status: 'running' | 'stopped' | 'starting' | 'error';
  executionId?: string;
}

export function RunButton({ 
  projectId, 
  language, 
  onRunning, 
  className,
  variant = 'default',
  size = 'default'
}: RunButtonProps) {
  const [localExecutionId, setLocalExecutionId] = useState<string | undefined>();
  const { toast } = useToast();

  const { data: previewStatus, isError: previewQueryFailed } = useQuery<PreviewStatus>({
    queryKey: ['/api/preview/url', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/preview/url?projectId=${projectId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to get preview status');
      return response.json();
    },
    enabled: !!projectId,
    retry: 1,
    refetchInterval: (_data, _query) => {
      const data = _data;
      if (data?.status === 'starting') return 2000;
      if (data?.status === 'running') return 15000;
      return false;
    }
  });

  const previewStatusResolved = previewStatus !== undefined || previewQueryFailed;
  const usePreview = previewStatusResolved && !previewQueryFailed && previewStatus?.status !== 'no_runnable_files';
  const useRuntime = previewStatusResolved && (previewQueryFailed || previewStatus?.status === 'no_runnable_files');

  const { data: runtimeStatus } = useQuery<RuntimeStatus>({
    queryKey: ['/api/runtime', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/runtime/${projectId}`, {
        credentials: 'include'
      });
      if (!response.ok) return { status: 'stopped' } as RuntimeStatus;
      return response.json();
    },
    enabled: !!projectId && useRuntime,
    refetchInterval: (_data, _query) => {
      const data = _data;
      if (data?.status === 'starting') return 2000;
      if (data?.status === 'running') return 10000;
      return false;
    }
  });

  const currentStatus = usePreview ? previewStatus : runtimeStatus;
  const isRunning = currentStatus?.status === 'running' || (previewStatus?.status === 'static' && usePreview);
  const isStarting = currentStatus?.status === 'starting';

  useEffect(() => {
    if (!usePreview && runtimeStatus?.executionId && !localExecutionId) {
      setLocalExecutionId(runtimeStatus.executionId);
    }
  }, [usePreview, runtimeStatus?.executionId, localExecutionId]);

  useEffect(() => {
    if (usePreview && previewStatus?.runId && !localExecutionId) {
      setLocalExecutionId(previewStatus.runId);
    }
  }, [usePreview, previewStatus?.runId, localExecutionId]);

  useEffect(() => {
    const running = isRunning || isStarting;
    onRunning?.(running, localExecutionId);
  }, [isRunning, isStarting, localExecutionId]);

  const startMutation = useMutation({
    mutationFn: async () => {
      if (usePreview) {
        return apiRequest('POST', `/api/preview/projects/${projectId}/preview/start`, {});
      }
      return apiRequest('POST', `/api/runtime/start`, { projectId: String(projectId) });
    },
    onSuccess: async (data: Record<string, unknown> | undefined) => {
      const execId = (data?.executionId as string) || (data?.runId as string) || `exec-${Date.now()}`;
      setLocalExecutionId(execId);
      (window as any).__currentExecutionId = execId;
      onRunning?.(true, execId);

      if (usePreview) {
        await queryClient.invalidateQueries({ queryKey: ['/api/preview/url', projectId] });
      } else {
        await queryClient.invalidateQueries({ queryKey: ['/api/runtime', projectId] });
      }

      toast({
        title: 'Starting project',
        description: usePreview ? 'Building and starting your application...' : 'Running your script...',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to start',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      if (usePreview) {
        return apiRequest('POST', `/api/preview/projects/${projectId}/preview/stop`, {});
      }
      return apiRequest('POST', `/api/runtime/stop`, { projectId: String(projectId), executionId: localExecutionId });
    },
    onSuccess: async () => {
      setLocalExecutionId(undefined);
      delete (window as any).__currentExecutionId;
      onRunning?.(false, undefined);

      if (usePreview) {
        await queryClient.invalidateQueries({ queryKey: ['/api/preview/url', projectId] });
      } else {
        await queryClient.invalidateQueries({ queryKey: ['/api/runtime', projectId] });
      }

      toast({
        title: 'Stopped',
        description: 'Your project has been stopped.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to stop',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleClick = () => {
    if (isRunning || isStarting) {
      stopMutation.mutate(undefined);
    } else {
      startMutation.mutate(undefined);
    }
  };

  const isPending = startMutation.isPending || stopMutation.isPending;
  const isLoading = isPending || isStarting || !previewStatusResolved;

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      size={size}
      variant={(isRunning || isStarting) ? "destructive" : variant}
      className={cn("gap-2 font-medium", className)}
      data-testid={(isRunning || isStarting) ? "button-stop-runtime" : "button-run-runtime"}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="hidden sm:inline">
            {stopMutation.isPending ? 'Stopping...' : 'Starting...'}
          </span>
        </>
      ) : isRunning ? (
        <>
          <Square className="h-4 w-4" />
          <span className="hidden sm:inline">Stop</span>
        </>
      ) : (
        <>
          <Play className="h-4 w-4" />
          <span className="hidden sm:inline">Run</span>
        </>
      )}
    </Button>
  );
}
