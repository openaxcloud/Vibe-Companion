import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { 
  RefreshCw, 
  ExternalLink, 
  Smartphone, 
  Tablet, 
  Monitor,
  X,
  Maximize2,
  Minimize2,
  Home,
  Loader2,
  AlertCircle,
  PlayCircle
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface WebPreviewProps {
  projectId: number;
  isRunning?: boolean;
  className?: string;
}

type PreviewStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'error';

const devicePresets = {
  desktop: { width: '100%', height: '100%', label: 'Desktop' },
  tablet: { width: '768px', height: '1024px', label: 'Tablet' },
  mobile: { width: '375px', height: '667px', label: 'Mobile' }
};

export function WebPreview({ projectId, isRunning = false, className = '' }: WebPreviewProps) {
  const [url, setUrl] = useState('');
  const [device, setDevice] = useState<keyof typeof devicePresets>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  
  const { data: previewData } = useQuery<{ previewUrl: string; status?: string }>({
    queryKey: ['/api/preview/url', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/preview/url?projectId=${projectId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch preview URL');
      return res.json();
    },
    enabled: !!projectId && projectId > 0
  });

  const connectWebSocket = useCallback(() => {
    if (!projectId || projectId <= 0) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/preview`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        ws.send(JSON.stringify({ type: 'subscribe', projectId }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }

          if (data.projectId != null && String(data.projectId) !== String(projectId)) return;

          switch (data.type) {
            case 'preview:start':
              setPreviewStatus('starting');
              setErrorMessage(null);
              break;

            case 'preview:ready':
              setPreviewStatus('running');
              setErrorMessage(null);
              if (data.url) {
                setUrl(data.url);
                setIframeKey(prev => prev + 1);
              }
              queryClient.invalidateQueries({ queryKey: ['/api/preview/url', projectId] });
              break;

            case 'preview:stop':
              setPreviewStatus('stopped');
              break;

            case 'preview:error':
              setPreviewStatus('error');
              setErrorMessage(data.error || 'Preview failed');
              break;

            case 'preview:file-change':
            case 'preview:rebuild':
              setPreviewStatus((prev) => {
                if (prev === 'running') {
                  setIframeKey(k => k + 1);
                }
                return prev;
              });
              break;

            case 'preview:status':
              if (data.status === 'running') {
                setPreviewStatus('running');
                if (data.url) setUrl(data.url);
              } else if (data.status === 'starting') {
                setPreviewStatus('starting');
              } else if (data.status === 'error') {
                setPreviewStatus('error');
                setErrorMessage(data.error || 'Preview failed');
              } else if (data.status === 'stopped') {
                setPreviewStatus('stopped');
              }
              break;
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
        }
      };

      ws.onerror = () => {
        // onclose will handle reconnect
      };
    } catch {
      // connection failed, will retry via onclose
    }
  }, [projectId]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

  useEffect(() => {
    if (previewData?.previewUrl && !url) {
      setUrl(previewData.previewUrl);
    }
    if (previewData?.previewUrl && (previewData?.status === 'static' || previewData?.status === 'running')) {
      setPreviewStatus('running');
    }
  }, [previewData, url]);

  useEffect(() => {
    if (isRunning) {
      if (previewStatus === 'idle' || previewStatus === 'stopped') {
        setPreviewStatus('starting');
      }
    }
  }, [isRunning, previewStatus]);
  
  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };
  
  const handleOpenInNewTab = () => {
    if (url) {
      window.open(url, '_blank');
    }
  };
  
  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const renderStatusOverlay = () => {
    if (previewStatus === 'starting') {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center space-y-3">
            <Loader2 className="w-10 h-10 mx-auto text-primary animate-spin" />
            <h3 className="text-[15px] font-semibold">Starting Preview</h3>
            <p className="text-[13px] text-muted-foreground">
              Waiting for the project server to be ready...
            </p>
          </div>
        </div>
      );
    }

    if (previewStatus === 'error') {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive" />
            <h3 className="text-[15px] font-semibold">Preview Error</h3>
            <p className="text-[13px] text-muted-foreground max-w-xs">
              {errorMessage || 'The preview server encountered an error.'}
            </p>
          </div>
        </div>
      );
    }

    if (previewStatus === 'stopped') {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center space-y-3">
            <PlayCircle className="w-10 h-10 mx-auto text-muted-foreground" />
            <h3 className="text-[15px] font-semibold">Preview Stopped</h3>
            <p className="text-[13px] text-muted-foreground">
              Click Run to start the preview again.
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  if (!previewData?.previewUrl && previewStatus === 'idle') {
    return (
      <Card className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center space-y-4 p-8">
          <Monitor className="w-16 h-16 mx-auto text-muted-foreground" />
          <h3 className="text-[15px] font-semibold">Preview Unavailable</h3>
          <p className="text-[13px] text-muted-foreground">
            Add an HTML file to your project or click Run to see the preview.
          </p>
        </div>
      </Card>
    );
  }
  
  return (
    <div className={`flex flex-col h-full ${className} ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      {/* Preview Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-surface-solid">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          title="Refresh"
          disabled={previewStatus !== 'running'}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const homeUrl = previewData?.previewUrl || '';
            if (homeUrl) {
              setUrl(homeUrl);
              setIframeKey(prev => prev + 1);
            }
          }}
          title="Home"
          disabled={previewStatus !== 'running'}
        >
          <Home className="h-4 w-4" />
        </Button>
        
        <div className="flex-1 flex items-center gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRefresh();
              }
            }}
            placeholder="Preview URL"
            className="h-8"
          />
        </div>
        
        <Select value={device} onValueChange={(value) => setDevice(value as keyof typeof devicePresets)}>
          <SelectTrigger className="w-32 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desktop">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Desktop
              </div>
            </SelectItem>
            <SelectItem value="tablet">
              <div className="flex items-center gap-2">
                <Tablet className="h-4 w-4" />
                Tablet
              </div>
            </SelectItem>
            <SelectItem value="mobile">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Mobile
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={handleOpenInNewTab}
          title="Open in new tab"
          disabled={previewStatus !== 'running'}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={handleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
        
        {isFullscreen && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFullscreen}
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Preview Frame */}
      <div className="flex-1 relative overflow-hidden">
        {renderStatusOverlay()}
        <div 
          className="h-full mx-auto transition-all duration-300"
          style={{
            width: devicePresets[device].width,
            height: devicePresets[device].height
          }}
        >
          {url && previewStatus === 'running' && (
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={url}
              className="w-full h-full border-0"
              title={`Preview for project ${projectId}`}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
          )}
        </div>
      </div>
    </div>
  );
}
