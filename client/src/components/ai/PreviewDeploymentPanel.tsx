// @ts-nocheck
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Play,
  ExternalLink,
  Copy,
  RefreshCw,
  StopCircle,
  Loader2,
  Globe,
  CheckCircle,
  AlertCircle,
  Rocket,
  QrCode,
  Share2,
  Eye,
  EyeOff,
  Smartphone,
  Monitor,
  Tablet,
  Server,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';

interface PreviewDeploymentPanelProps {
  projectId: string | number;
  className?: string;
  compact?: boolean;
  onPreviewReady?: (url: string) => void;
}

interface PreviewStatus {
  projectId: string;
  runId: string;
  ports: number[];
  primaryPort: number;
  url: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  services: Array<{
    port: number;
    name: string;
    path?: string;
    description?: string;
  }>;
  lastHealthCheck?: string;
  frameworkType?: string;
}

type ViewportSize = 'mobile' | 'tablet' | 'desktop';

const viewportSizes: Record<ViewportSize, { width: number; label: string; icon: React.ElementType }> = {
  mobile: { width: 375, label: 'Mobile', icon: Smartphone },
  tablet: { width: 768, label: 'Tablet', icon: Tablet },
  desktop: { width: 1280, label: 'Desktop', icon: Monitor },
};

export function PreviewDeploymentPanel({
  projectId,
  className,
  compact = false,
  onPreviewReady,
}: PreviewDeploymentPanelProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [selectedViewport, setSelectedViewport] = useState<ViewportSize>('desktop');
  const [showQRCode, setShowQRCode] = useState(false);
  const { toast } = useToast();

  const { data: previewData, isLoading, refetch } = useQuery<{ 
    status: string; 
    runId?: string;
    ports?: number[];
    primaryPort?: number;
    services?: PreviewStatus['services'];
    frameworkType?: string;
    lastHealthCheck?: string;
  }>({
    queryKey: [`/api/preview/projects/${projectId}/preview/status`],
    refetchInterval: isStarting ? 2000 : 10000,
    enabled: !!projectId,
  });

  const preview: PreviewStatus | null = previewData ? {
    projectId: String(projectId),
    runId: previewData.runId || '',
    ports: previewData.ports || [],
    primaryPort: previewData.primaryPort || 0,
    url: `/api/preview/projects/${projectId}/preview/`,
    status: previewData.status as PreviewStatus['status'],
    services: previewData.services || [],
    lastHealthCheck: previewData.lastHealthCheck,
    frameworkType: previewData.frameworkType,
  } : null;
  
  const isRunning = preview?.status === 'running';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const previewUrl = isRunning 
    ? `${origin}/api/preview/projects/${projectId}/preview/`
    : null;

  useEffect(() => {
    if (isRunning && previewUrl && onPreviewReady) {
      onPreviewReady(previewUrl);
    }
    if (isRunning) {
      setIsStarting(false);
    }
  }, [isRunning, previewUrl, onPreviewReady]);

  const startPreviewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/preview/projects/${projectId}/preview/start`);
    },
    onSuccess: () => {
      setIsStarting(true);
      queryClient.invalidateQueries({ queryKey: [`/api/preview/projects/${projectId}/preview/status`] });
      toast({ title: 'Starting preview...', description: 'Your app preview is being prepared.' });
    },
    onError: (error: Error) => {
      setIsStarting(false);
      toast({ title: 'Failed to start preview', description: error.message, variant: 'destructive' });
    },
  });

  const stopPreviewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/preview/projects/${projectId}/preview/stop`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/preview/projects/${projectId}/preview/status`] });
      toast({ title: 'Preview stopped' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to stop preview', description: error.message, variant: 'destructive' });
    },
  });

  const restartPreviewMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', `/api/preview/projects/${projectId}/preview/stop`);
      return apiRequest('POST', `/api/preview/projects/${projectId}/preview/start`);
    },
    onSuccess: () => {
      setIsStarting(true);
      queryClient.invalidateQueries({ queryKey: [`/api/preview/projects/${projectId}/preview/status`] });
      toast({ title: 'Restarting preview...' });
    },
    onError: (error: Error) => {
      setIsStarting(false);
      toast({ title: 'Failed to restart preview', description: error.message, variant: 'destructive' });
    },
  });

  const copyUrl = () => {
    if (previewUrl) {
      navigator.clipboard.writeText(previewUrl);
      toast({ title: 'URL copied to clipboard' });
    }
  };

  const sharePreview = async () => {
    if (previewUrl) {
      if (navigator.share) {
        await navigator.share({
          title: 'Preview',
          url: previewUrl,
        });
      } else {
        copyUrl();
      }
    }
  };

  const getStatusBadge = () => {
    if (isStarting || preview?.status === 'starting') {
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Starting
        </Badge>
      );
    }
    
    switch (preview?.status) {
      case 'running':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Live
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      case 'stopped':
        return (
          <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">
            <StopCircle className="h-3 w-3 mr-1" />
            Stopped
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">
            Not started
          </Badge>
        );
    }
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)} data-testid="preview-deployment-compact">
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : isRunning ? (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-green-600 dark:text-green-400"
                    onClick={() => previewUrl && window.open(previewUrl, '_blank')}
                    data-testid="button-open-preview"
                  >
                    <Eye className="h-4 w-4" />
                    <span className="hidden sm:inline">Preview</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open preview in new tab</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-preview-options">
                  <Share2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={copyUrl} data-testid="menu-copy-url">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy URL
                </DropdownMenuItem>
                <DropdownMenuItem onClick={sharePreview} data-testid="menu-share">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowQRCode(!showQRCode)} data-testid="menu-qr">
                  <QrCode className="h-4 w-4 mr-2" />
                  QR Code
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => restartPreviewMutation.mutate()}
                  disabled={restartPreviewMutation.isPending}
                  data-testid="menu-restart"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Restart
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => stopPreviewMutation.mutate()}
                  disabled={stopPreviewMutation.isPending}
                  className="text-destructive"
                  data-testid="menu-stop"
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  Stop
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => startPreviewMutation.mutate()}
            disabled={startPreviewMutation.isPending || isStarting}
            data-testid="button-start-preview"
          >
            {startPreviewMutation.isPending || isStarting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Preview</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)} data-testid="preview-deployment-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview Deployment
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>
            <LazyAnimatePresence mode="wait">
              {isRunning ? (
                <LazyMotionDiv
                  key="running"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a
                      href={previewUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] text-primary hover:underline truncate flex-1"
                      data-testid="link-preview-url"
                    >
                      {previewUrl}
                    </a>
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={copyUrl}
                              data-testid="button-copy-preview-url"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copy URL</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => previewUrl && window.open(previewUrl, '_blank')}
                              data-testid="button-open-preview-external"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Open in new tab</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  {preview?.services && preview.services.length > 1 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-medium text-muted-foreground">Services</div>
                      <div className="grid gap-2">
                        {preview.services.map((service) => (
                          <div
                            key={service.port}
                            className="flex items-center justify-between p-2 bg-muted/30 rounded-md text-[13px]"
                            data-testid={`service-${service.port}`}
                          >
                            <div className="flex items-center gap-2">
                              <Server className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{service.name}</span>
                              <Badge variant="secondary" className="text-[10px]">:{service.port}</Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                const serviceUrl = `${window.location.origin}/api/preview/projects/${projectId}/preview/${service.port}/`;
                                window.open(serviceUrl, '_blank');
                              }}
                              data-testid={`button-open-service-${service.port}`}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {Object.entries(viewportSizes).map(([key, { label, icon: Icon }]) => (
                        <TooltipProvider key={key}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={selectedViewport === key ? "secondary" : "ghost"}
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setSelectedViewport(key as ViewportSize)}
                                data-testid={`button-viewport-${key}`}
                              >
                                <Icon className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{label}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => restartPreviewMutation.mutate()}
                        disabled={restartPreviewMutation.isPending}
                        data-testid="button-restart-preview"
                      >
                        {restartPreviewMutation.isPending ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Restart
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] text-destructive hover:text-destructive"
                        onClick={() => stopPreviewMutation.mutate()}
                        disabled={stopPreviewMutation.isPending}
                        data-testid="button-stop-preview"
                      >
                        {stopPreviewMutation.isPending ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <StopCircle className="h-3 w-3 mr-1" />
                        )}
                        Stop
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={async () => {
                        try {
                          await apiRequest('POST', `/api/projects/${projectId}/publish`, {});
                          toast({
                            title: 'Deployment Started',
                            description: 'Your app is being published to production.',
                          });
                          queryClient.invalidateQueries({ queryKey: ['/api/deployments', projectId] });
                        } catch (error: unknown) {
                          toast({
                            title: 'Deployment Failed',
                            description: (error as Error).message || 'Failed to start deployment',
                            variant: 'destructive',
                          });
                        }
                      }}
                      data-testid="button-publish"
                    >
                      <Rocket className="h-4 w-4" />
                      Publish to Production
                    </Button>
                  </div>
                </LazyMotionDiv>
              ) : isStarting || preview?.status === 'starting' ? (
                <LazyMotionDiv
                  key="starting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="text-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
                    <p className="text-[13px] text-muted-foreground">Starting preview server...</p>
                    <p className="text-[11px] text-muted-foreground mt-1">This may take a moment</p>
                  </div>
                  <Progress value={33} className="h-1" />
                </LazyMotionDiv>
              ) : preview?.status === 'error' ? (
                <LazyMotionDiv
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="text-center py-6">
                    <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-3" />
                    <p className="text-[13px] text-destructive font-medium">Preview failed to start</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Check your code for errors</p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => startPreviewMutation.mutate()}
                    disabled={startPreviewMutation.isPending}
                    data-testid="button-retry-preview"
                  >
                    {startPreviewMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Retry
                  </Button>
                </LazyMotionDiv>
              ) : (
                <LazyMotionDiv
                  key="stopped"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="text-center py-6">
                    <EyeOff className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-[13px] text-muted-foreground">No preview running</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Start a preview to see your app in action
                    </p>
                  </div>
                  <Button
                    variant="default"
                    className="w-full gap-2"
                    onClick={() => startPreviewMutation.mutate()}
                    disabled={startPreviewMutation.isPending || isStarting}
                    data-testid="button-start-preview-main"
                  >
                    {startPreviewMutation.isPending || isStarting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Start Preview
                  </Button>
                </LazyMotionDiv>
              )}
            </LazyAnimatePresence>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function PreviewDeploymentButton({
  projectId,
  className,
}: {
  projectId: string | number;
  className?: string;
}) {
  return (
    <PreviewDeploymentPanel 
      projectId={projectId} 
      className={className}
      compact 
    />
  );
}
