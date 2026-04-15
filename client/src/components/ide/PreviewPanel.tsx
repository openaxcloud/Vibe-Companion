import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, RefreshCw, ExternalLink, Play, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { SplashScreenSequence } from './SplashScreenSequence';

export type AutonomousBuildPhase = 'planning' | 'scaffolding' | 'building' | 'styling' | 'finalizing' | 'complete' | null;

interface PreviewPanelProps {
  projectId: string;
  isRunning?: boolean;
  autoStart?: boolean;
  autonomousBuildPhase?: AutonomousBuildPhase;
  autonomousBuildProgress?: number;
  autonomousBuildTask?: string;
  appName?: string;
}

interface PreviewStatus {
  previewUrl: string | null;
  status: 'running' | 'stopped' | 'starting' | 'error' | 'static' | 'no_runnable_files';
  message?: string;
  runId?: string;
  ports?: number[];
  primaryPort?: number;
  services?: Array<{ port: number; name: string; path?: string }>;
  frameworkType?: string;
}

export function PreviewPanel({ 
  projectId, 
  isRunning: externalIsRunning, 
  autoStart = true,
  autonomousBuildPhase,
  autonomousBuildProgress,
  autonomousBuildTask,
  appName
}: PreviewPanelProps) {
  const { toast } = useToast();
  const hasAttemptedAutoStart = useRef(false);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const prevBuildPhaseRef = useRef(autonomousBuildPhase);

  useEffect(() => {
    if (autonomousBuildPhase && autonomousBuildPhase !== 'complete' && prevBuildPhaseRef.current !== autonomousBuildPhase) {
      setSplashDismissed(false);
    }
    prevBuildPhaseRef.current = autonomousBuildPhase;
  }, [autonomousBuildPhase]);

  // Query preview status
  const { data: previewStatus, isLoading: isStatusLoading, refetch: refetchStatus } = useQuery<PreviewStatus>({
    queryKey: ['/api/preview/url', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/preview/url?projectId=${projectId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to get preview status');
      }
      return response.json();
    },
    enabled: !!projectId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'starting') return 2000;
      if (data?.status === 'running') return 10000;
      if (data?.status === 'no_runnable_files') return 5000;
      if (data?.status === 'stopped') return 3000;
      return false;
    }
  });

  // Start preview mutation — calls the preview service which auto-detects framework and spawns the server
  const startPreviewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/preview/projects/${projectId}/preview/start`, {});
    },
    onSuccess: () => {
      toast({ title: 'Preview starting...', description: 'Your app is being built and started.' });
      setTimeout(() => refetchStatus(), 2000);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to start preview', 
        description: error.message || 'An error occurred',
        variant: 'destructive'
      });
    }
  });

  // Stop preview mutation
  const stopPreviewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/preview/projects/${projectId}/preview/stop`, {});
    },
    onSuccess: () => {
      toast({ title: 'Preview stopped' });
      refetchStatus();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to stop preview', 
        description: error.message || 'An error occurred',
        variant: 'destructive'
      });
    }
  });

  // Auto-start: when a project has server-side files (status='stopped') automatically
  // boot the runtime so the preview appears without the user needing to click Run —
  // the same always-on experience as Replit.
  useEffect(() => {
    if (
      autoStart &&
      previewStatus?.status === 'stopped' &&
      !hasAttemptedAutoStart.current &&
      projectId
    ) {
      hasAttemptedAutoStart.current = true;
      startPreviewMutation.mutate(undefined);
    }
  }, [previewStatus?.status, projectId, autoStart]);

  useEffect(() => {
    const handler = () => {
      setTimeout(() => {
        refetchStatus();
        const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
        if (iframe && previewStatus?.previewUrl) {
          const url = new URL(previewStatus.previewUrl, window.location.origin);
          url.searchParams.set('_t', Date.now().toString());
          iframe.src = url.toString();
        }
      }, 3000);
    };
    window.addEventListener('ecode:preview-refresh', handler);
    return () => window.removeEventListener('ecode:preview-refresh', handler);
  }, [refetchStatus, previewStatus?.previewUrl]);

  const handleRefresh = useCallback(() => {
    const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
    if (iframe && previewStatus?.previewUrl) {
      const url = new URL(previewStatus.previewUrl, window.location.origin);
      url.searchParams.set('_t', Date.now().toString());
      iframe.src = url.toString();
    }
    refetchStatus();
  }, [previewStatus?.previewUrl, refetchStatus]);

  const handleOpenInNewTab = useCallback(() => {
    if (previewStatus?.previewUrl) {
      // For relative URLs, construct full URL
      const url = previewStatus.previewUrl.startsWith('http') 
        ? previewStatus.previewUrl 
        : `${window.location.origin}${previewStatus.previewUrl}`;
      window.open(url, '_blank');
    }
  }, [previewStatus?.previewUrl]);

  const handleStartPreview = useCallback(() => {
    startPreviewMutation.mutate(undefined);
  }, [startPreviewMutation]);

  const handleStopPreview = useCallback(() => {
    stopPreviewMutation.mutate(undefined);
  }, [stopPreviewMutation]);

  const isPreviewRunning = previewStatus?.status === 'running' || previewStatus?.status === 'static';
  const isPreviewStarting = previewStatus?.status === 'starting' || startPreviewMutation.isPending;

  useEffect(() => {
    if (isPreviewStarting) {
      setSplashDismissed(false);
    }
  }, [isPreviewStarting]);
  const canShowPreview = isPreviewRunning && previewStatus?.previewUrl;
  // ✅ FIX (Dec 1, 2025): Use mutation.isPending for loading state instead of local timeout
  const isRefreshing = startPreviewMutation.isPending || stopPreviewMutation.isPending;

  // Get display URL for the toolbar
  const displayUrl = previewStatus?.previewUrl 
    ? (previewStatus.previewUrl.startsWith('http') 
        ? previewStatus.previewUrl 
        : `${window.location.origin}${previewStatus.previewUrl}`)
    : '';

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar */}
      <div className="h-9 border-b border-[var(--ecode-border)] flex items-center justify-between px-2.5 gap-2 bg-[var(--ecode-surface)]">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Globe className="h-3.5 w-3.5 shrink-0 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">Preview</span>
          {isPreviewRunning && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-[hsl(142,72%,42%)]/10 text-[hsl(142,72%,42%)] border-[hsl(142,72%,42%)]/20">
              Running
            </Badge>
          )}
          {isPreviewStarting && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
              Starting...
            </Badge>
          )}
          {previewStatus?.frameworkType && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {previewStatus.frameworkType}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-0.5">
          {/* Start/Stop buttons */}
          {!isPreviewRunning && !isPreviewStarting && previewStatus?.status !== 'no_runnable_files' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStartPreview}
              disabled={startPreviewMutation.isPending}
              data-testid="button-start-preview"
              className="h-7 px-2 gap-1 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            >
              <Play className="h-3.5 w-3.5" />
              <span className="text-[10px]">Run</span>
            </Button>
          )}
          
          {(isPreviewRunning || isPreviewStarting) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStopPreview}
              disabled={stopPreviewMutation.isPending}
              data-testid="button-stop-preview"
              className="h-7 px-2 gap-1 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            >
              <Square className="h-3.5 w-3.5" />
              <span className="text-[10px]">Stop</span>
            </Button>
          )}
          
          {canShowPreview && (
            <>
              <div className="text-[10px] text-[var(--ecode-text-muted)] truncate max-w-[120px] hidden sm:block">
                {displayUrl}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                data-testid="button-refresh-preview"
                className="h-7 w-7 p-0 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenInNewTab}
                data-testid="button-open-preview"
                className="h-7 w-7 p-0 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* Preview Content */}
      <div className="flex-1 relative bg-background dark:bg-background">
        {/* Autonomous build splash screen - shows during AI-driven builds */}
        {(autonomousBuildPhase && !splashDismissed) ? (
          <SplashScreenSequence
            isComplete={autonomousBuildPhase === 'complete'}
            onComplete={() => setSplashDismissed(true)}
            currentTask={autonomousBuildTask}
            progress={autonomousBuildProgress}
            appName={appName}
          />
        ) : isStatusLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (isPreviewStarting && !splashDismissed) ? (
          <SplashScreenSequence
            appName={appName}
            onComplete={() => setSplashDismissed(true)}
          />
        ) : previewStatus?.status === 'no_runnable_files' ? (
          <div className="h-full flex items-center justify-center text-center p-8">
            <div>
              <Globe className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-[15px] font-semibold mb-2">No preview available</h3>
              <p className="text-[13px] text-muted-foreground">
                Add an HTML file or package.json to preview your project.
              </p>
            </div>
          </div>
        ) : !isPreviewRunning ? (
          <div className="h-full flex items-center justify-center text-center p-8">
            <div>
              <Globe className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-[15px] font-semibold mb-2">Preview not running</h3>
              <p className="text-[13px] text-muted-foreground mb-4">
                Click the Run button to start your project and see a live preview.
              </p>
              <Button onClick={handleStartPreview} disabled={startPreviewMutation.isPending}>
                <Play className="h-4 w-4 mr-2" />
                Start Preview
              </Button>
            </div>
          </div>
        ) : previewStatus?.previewUrl ? (
          <iframe
            id="preview-iframe"
            src={previewStatus.previewUrl}
            className="w-full h-full border-0"
            title="Project Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"
            data-testid="iframe-preview"
          />
        ) : (
          <div className="h-full flex items-center justify-center text-center p-8">
            <div>
              <Loader2 className="h-16 w-16 mx-auto mb-4 animate-spin text-primary" />
              <h3 className="text-[15px] font-semibold mb-2">Loading preview...</h3>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
