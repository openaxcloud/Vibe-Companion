import { useState, useRef, useEffect } from 'react';
import { 
  Monitor, ExternalLink, 
  ChevronLeft, ChevronRight, ArrowRight,
  Globe, MoreVertical, Play, Loader2,
  Layers, RotateCcw, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface MobilePreviewPanelProps {
  projectId: string | number;
  previewUrl?: string;
  className?: string;
  onBack?: () => void;
  onClose?: () => void;
  onOverlayMode?: () => void;
  isOverlay?: boolean;
}

interface PreviewStatus {
  previewUrl: string | null;
  status: 'running' | 'stopped' | 'starting' | 'error' | 'static' | 'no_runnable_files';
  message?: string;
}

function NotRunningState({ onRun, isStarting, noRunnableFiles }: { onRun: () => void; isStarting: boolean; noRunnableFiles?: boolean }) {
  return (
    <div 
      className="flex flex-col items-center justify-center h-full bg-background"
      data-testid="mobile-preview-not-running"
    >
      <div className="flex flex-col items-center gap-4 px-8 py-12">
        <div className="w-16 h-16 rounded-2xl border-2 border-border flex items-center justify-center">
          <Monitor className="w-8 h-8 text-muted-foreground" />
        </div>

        <div className="text-center space-y-1">
          <h3 
            className="text-[17px] font-semibold text-foreground leading-tight"
            data-testid="text-not-running-title"
          >
            {noRunnableFiles ? 'App ready to run' : 'Your app is not running'}
          </h3>
          <p 
            className="text-[14px] text-muted-foreground leading-snug"
            data-testid="text-not-running-description"
          >
            {noRunnableFiles 
              ? 'Press Run to start your app and see it live.'
              : 'Run to preview your app.'}
          </p>
        </div>

        <Button
          onClick={onRun}
          disabled={isStarting}
          className="h-12 px-8 text-[15px] font-semibold rounded-xl gap-2"
          data-testid="button-run-app"
        >
          {isStarting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          {isStarting ? 'Starting...' : 'Run'}
        </Button>
      </div>
    </div>
  );
}

export function MobilePreviewPanel({ 
  projectId, 
  previewUrl: externalPreviewUrl,
  className,
  onBack,
  onClose,
  onOverlayMode,
  isOverlay = false,
}: MobilePreviewPanelProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [currentPath, setCurrentPath] = useState('/');
  const [isLoading, setIsLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasAttemptedAutoStart = useRef(false);
  const { toast } = useToast();
  const { data: previewStatus, isLoading: isStatusLoading, refetch: refetchStatus } = useQuery<PreviewStatus>({
    queryKey: ['/api/preview/url', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/preview/url?projectId=${projectId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to get preview status');
      return response.json();
    },
    enabled: !!projectId,
    refetchInterval: (_data, _query) => {
      const data = _data;
      if (data?.status === 'starting') return 2000;
      if (data?.status === 'running') return 10000;
      if (data?.status === 'no_runnable_files') return 5000;
      if (data?.status === 'stopped') return 3000;
      return false;
    }
  });

  const startPreviewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/preview/projects/${projectId}/preview/start`, {});
    },
    onSuccess: () => {
      setTimeout(() => refetchStatus(), 2000);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to start', 
        description: error.message || 'An error occurred',
        variant: 'destructive'
      });
    }
  });

  const republishMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/deployments/projects/${projectId}/deploy`, {});
    },
    onSuccess: () => {
      toast({ title: 'Republishing...', description: 'Your app is being republished.' });
    },
    onError: () => {
      toast({ title: 'Republish failed', variant: 'destructive' });
    }
  });

  // Auto-start runtime when project opens — mirrors Replit's always-on behavior.
  // Only fires for 'stopped' projects (ones that have server-side files but no running server).
  // HTML-only projects already show as 'static' so they never reach this.
  useEffect(() => {
    if (
      previewStatus?.status === 'stopped' &&
      !hasAttemptedAutoStart.current &&
      projectId
    ) {
      hasAttemptedAutoStart.current = true;
      startPreviewMutation.mutate(undefined);
    }
  }, [previewStatus?.status, projectId]);

  const isPreviewRunning = previewStatus?.status === 'running' || previewStatus?.status === 'static';
  const isPreviewStarting = previewStatus?.status === 'starting' || startPreviewMutation.isPending;
  const noRunnableFiles = previewStatus?.status === 'no_runnable_files';
  const baseUrl = externalPreviewUrl || previewStatus?.previewUrl || `/api/preview/render/${projectId}`;
  const computedPreviewUrl = baseUrl + (currentPath === '/' ? '' : currentPath);

  const handleRefresh = () => {
    setIsLoading(true);
    setIframeKey(prev => prev + 1);
  };

  const handleNavigateBack = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.history.back();
    }
  };

  const handleNavigateForward = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.history.forward();
    }
  };

  const handleOpenExternal = () => {
    window.open(computedPreviewUrl, '_blank');
  };

  const handleRun = () => {
    startPreviewMutation.mutate(undefined);
  };

  const handleRepublish = () => {
    republishMutation.mutate(undefined);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    try {
      const iframe = iframeRef.current;
      if (iframe?.contentWindow?.location?.pathname) {
        setCurrentPath(iframe.contentWindow.location.pathname);
      }
    } catch {
    }
  };

  const displayPath = currentPath || '/';

  /* ── OVERLAY / SPLIT-VIEW MODE ── compact header only */
  if (isOverlay) {
    return (
      <div className={cn('flex flex-col h-full bg-background', className)} data-testid="mobile-preview-overlay-panel">
        {/* Compact overlay header */}
        <div className="flex-shrink-0 flex items-center justify-between h-10 px-3 bg-background border-b border-border">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-muted-foreground" />
            <span className="text-[13px] font-semibold text-foreground">Preview</span>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={onClose}
              data-testid="mobile-preview-overlay-close"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Iframe content */}
        <div className="flex-1 relative bg-background overflow-hidden">
          {isStatusLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : isPreviewRunning || isPreviewStarting ? (
            <iframe
              ref={iframeRef}
              key={iframeKey}
              src={computedPreviewUrl}
              className="w-full h-full border-0 bg-background"
              onLoad={handleIframeLoad}
              onError={() => setIsLoading(false)}
              title="App Preview"
              sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
              data-testid="mobile-preview-overlay-iframe"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
              <Monitor className="w-6 h-6 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground text-center">
                {noRunnableFiles ? 'App ready to run' : 'App not running'}
              </p>
              <Button size="sm" className="h-7 text-[11px]" onClick={handleRun}>
                <Play className="w-3 h-3 mr-1 fill-current" />
                Run
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── FULL PREVIEW TAB ── */
  return (
    <div 
      className={cn('flex flex-col h-full bg-background', className)}
      data-testid="mobile-preview-panel"
    >
      {/* ── TOP BAR ── Close | Republish | 🖥 Preview | Layers | ⋮ */}
      <div 
        className="flex-shrink-0 flex items-center h-[52px] px-2 bg-background border-b border-border"
        data-testid="mobile-preview-top-bar"
      >
        {/* Close / back button — always shown, no outer header needed */}
        <Button
          variant="ghost"
          size="icon"
          className="w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0"
          onClick={onClose ?? onBack}
          data-testid="mobile-preview-close"
        >
          <X className="w-5 h-5" />
        </Button>

        {/* Republish button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-3 rounded-xl gap-1.5 text-[13px] font-medium text-primary hover:bg-muted flex-shrink-0"
          onClick={handleRepublish}
          disabled={republishMutation.isPending}
          data-testid="mobile-preview-republish"
        >
          {republishMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Globe className="w-4 h-4 text-primary" />
          )}
          <span>Republish</span>
        </Button>

        {/* Preview title — centered */}
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          <Monitor className="w-[18px] h-[18px] text-muted-foreground flex-shrink-0" />
          <span className="text-[15px] font-semibold text-foreground leading-none">Preview</span>
        </div>

        {/* Overlay / split-view icon — switches to chat + floating preview */}
        <Button
          variant="ghost"
          size="icon"
          className="w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0"
          onClick={onOverlayMode}
          data-testid="mobile-preview-overlay-mode"
        >
          <Layers className="w-5 h-5" />
        </Button>

        {/* Three dots menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0"
              data-testid="mobile-preview-menu"
            >
              <MoreVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleRepublish}>
              <Globe className="w-4 h-4 mr-2" />
              Republish
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              navigator.clipboard.writeText(computedPreviewUrl);
              toast({ title: 'Link copied', description: 'Development link copied to clipboard' });
            }}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Share dev link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOpenExternal}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in browser
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onClose ?? onBack}
              className="text-destructive focus:text-destructive"
            >
              <X className="w-4 h-4 mr-2" />
              Close the tab
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── URL BAR ── ← → ↻ | URL path | Open in browser */}
      <div 
        className="flex-shrink-0 flex items-center gap-1 px-2 py-2 bg-background border-b border-border"
        data-testid="mobile-preview-url-bar"
      >
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0"
          onClick={handleNavigateBack}
          data-testid="mobile-preview-nav-back"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0"
          onClick={handleNavigateForward}
          data-testid="mobile-preview-nav-forward"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0",
            isLoading && "animate-spin"
          )}
          onClick={handleRefresh}
          data-testid="mobile-preview-refresh"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>

        <div 
          className="flex-1 flex items-center min-w-0 h-8 px-3 rounded-lg bg-muted border border-border text-[13px] text-muted-foreground"
          data-testid="mobile-preview-url-path"
        >
          <span className="truncate flex-1">{displayPath}</span>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0 ml-1" />
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0 gap-1 whitespace-nowrap"
          onClick={handleOpenExternal}
          data-testid="mobile-preview-open-external"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Open in browser</span>
        </Button>
      </div>

      {/* ── CONTENT AREA ── */}
      <div className="flex-1 relative bg-background overflow-hidden">
        {isStatusLoading ? (
          <div className="flex items-center justify-center h-full bg-background">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          </div>
        ) : !isPreviewRunning && !isPreviewStarting ? (
          <NotRunningState onRun={handleRun} isStarting={startPreviewMutation.isPending} noRunnableFiles={noRunnableFiles} />
        ) : isPreviewStarting ? (
          <div className="flex flex-col items-center justify-center h-full bg-background gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-[14px] text-muted-foreground font-medium">Starting your app...</p>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-muted z-10">
                <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
              </div>
            )}
            <iframe
              ref={iframeRef}
              key={iframeKey}
              src={computedPreviewUrl}
              className="w-full h-full border-0 bg-background"
              onLoad={handleIframeLoad}
              onError={() => setIsLoading(false)}
              title="App Preview"
              sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
              data-testid="mobile-preview-iframe"
            />
          </>
        )}
      </div>
    </div>
  );
}

export default MobilePreviewPanel;
