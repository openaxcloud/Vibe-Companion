// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { File } from '@shared/schema';
import { useMutation } from '@tanstack/react-query';
import { 
  RefreshCw, 
  ExternalLink, 
  Maximize2, 
  Minimize2, 
  Smartphone, 
  Tablet, 
  Monitor,
  Bug,
  Play,
  Square,
  AlertCircle,
  Wifi,
  WifiOff,
  Server,
  Globe,
  Zap,
  Copy,
  Settings,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface PreviewProps {
  openFiles: File[];
  projectId?: number;
}

interface PreviewService {
  port: number;
  name: string;
  path?: string;
  description?: string;
}

interface PreviewStatus {
  status: 'idle' | 'starting' | 'running' | 'error' | 'stopped';
  runId?: string;
  ports?: number[];
  primaryPort?: number;
  currentPort?: number;
  services?: PreviewService[];
  frameworkType?: string;
  healthChecks?: Record<number, boolean>;
  lastHealthCheck?: string;
  logs?: string[];
}

interface PreviewProps {
  openFiles: File[];
  projectId?: number;
}

// Device presets like Replit
const DEVICE_PRESETS = {
  desktop: { width: '100%', height: '100%', label: 'Desktop' },
  tablet: { width: '768px', height: '1024px', label: 'iPad' },
  'tablet-landscape': { width: '1024px', height: '768px', label: 'iPad Landscape' },
  mobile: { width: '375px', height: '667px', label: 'iPhone 8' },
  'mobile-landscape': { width: '667px', height: '375px', label: 'iPhone 8 Landscape' },
  'mobile-xl': { width: '414px', height: '896px', label: 'iPhone 11' },
};

const Preview = ({ openFiles, projectId }: PreviewProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>({ status: 'idle' });
  const [deviceMode, setDeviceMode] = useState<keyof typeof DEVICE_PRESETS>('desktop');
  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  const [devToolsEnabled, setDevToolsEnabled] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  // Load saved preferences
  useEffect(() => {
    if (projectId) {
      const savedDevice = localStorage.getItem(`preview-device-${projectId}`) as keyof typeof DEVICE_PRESETS;
      const savedPort = localStorage.getItem(`preview-port-${projectId}`);
      
      if (savedDevice && DEVICE_PRESETS[savedDevice]) {
        setDeviceMode(savedDevice);
      }
      if (savedPort) {
        setSelectedPort(parseInt(savedPort));
      }
    }
  }, [projectId]);

  // Save preferences
  const savePreference = (key: string, value: string) => {
    if (projectId) {
      localStorage.setItem(`preview-${key}-${projectId}`, value);
    }
  };

  // Start preview server mutation - prevents race conditions from double-clicks
  const startPreviewMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('No project ID');
      return apiRequest('POST', `/api/preview/projects/${projectId}/preview/start`);
    },
    onMutate: () => {
      setPreviewStatus({ status: 'starting' });
      setIsLoading(true);
    },
    onSuccess: (data) => {
      if (data.success && data.preview) {
        const preview = data.preview;
        setPreviewStatus({
          status: preview.status === 'running' ? 'running' : 'starting',
          runId: preview.runId,
          ports: preview.ports,
          primaryPort: preview.primaryPort,
          services: preview.services,
          frameworkType: preview.frameworkType
        });
        
        const targetPort = selectedPort && preview.ports.includes(selectedPort) 
          ? selectedPort 
          : preview.primaryPort;
        setSelectedPort(targetPort);

        if (preview.status === 'running') {
          setPreviewUrl(`/api/preview/projects/${projectId}/preview/`);
          toast({
            title: "Preview Started",
            description: `${preview.frameworkType || 'Application'} server is running`,
          });
          if (devToolsEnabled) setTimeout(injectDevTools, 1000);
        } else {
          const poll = setInterval(async () => {
            try {
              const s: any = await apiRequest('GET', `/api/preview/projects/${projectId}/preview/status`);
              if (s?.status === 'running') {
                clearInterval(poll);
                setPreviewStatus(prev => ({ ...prev, status: 'running' }));
                setPreviewUrl(`/api/preview/projects/${projectId}/preview/`);
                toast({ title: "Preview Ready", description: `${preview.frameworkType || 'Application'} is now live` });
                if (devToolsEnabled) setTimeout(injectDevTools, 1000);
              } else if (s?.status === 'error') {
                clearInterval(poll);
                setPreviewStatus(prev => ({ ...prev, status: 'error' }));
              }
            } catch { /* ignore */ }
          }, 1500);
          setTimeout(() => clearInterval(poll), 180000);
        }
      } else {
        throw new Error(data.error || 'Failed to start preview');
      }
    },
    onError: (error: Error) => {
      console.error('Failed to start preview:', error);
      setPreviewStatus({ status: 'error' });
      toast({
        title: "Preview Error",
        description: error.message || "Failed to start preview server",
        variant: "destructive"
      });
    },
    onSettled: () => {
      setIsLoading(false);
    }
  });

  // Stop preview server mutation - prevents race conditions
  const stopPreviewMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('No project ID');
      return apiRequest('POST', `/api/preview/projects/${projectId}/preview/stop`);
    },
    onSuccess: () => {
      setPreviewUrl(null);
      setPreviewStatus({ status: 'idle' });
      setSelectedPort(null);
      
      toast({
        title: "Preview Stopped",
        description: "Preview server has been stopped",
      });
    },
    onError: (error: Error) => {
      console.error('Failed to stop preview:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to stop preview server",
        variant: "destructive"
      });
    }
  });

  // Legacy function wrappers for compatibility
  const startPreview = () => {
    if (projectId && !startPreviewMutation.isPending) {
      startPreviewMutation.mutate();
    }
  };

  const stopPreview = () => {
    if (projectId && !stopPreviewMutation.isPending) {
      stopPreviewMutation.mutate();
    }
  };

  // Switch to different port mutation - prevents race conditions
  const switchPortMutation = useMutation({
    mutationFn: async (port: number) => {
      if (!projectId || !previewStatus.ports?.includes(port)) {
        throw new Error('Invalid port selection');
      }
      return apiRequest('POST', `/api/preview/projects/${projectId}/preview/switch-port`, { port });
    },
    onSuccess: (data, port) => {
      if (data.success) {
        setSelectedPort(port);
        setPreviewUrl(`/api/preview/projects/${projectId}/preview/`);
        savePreference('port', port.toString());
        
        setPreviewStatus(prev => ({
          ...prev,
          currentPort: port
        }));
        
        toast({
          title: "Port Switched",
          description: `Now viewing service on port ${port}`,
        });
      } else {
        throw new Error(data.error || 'Failed to switch port');
      }
    },
    onError: (error: Error) => {
      console.error('Failed to switch port:', error);
      toast({
        title: "Port Switch Failed",
        description: error.message || "Unable to switch to selected port",
        variant: "destructive"
      });
    }
  });

  const switchPort = (port: number) => {
    if (!switchPortMutation.isPending) {
      switchPortMutation.mutate(port);
    }
  };

  // Copy preview URL to clipboard
  const copyPreviewUrl = async () => {
    if (!previewUrl) return;
    
    try {
      // Build shareable URL with full origin
      const shareableUrl = `${window.location.origin}${previewUrl}`;
      await navigator.clipboard.writeText(shareableUrl);
      
      toast({
        title: "URL Copied",
        description: "Preview URL copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast({
        title: "Copy Failed",
        description: "Unable to copy URL to clipboard",
        variant: "destructive"
      });
    }
  };

  // Inject Eruda developer tools (like Replit)
  const injectDevTools = () => {
    if (!iframeRef.current) return;
    
    try {
      const iframeDoc = iframeRef.current.contentDocument;
      if (!iframeDoc) return;
      
      // Inject Eruda script
      const script = iframeDoc.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/eruda@3.0.1/eruda.min.js';
      script.onload = () => {
        // Initialize Eruda after loading
        const initScript = iframeDoc.createElement('script');
        initScript.textContent = 'if(window.eruda) eruda.init();';
        iframeDoc.head?.appendChild(initScript);
      };
      iframeDoc.head?.appendChild(script);
    } catch (error) {
      console.error('Failed to inject dev tools:', error);
    }
  };

  // Refresh the preview
  // ✅ FIX: Use onload event instead of arbitrary timeout to clear loading state
  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      // onload handler will clear loading state when iframe actually loads
      iframeRef.current.src = iframeRef.current.src;
    }
  };
  
  // Handle iframe load event to clear loading state
  const handleIframeLoad = () => {
    setIsLoading(false);
  };
  
  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };
  
  // Open in new window
  const openInNewWindow = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  // Toggle dev tools
  const toggleDevTools = () => {
    setDevToolsEnabled(!devToolsEnabled);
    if (!devToolsEnabled) {
      injectDevTools();
    } else {
      handleRefresh(); // Refresh to remove dev tools
    }
  };

  // Toggle device mode and save preference
  const handleDeviceChange = (device: keyof typeof DEVICE_PRESETS) => {
    setDeviceMode(device);
    savePreference('device', device);
  };

  // Setup WebSocket connection for real-time preview updates
  useEffect(() => {
    if (!projectId) return;
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/preview`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      setWsConnected(true);
      // Subscribe to this project's preview updates
      ws.send(JSON.stringify({ type: 'subscribe', projectId }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'preview:start':
          setPreviewStatus({ status: 'starting' });
          break;
          
        case 'preview:ready':
          setPreviewStatus(prev => ({
            ...prev,
            status: 'running',
            ports: data.ports,
            primaryPort: data.primaryPort,
            services: data.services
          }));
          
          const targetPort = selectedPort && data.ports.includes(selectedPort) 
            ? selectedPort 
            : data.primaryPort;
          setPreviewUrl(`/api/preview/projects/${projectId}/preview/`);
          setSelectedPort(targetPort);
          break;
          
        case 'preview:stop':
          setPreviewStatus({ status: 'idle' });
          setPreviewUrl(null);
          setSelectedPort(null);
          break;
          
        case 'preview:error':
          setPreviewStatus({ status: 'error' });
          toast({
            title: "Preview Error",
            description: data.error,
            variant: "destructive"
          });
          break;
          
        case 'preview:log':
          // Handle logs from specific services
          break;
          
        case 'preview:port-switch':
          setSelectedPort(data.port);
          setPreviewUrl(data.url);
          break;
          
        case 'preview:health-check-failed':
          toast({
            title: "Service Health Check Failed",
            description: `Service on port ${data.port} is not responding`,
            variant: "destructive"
          });
          break;
          
        case 'preview:rebuild':
          break;
          
        case 'preview:status':
          setPreviewStatus({
            status: data.status || 'idle',
            runId: data.runId,
            ports: data.ports,
            primaryPort: data.primaryPort,
            services: data.services,
            healthChecks: data.healthChecks,
            lastHealthCheck: data.lastHealthCheck,
            frameworkType: data.frameworkType
          });
          
          if (data.ports && data.primaryPort) {
            const targetPort = selectedPort && data.ports.includes(selectedPort) 
              ? selectedPort 
              : data.primaryPort;
            setPreviewUrl(`/api/preview/projects/${projectId}/preview/`);
            setSelectedPort(targetPort);
          }
          break;
      }
    };
    
    ws.onerror = (error) => {
      console.error('Preview WebSocket error:', error);
      setWsConnected(false);
    };
    
    ws.onclose = () => {
      setWsConnected(false);
    };
    
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe' }));
        ws.close();
      }
    };
  }, [projectId, toast]);

  // Track if auto-start has been triggered to prevent race conditions
  const autoStartTriggeredRef = useRef(false);
  
  // Reset auto-start guard when projectId changes or preview returns to idle
  useEffect(() => {
    autoStartTriggeredRef.current = false;
  }, [projectId]);
  
  // Also reset when preview transitions back to idle (after stop)
  useEffect(() => {
    if (previewStatus.status === 'idle') {
      autoStartTriggeredRef.current = false;
    }
  }, [previewStatus.status]);
  
  // Auto-start preview when project changes (enhanced logic)
  // ✅ FIX: Added cleanup for setTimeout and guard against double-starts
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined;
    
    if (projectId && openFiles.length > 0) {
      // Check if we have runnable files
      const hasExecutable = openFiles.some(f => 
        f.name === 'package.json' || 
        f.name.endsWith('.py') || 
        f.name === 'index.html' ||
        f.name === 'main.py' ||
        f.name === 'app.py' ||
        f.name === 'server.py'
      );
      
      // Check for modern frameworks
      const hasModernFramework = openFiles.some(f => f.content?.includes('@vitejs/plugin-react') ||
        f.content?.includes('@vitejs/plugin-vue') ||
        f.content?.includes('@angular/core'));
      
      // Only auto-start if idle, not already starting, and hasn't been triggered yet
      if (hasExecutable && previewStatus.status === 'idle' && !startPreviewMutation.isPending && !autoStartTriggeredRef.current) {
        // Auto-start for projects with runnable files
        if (hasModernFramework || openFiles.some(f => f.name === 'package.json')) {
          autoStartTriggeredRef.current = true;
          timeoutId = setTimeout(() => {
            // Double-check state before starting (guard against race conditions)
            if (!startPreviewMutation.isPending) {
              startPreviewMutation.mutate();
            }
          }, 1000);
        }
      }
    }
    
    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [projectId, openFiles, previewStatus.status, startPreviewMutation]);

  // Check preview status on component mount
  useEffect(() => {
    if (projectId) {
      checkPreviewStatus();
    }
  }, [projectId]);

  const checkPreviewStatus = async () => {
    if (!projectId) return;
    
    try {
      const data = await apiRequest('GET', `/api/preview/projects/${projectId}/preview/status`);
      
      if (data.status !== 'stopped') {
        setPreviewStatus({
          status: data.status,
          runId: data.runId,
          ports: data.ports,
          primaryPort: data.primaryPort,
          services: data.services,
          healthChecks: data.healthChecks,
          lastHealthCheck: data.lastHealthCheck,
          frameworkType: data.frameworkType
        });
        
        if (data.status === 'running' && data.ports && data.primaryPort) {
          const targetPort = selectedPort && data.ports.includes(selectedPort) 
            ? selectedPort 
            : data.primaryPort;
          setPreviewUrl(`/api/preview/projects/${projectId}/preview/`);
          setSelectedPort(targetPort);
        }
      }
    } catch (error) {
      console.error('Failed to check preview status:', error);
    }
  };

  // Track preview status in ref to avoid stale closure in cleanup
  const previewStatusRef = useRef(previewStatus.status);
  useEffect(() => {
    previewStatusRef.current = previewStatus.status;
  }, [previewStatus.status]);
  
  // Clean up preview on unmount
  // ✅ FIX: Use ref to get latest status value, avoiding stale closure
  useEffect(() => {
    return () => {
      if (previewStatusRef.current === 'running' && !stopPreviewMutation.isPending) {
        stopPreviewMutation.mutate();
      }
    };
  }, [stopPreviewMutation]);

  // Device preset styles
  const deviceStyles = deviceMode === 'desktop' 
    ? {} 
    : {
        width: DEVICE_PRESETS[deviceMode].width,
        height: DEVICE_PRESETS[deviceMode].height,
        maxWidth: '100%',
        maxHeight: '100%',
        margin: '0 auto',
        boxShadow: '0 0 20px rgba(0,0,0,0.2)',
        borderRadius: '8px',
        overflow: 'hidden'
      };
  
  return (
    <div className={`flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      {/* Preview header - Enhanced Replit style with responsive design */}
      <div className="flex items-center justify-between p-1.5 sm:p-2 border-b bg-background gap-1 sm:gap-2">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-shrink">
          <h3 className="text-[11px] sm:text-[13px] font-semibold whitespace-nowrap">Preview</h3>
          
          {/* Status indicator */}
          {previewStatus.status === 'running' && (
            <div className="flex items-center gap-1">
              <span className="flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse" />
                <span className="hidden xs:inline">Live</span>
              </span>
              {previewStatus.frameworkType && (
                <Badge variant="secondary" className="text-[10px] sm:text-[11px] hidden sm:inline-flex">
                  {previewStatus.frameworkType}
                </Badge>
              )}
            </div>
          )}
          
          {previewStatus.status === 'starting' && (
            <span className="text-[10px] sm:text-[11px] text-yellow-600 dark:text-yellow-400">Starting...</span>
          )}
          
          {previewStatus.status === 'error' && (
            <span className="text-[10px] sm:text-[11px] text-red-600 dark:text-red-400">Error</span>
          )}
          
          {/* WebSocket connection status - hidden on very small screens */}
          <span className="hidden sm:inline-flex">
            {wsConnected ? (
              <Wifi className="h-3 w-3 text-green-600 dark:text-green-400" />
            ) : (
              <WifiOff className="h-3 w-3 text-muted-foreground" />
            )}
          </span>
        </div>
        
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          {/* Port selector - disabled during port switch to prevent race conditions */}
          {previewStatus.ports && previewStatus.ports.length > 1 && (
            <Select 
              value={selectedPort?.toString() || previewStatus.primaryPort?.toString()} 
              onValueChange={(value) => switchPort(parseInt(value))}
              disabled={switchPortMutation.isPending}
            >
              <SelectTrigger className="h-7 sm:h-8 w-16 sm:w-20 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {previewStatus.ports.map(port => {
                  const service = previewStatus.services?.find(s => s.port === port);
                  const isHealthy = previewStatus.healthChecks?.[port] !== false;
                  
                  return (
                    <SelectItem key={port} value={port.toString()}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span>{port}</span>
                        {service && (
                          <span className="text-[11px] text-muted-foreground">
                            {service.name}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
          
          {/* Start/Stop button - uses mutation isPending to prevent double-clicks */}
          {previewStatus.status !== 'running' ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8"
              onClick={startPreview}
              disabled={!projectId || startPreviewMutation.isPending || previewStatus.status === 'starting'}
              title="Start preview"
              data-testid="button-start-preview"
            >
              {startPreviewMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8"
              onClick={stopPreview}
              disabled={stopPreviewMutation.isPending}
              title="Stop preview"
              data-testid="button-stop-preview"
            >
              {stopPreviewMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <Square className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}
            </Button>
          )}
          
          {/* Device selector - Hidden on very small screens */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 hidden xs:flex" title="Device preview" data-testid="button-device-preview">
                {deviceMode === 'desktop' && <Monitor className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                {deviceMode.includes('tablet') && <Tablet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                {deviceMode.includes('mobile') && <Smartphone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Device Presets</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Object.entries(DEVICE_PRESETS).map(([key, preset]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => handleDeviceChange(key as keyof typeof DEVICE_PRESETS)}
                  className={deviceMode === key ? 'bg-accent' : ''}
                >
                  <div className="flex items-center gap-2">
                    {key === 'desktop' && <Monitor className="h-4 w-4" />}
                    {key.includes('tablet') && <Tablet className="h-4 w-4" />}
                    {key.includes('mobile') && <Smartphone className="h-4 w-4" />}
                    <span>{preset.label}</span>
                    {preset.width !== '100%' && (
                      <span className="text-[11px] text-muted-foreground">
                        {preset.width} × {preset.height}
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Developer tools toggle - hidden on mobile */}
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 sm:h-8 sm:w-8 hidden sm:flex ${devToolsEnabled ? 'text-orange-500 dark:text-orange-400' : ''}`}
            onClick={toggleDevTools}
            title="Developer tools (Eruda)"
            data-testid="button-devtools"
          >
            <Bug className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          
          {/* Copy URL button - hidden on very small screens */}
          <Button
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 sm:h-8 sm:w-8 hidden xs:flex"
            onClick={copyPreviewUrl}
            disabled={!previewUrl}
            title="Copy preview URL"
            data-testid="button-copy-url"
          >
            <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          
          {/* Refresh button - always visible */}
          <Button
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={handleRefresh}
            disabled={!previewUrl}
            title="Refresh"
            data-testid="button-refresh-preview"
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          
          {/* Open in new window - hidden on mobile */}
          <Button
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 sm:h-8 sm:w-8 hidden sm:flex"
            onClick={openInNewWindow}
            disabled={!previewUrl}
            title="Open in new window"
            data-testid="button-open-new-window"
          >
            <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          
          {/* Fullscreen toggle - always visible */}
          <Button
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            data-testid="button-fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
          </Button>
          
          {/* Mobile overflow menu for hidden buttons */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 flex sm:hidden" data-testid="button-preview-more">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={toggleDevTools}>
                <Bug className="h-4 w-4 mr-2" />
                Dev Tools
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyPreviewUrl} disabled={!previewUrl}>
                <Copy className="h-4 w-4 mr-2" />
                Copy URL
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openInNewWindow} disabled={!previewUrl}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Device Presets</DropdownMenuLabel>
              {Object.entries(DEVICE_PRESETS).map(([key, preset]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => handleDeviceChange(key as keyof typeof DEVICE_PRESETS)}
                  className={deviceMode === key ? 'bg-accent' : ''}
                >
                  {key === 'desktop' && <Monitor className="h-4 w-4 mr-2" />}
                  {key.includes('tablet') && <Tablet className="h-4 w-4 mr-2" />}
                  {key.includes('mobile') && <Smartphone className="h-4 w-4 mr-2" />}
                  {preset.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Preview iframe or status message - Responsive container */}
      <div className={`flex-1 bg-muted/50 overflow-hidden ${deviceMode !== 'desktop' ? 'p-2 sm:p-4 md:p-6 flex items-center justify-center' : ''}`}>
        {/* Loading skeleton when starting - Responsive layout */}
        {previewStatus.status === 'starting' && !previewUrl && (
          <div className="flex flex-col items-center justify-center h-full p-4 sm:p-6 md:p-8">
            <div className="w-full max-w-xs sm:max-w-sm md:max-w-md space-y-3 sm:space-y-4">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-[13px] font-medium">Starting preview server...</span>
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-32 w-full mt-4" />
              <div className="flex gap-2 mt-4">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          </div>
        )}
        
        {/* Active preview iframe - Responsive frame */}
        {previewUrl ? (
          <div style={deviceStyles} className="h-full w-full bg-background transition-all duration-300">
            <iframe
              ref={iframeRef}
              className="w-full h-full border-none"
              src={previewUrl}
              title="Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              onLoad={handleIframeLoad}
              data-testid="preview-iframe"
            />
          </div>
        ) : previewStatus.status !== 'starting' && (
          <div className="flex flex-col items-center justify-center h-full text-center p-4 sm:p-6 md:p-8 lg:p-12">
            <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-muted-foreground mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-[15px] md:text-xl font-semibold mb-1.5 sm:mb-2">
              {previewStatus.status === 'error' ? 'Preview Error' : 'Preview Server Offline'}
            </h3>
            <p className="text-[11px] sm:text-[13px] md:text-base text-muted-foreground mb-3 sm:mb-4 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg">
              {projectId 
                ? previewStatus.status === 'error'
                  ? "There was an error starting the preview server. Check your project files and try again."
                  : "Click the play button to start the preview server. Your project will be served with auto-detected framework support."
                : "Open a project to see the preview"
              }
            </p>
            
            {/* Service status indicators */}
            {previewStatus.services && previewStatus.services.length > 0 && (
              <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-muted rounded-md max-w-sm sm:max-w-lg w-full">
                <h4 className="text-[11px] sm:text-[13px] font-medium mb-1.5 sm:mb-2">Available Services:</h4>
                <div className="space-y-1">
                  {previewStatus.services.map(service => (
                    <div key={service.port} className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px]">
                      <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0 ${
                        previewStatus.healthChecks?.[service.port] !== false ? 'bg-green-500 dark:bg-green-400' : 'bg-red-500 dark:bg-red-400'
                      }`} />
                      <span className="truncate">{service.name}</span>
                      <span className="text-muted-foreground flex-shrink-0">:{service.port}</span>
                      {service.description && (
                        <span className="text-muted-foreground truncate hidden sm:inline">- {service.description}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Framework detection info */}
            {previewStatus.frameworkType && (
              <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-muted-foreground">
                Detected: {previewStatus.frameworkType} project
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Preview;