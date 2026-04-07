import React, { useEffect, useRef, useState } from 'react';
import { 
  ExternalLink, RefreshCw, Globe, ArrowLeft, ArrowRight, Home, Shield, 
  Smartphone, Tablet, Monitor, Copy, Check, Loader2, ZoomIn, ZoomOut,
  RotateCw, Download, Share2, Fullscreen, Settings, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WebPreviewProps {
  projectId: number;
  port?: number;
  isRunning?: boolean;
  previewUrl?: string;
}

type DeviceType = 'desktop' | 'tablet' | 'mobile' | 'custom';
type DeviceOrientation = 'portrait' | 'landscape';

interface DevicePreset {
  name: string;
  width: number;
  height: number;
}

const DEVICE_PRESETS: Record<string, DevicePreset[]> = {
  mobile: [
    { name: 'iPhone 14 Pro', width: 393, height: 852 },
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'Samsung Galaxy S21', width: 360, height: 800 },
    { name: 'Google Pixel 7', width: 412, height: 915 }
  ],
  tablet: [
    { name: 'iPad Pro 12.9"', width: 1024, height: 1366 },
    { name: 'iPad Air', width: 768, height: 1024 },
    { name: 'Surface Pro 8', width: 912, height: 1368 }
  ]
};

export function WebPreview({ projectId, port = 3000, isRunning = false, previewUrl: propPreviewUrl }: WebPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [orientation, setOrientation] = useState<DeviceOrientation>('portrait');
  const [selectedPreset, setSelectedPreset] = useState<DevicePreset | null>(null);
  const [customSize, setCustomSize] = useState({ width: 375, height: 667 });
  const [zoom, setZoom] = useState(100);
  const [isCopied, setIsCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (isRunning && port) {
      const baseUrl = window.location.hostname;
      const isDev = baseUrl === 'localhost' || baseUrl === '127.0.0.1';
      const previewUrl = isDev 
        ? `http://localhost:${port}`
        : propPreviewUrl || `https://${projectId}-${port}.${baseUrl}`;
      setUrl(previewUrl);
      setInputUrl(previewUrl);
    } else {
      setUrl('');
      setInputUrl('');
    }
  }, [projectId, port, isRunning, propPreviewUrl]);

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleOpenExternal = () => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleNavigate = (newUrl: string) => {
    if (newUrl && newUrl !== url) {
      setUrl(newUrl);
      setInputUrl(newUrl);
      setIsLoading(true);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleNavigate(inputUrl);
  };

  const handleGoBack = () => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.history.back();
      } catch (e) {
        toast({
          title: "Navigation Error",
          description: "Cannot navigate back due to security restrictions",
          variant: "destructive"
        });
      }
    }
  };

  const handleGoForward = () => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.history.forward();
      } catch (e) {
        toast({
          title: "Navigation Error",
          description: "Cannot navigate forward due to security restrictions",
          variant: "destructive"
        });
      }
    }
  };

  const handleGoHome = () => {
    if (port) {
      const baseUrl = window.location.hostname;
      const isDev = baseUrl === 'localhost' || baseUrl === '127.0.0.1';
      const homeUrl = isDev 
        ? `http://localhost:${port}`
        : propPreviewUrl || `https://${projectId}-${port}.${baseUrl}`;
      handleNavigate(homeUrl);
    }
  };

  const handleCopyUrl = async () => {
    if (url) {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      toast({
        title: "URL Copied",
        description: "Preview URL copied to clipboard",
      });
    }
  };

  const handleDeviceChange = (newDevice: DeviceType) => {
    setDevice(newDevice);
    if (newDevice === 'mobile' && !selectedPreset) {
      setSelectedPreset(DEVICE_PRESETS.mobile[0]);
    } else if (newDevice === 'tablet' && !selectedPreset) {
      setSelectedPreset(DEVICE_PRESETS.tablet[0]);
    }
  };

  const handlePresetChange = (preset: DevicePreset) => {
    setSelectedPreset(preset);
    setCustomSize({ width: preset.width, height: preset.height });
  };

  const handleZoomIn = () => setZoom(Math.min(zoom + 25, 200));
  const handleZoomOut = () => setZoom(Math.max(zoom - 25, 25));
  const handleZoomReset = () => setZoom(100);

  const toggleOrientation = () => {
    setOrientation(orientation === 'portrait' ? 'landscape' : 'portrait');
    if (selectedPreset) {
      setCustomSize({ 
        width: orientation === 'portrait' ? selectedPreset.height : selectedPreset.width, 
        height: orientation === 'portrait' ? selectedPreset.width : selectedPreset.height 
      });
    } else {
      setCustomSize({ width: customSize.height, height: customSize.width });
    }
  };

  const getDeviceSize = () => {
    if (device === 'desktop') return { width: '100%', height: '100%' };
    if (selectedPreset) {
      return orientation === 'portrait' 
        ? { width: `${selectedPreset.width}px`, height: `${selectedPreset.height}px` }
        : { width: `${selectedPreset.height}px`, height: `${selectedPreset.width}px` };
    }
    return { width: `${customSize.width}px`, height: `${customSize.height}px` };
  };

  const deviceSize = getDeviceSize();
  const iframeStyle = device === 'desktop' 
    ? { width: '100%', height: '100%', transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }
    : { width: deviceSize.width, height: deviceSize.height, transform: `scale(${zoom / 100})`, transformOrigin: 'top center' };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Enhanced Preview Toolbar */}
      <div className="flex flex-col border-b bg-muted/20">
        {/* Navigation Bar */}
        <div className="flex items-center px-2 py-1 space-x-2">
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGoBack}
              disabled={!canGoBack || !url}
              className="h-7 w-7"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGoForward}
              disabled={!canGoForward || !url}
              className="h-7 w-7"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={!url || isLoading}
              className="h-7 w-7"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGoHome}
              disabled={!url}
              className="h-7 w-7"
            >
              <Home className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* URL Bar */}
          <form onSubmit={handleUrlSubmit} className="flex-1 flex items-center space-x-2">
            <div className="flex-1 relative">
              <Shield className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-500" />
              <Input
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Enter URL or localhost:port"
                className="pl-8 pr-8 h-7 text-xs"
                disabled={!isRunning}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleCopyUrl}
                className="absolute right-0 top-0 h-7 w-7"
                disabled={!url}
              >
                {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </form>

          <Separator orientation="vertical" className="h-5" />

          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenExternal}
              disabled={!url}
              className="h-7 w-7"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-7 w-7"
            >
              <Fullscreen className="h-3.5 w-3.5" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setShowConsole(!showConsole)}>
                  <Eye className="h-4 w-4 mr-2" />
                  {showConsole ? 'Hide' : 'Show'} Console
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleZoomReset}>
                  Reset Zoom (100%)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDeviceChange('desktop')}>
                  Desktop View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDeviceChange('tablet')}>
                  Tablet View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDeviceChange('mobile')}>
                  Mobile View
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Device and Zoom Controls */}
        <div className="flex items-center justify-between px-2 py-1 border-t">
          <div className="flex items-center space-x-2">
            {/* Device Selection */}
            <div className="flex items-center space-x-1">
              <Toggle
                pressed={device === 'desktop'}
                onPressedChange={() => handleDeviceChange('desktop')}
                size="sm"
                aria-label="Desktop view"
              >
                <Monitor className="h-3.5 w-3.5" />
              </Toggle>
              <Toggle
                pressed={device === 'tablet'}
                onPressedChange={() => handleDeviceChange('tablet')}
                size="sm"
                aria-label="Tablet view"
              >
                <Tablet className="h-3.5 w-3.5" />
              </Toggle>
              <Toggle
                pressed={device === 'mobile'}
                onPressedChange={() => handleDeviceChange('mobile')}
                size="sm"
                aria-label="Mobile view"
              >
                <Smartphone className="h-3.5 w-3.5" />
              </Toggle>
            </div>

            <Separator orientation="vertical" className="h-5" />

            {/* Device Presets */}
            {(device === 'mobile' || device === 'tablet') && (
              <Select
                value={selectedPreset?.name}
                onValueChange={(name) => {
                  const preset = DEVICE_PRESETS[device]?.find(p => p.name === name);
                  if (preset) handlePresetChange(preset);
                }}
              >
                <SelectTrigger className="h-7 w-48 text-xs">
                  <SelectValue placeholder="Select device" />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_PRESETS[device]?.map(preset => (
                    <SelectItem key={preset.name} value={preset.name}>
                      {preset.name} ({preset.width}×{preset.height})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Orientation Toggle */}
            {device !== 'desktop' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleOrientation}
                className="h-7"
              >
                <RotateCw className="h-3.5 w-3.5 mr-1" />
                {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
              </Button>
            )}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={zoom <= 25}
              className="h-7 w-7"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <div className="flex items-center space-x-1">
              <Slider
                value={[zoom]}
                onValueChange={([value]) => setZoom(value)}
                min={25}
                max={200}
                step={25}
                className="w-24"
              />
              <span className="text-xs font-medium w-10 text-center">{zoom}%</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              className="h-7 w-7"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Badge variant="secondary" className="text-xs">
            {device === 'desktop' ? 'Responsive' : `${deviceSize.width} × ${deviceSize.height}`}
          </Badge>
        </div>
      </div>

      {/* Preview Content */}
      <div className={`flex-1 relative overflow-auto bg-muted/10 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`} ref={containerRef}>
        {url && isRunning ? (
          <div className={device === 'desktop' ? 'w-full h-full' : 'flex justify-center items-start p-8'}>
            <div 
              className={device !== 'desktop' ? 'shadow-2xl rounded-lg overflow-hidden bg-white' : ''}
              style={device !== 'desktop' ? { width: deviceSize.width, height: deviceSize.height } : {}}
            >
              <iframe
                ref={iframeRef}
                src={url}
                className="bg-white"
                style={iframeStyle}
                onLoad={() => {
                  setIsLoading(false);
                  try {
                    if (iframeRef.current?.contentWindow) {
                      setCanGoBack(iframeRef.current.contentWindow.history.length > 1);
                    }
                  } catch (e) {
                    // Cross-origin restrictions
                  }
                }}
                onError={() => {
                  setIsLoading(false);
                  toast({
                    title: "Preview Error",
                    description: "Failed to load preview. Make sure your project is running.",
                    variant: "destructive"
                  });
                }}
                title="Web Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-pointer-lock"
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Loading preview...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center max-w-md">
              <Globe className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Preview Available</h3>
              <p className="text-sm mb-4">
                {isRunning ? 'Waiting for server...' : 'Click the Run button to start your project and see the preview'}
              </p>
              <div className="space-y-2 text-xs">
                <p>• Web servers will appear here automatically</p>
                <p>• HTML files can be previewed directly</p>
                <p>• Supports hot reload for live updates</p>
                <p>• Test responsive designs with device emulation</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Console Panel (Optional) */}
      {showConsole && (
        <div className="h-48 border-t bg-background p-2 overflow-auto font-mono text-xs">
          <div className="text-muted-foreground mb-2">Console Output:</div>
          {consoleLogs.length > 0 ? (
            consoleLogs.map((log, index) => (
              <div key={index} className="py-0.5">{log}</div>
            ))
          ) : (
            <div className="text-muted-foreground">No console output yet</div>
          )}
        </div>
      )}
    </div>
  );
}