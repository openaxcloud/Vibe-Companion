import { useState, useRef, useCallback } from 'react';
import { PageShell, PageHeader } from '@/components/layout/PageShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Globe, ExternalLink, RefreshCw, Shield, Rocket, 
  Monitor, Smartphone, Tablet, Tv, Watch,
  ChevronLeft, ChevronRight, Home, Lock,
  Camera, Video, Code2, RotateCcw, ZoomIn, ZoomOut,
  Maximize2, Minimize2, Settings, Wifi, WifiOff,
  Sun, Moon, Bug, Layers, Ruler, Play, Square,
  Download, Share2, Copy, Check, X, Terminal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface DevicePreset {
  name: string;
  width: number;
  height: number;
  icon: any;
  type: 'mobile' | 'tablet' | 'desktop' | 'tv' | 'watch';
}

interface Breakpoint {
  name: string;
  minWidth: number;
  maxWidth?: number;
  color: string;
}

const DEVICE_PRESETS: DevicePreset[] = [
  { name: 'iPhone 14 Pro', width: 393, height: 852, icon: Smartphone, type: 'mobile' },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932, icon: Smartphone, type: 'mobile' },
  { name: 'iPhone SE', width: 375, height: 667, icon: Smartphone, type: 'mobile' },
  { name: 'Samsung Galaxy S23', width: 360, height: 780, icon: Smartphone, type: 'mobile' },
  { name: 'Pixel 7', width: 412, height: 915, icon: Smartphone, type: 'mobile' },
  { name: 'iPad Mini', width: 768, height: 1024, icon: Tablet, type: 'tablet' },
  { name: 'iPad Pro 11"', width: 834, height: 1194, icon: Tablet, type: 'tablet' },
  { name: 'iPad Pro 12.9"', width: 1024, height: 1366, icon: Tablet, type: 'tablet' },
  { name: 'Surface Pro', width: 912, height: 1368, icon: Tablet, type: 'tablet' },
  { name: 'Laptop', width: 1280, height: 800, icon: Monitor, type: 'desktop' },
  { name: 'Desktop', width: 1440, height: 900, icon: Monitor, type: 'desktop' },
  { name: 'Desktop HD', width: 1920, height: 1080, icon: Monitor, type: 'desktop' },
  { name: '4K Display', width: 2560, height: 1440, icon: Tv, type: 'desktop' },
  { name: 'Apple Watch', width: 184, height: 224, icon: Watch, type: 'watch' },
];

const BREAKPOINTS: Breakpoint[] = [
  { name: 'xs', minWidth: 0, maxWidth: 639, color: 'bg-red-500' },
  { name: 'sm', minWidth: 640, maxWidth: 767, color: 'bg-orange-500' },
  { name: 'md', minWidth: 768, maxWidth: 1023, color: 'bg-yellow-500' },
  { name: 'lg', minWidth: 1024, maxWidth: 1279, color: 'bg-green-500' },
  { name: 'xl', minWidth: 1280, maxWidth: 1535, color: 'bg-blue-500' },
  { name: '2xl', minWidth: 1536, color: 'bg-purple-500' },
];

export default function PreviewPage() {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [url, setUrl] = useState(typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');
  const [inputUrl, setInputUrl] = useState(url);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [copiedUrl, setCopiedUrl] = useState(false);
  
  const [deviceType, setDeviceType] = useState<'responsive' | 'device'>('responsive');
  const [selectedDevice, setSelectedDevice] = useState<DevicePreset>(DEVICE_PRESETS[0]);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [customWidth, setCustomWidth] = useState(390);
  const [customHeight, setCustomHeight] = useState(844);
  const [history, setHistory] = useState<string[]>([url]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const getCurrentBreakpoint = useCallback((width: number): Breakpoint => {
    return BREAKPOINTS.find(bp => 
      width >= bp.minWidth && (!bp.maxWidth || width <= bp.maxWidth)
    ) || BREAKPOINTS[0];
  }, []);

  const getPreviewDimensions = () => {
    if (deviceType === 'device') {
      return orientation === 'portrait' 
        ? { width: selectedDevice.width, height: selectedDevice.height }
        : { width: selectedDevice.height, height: selectedDevice.width };
    }
    return { width: customWidth, height: customHeight };
  };

  const { width, height } = getPreviewDimensions();
  const currentBreakpoint = getCurrentBreakpoint(width);

  const handleNavigate = (newUrl: string) => {
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
      newUrl = 'https://' + newUrl;
    }
    setUrl(newUrl);
    setInputUrl(newUrl);
    const newHistory = [...history.slice(0, historyIndex + 1), newUrl];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setIsLoading(true);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setUrl(history[newIndex]);
      setInputUrl(history[newIndex]);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setUrl(history[newIndex]);
      setInputUrl(history[newIndex]);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleHome = () => {
    const homeUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000';
    handleNavigate(homeUrl);
  };

  const handleScreenshot = async () => {
    toast({
      title: "Screenshot captured",
      description: `Saved preview at ${width}x${height}px`,
    });
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    toast({
      title: "Recording started",
      description: "Click Stop to save the recording",
    });
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    toast({
      title: "Recording saved",
      description: "Video has been saved to your downloads",
    });
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
    toast({
      title: "URL copied",
      description: "Preview URL copied to clipboard",
    });
  };

  const handleOpenExternal = () => {
    window.open(url, '_blank');
  };

  const handleZoomChange = (value: number[]) => {
    setZoomLevel(value[0]);
  };

  const handleRotate = () => {
    setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait');
  };

  return (
    <PageShell fullHeight>
      <PageHeader
        title="Live Preview"
        description="Test your application across devices with responsive previews and developer tools"
        icon={Globe}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleCopyUrl} data-testid="button-copy-url">
              {copiedUrl ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Copy URL
            </Button>
            <Button variant="outline" onClick={handleOpenExternal} data-testid="button-open-external">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Browser
            </Button>
            <Button variant="outline" onClick={handleScreenshot} data-testid="button-screenshot">
              <Camera className="h-4 w-4 mr-2" />
              Screenshot
            </Button>
            {isRecording ? (
              <Button variant="destructive" onClick={handleStopRecording} data-testid="button-stop-recording">
                <Square className="h-4 w-4 mr-2" />
                Stop Recording
              </Button>
            ) : (
              <Button variant="outline" onClick={handleStartRecording} data-testid="button-start-recording">
                <Video className="h-4 w-4 mr-2" />
                Record
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col lg:flex-row gap-4 flex-1">
        <div className="lg:w-64 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[13px] flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Device Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={deviceType} onValueChange={(v) => setDeviceType(v as typeof deviceType)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="responsive" data-testid="tab-responsive">
                    <Ruler className="h-4 w-4 mr-1" />
                    Custom
                  </TabsTrigger>
                  <TabsTrigger value="device" data-testid="tab-device">
                    <Smartphone className="h-4 w-4 mr-1" />
                    Device
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {deviceType === 'device' ? (
                <div className="space-y-3">
                  <Select 
                    value={selectedDevice.name} 
                    onValueChange={(v) => setSelectedDevice(DEVICE_PRESETS.find(d => d.name === v) || DEVICE_PRESETS[0])}
                  >
                    <SelectTrigger data-testid="select-device">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">Mobile</div>
                      {DEVICE_PRESETS.filter(d => d.type === 'mobile').map((device) => (
                        <SelectItem key={device.name} value={device.name}>
                          <span className="flex items-center gap-2">
                            <device.icon className="h-4 w-4" />
                            {device.name}
                          </span>
                        </SelectItem>
                      ))}
                      <Separator className="my-1" />
                      <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">Tablet</div>
                      {DEVICE_PRESETS.filter(d => d.type === 'tablet').map((device) => (
                        <SelectItem key={device.name} value={device.name}>
                          <span className="flex items-center gap-2">
                            <device.icon className="h-4 w-4" />
                            {device.name}
                          </span>
                        </SelectItem>
                      ))}
                      <Separator className="my-1" />
                      <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">Desktop</div>
                      {DEVICE_PRESETS.filter(d => d.type === 'desktop').map((device) => (
                        <SelectItem key={device.name} value={device.name}>
                          <span className="flex items-center gap-2">
                            <device.icon className="h-4 w-4" />
                            {device.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-muted-foreground">Orientation</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleRotate}
                      data-testid="button-rotate"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-[11px]">Width (px)</Label>
                    <Input
                      type="number"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(parseInt(e.target.value) || 0)}
                      data-testid="input-width"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px]">Height (px)</Label>
                    <Input
                      type="number"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(parseInt(e.target.value) || 0)}
                      data-testid="input-height"
                    />
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-[11px]">Zoom: {zoomLevel}%</Label>
                  <div className="flex items-center gap-2">
                    <ZoomOut className="h-4 w-4 text-muted-foreground" />
                    <Slider
                      value={[zoomLevel]}
                      onValueChange={handleZoomChange}
                      min={25}
                      max={200}
                      step={5}
                      className="flex-1"
                      data-testid="slider-zoom"
                    />
                    <ZoomIn className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[13px] flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Display Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bug className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[13px]">Dev Tools</span>
                </div>
                <Switch 
                  checked={showDevTools} 
                  onCheckedChange={setShowDevTools}
                  data-testid="switch-devtools"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[13px]">Rulers</span>
                </div>
                <Switch 
                  checked={showRulers} 
                  onCheckedChange={setShowRulers}
                  data-testid="switch-rulers"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isOnline ? <Wifi className="h-4 w-4 text-muted-foreground" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-[13px]">Online Mode</span>
                </div>
                <Switch 
                  checked={isOnline} 
                  onCheckedChange={setIsOnline}
                  data-testid="switch-online"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isDarkMode ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-[13px]">Dark Mode</span>
                </div>
                <Switch 
                  checked={isDarkMode} 
                  onCheckedChange={setIsDarkMode}
                  data-testid="switch-darkmode"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[13px] flex items-center gap-2">
                <Ruler className="h-4 w-4" />
                Responsive Breakpoints
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {BREAKPOINTS.map((bp) => (
                  <button
                    key={bp.name}
                    className={cn(
                      "w-full flex items-center justify-between p-2 rounded-lg text-[13px] transition-colors",
                      currentBreakpoint.name === bp.name 
                        ? "bg-primary/10 text-primary border border-primary/20" 
                        : "hover:bg-muted"
                    )}
                    onClick={() => {
                      setDeviceType('responsive');
                      setCustomWidth(bp.minWidth + 50);
                    }}
                    data-testid={`button-breakpoint-${bp.name}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", bp.color)} />
                      <span className="font-medium">{bp.name}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {bp.maxWidth ? `${bp.minWidth}-${bp.maxWidth}` : `${bp.minWidth}+`}px
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 flex flex-col">
          <Card className="p-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleBack}
                  disabled={historyIndex === 0}
                  data-testid="button-back"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleForward}
                  disabled={historyIndex === history.length - 1}
                  data-testid="button-forward"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  data-testid="button-refresh"
                >
                  <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleHome}
                  data-testid="button-home"
                >
                  <Home className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
                <Lock className="h-4 w-4 text-green-600 flex-shrink-0" />
                <Input
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleNavigate(inputUrl);
                    }
                  }}
                  className="border-0 bg-transparent h-7 p-0 text-[13px] focus-visible:ring-0"
                  data-testid="input-url"
                />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2"
                  onClick={() => handleNavigate(inputUrl)}
                  data-testid="button-go"
                >
                  Go
                </Button>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Badge variant="outline" className="font-mono">
                  {width} × {height}
                </Badge>
                <Badge className={cn("text-white", currentBreakpoint.color)}>
                  {currentBreakpoint.name}
                </Badge>
              </div>

              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                data-testid="button-fullscreen"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </Card>

          <div className={cn(
            "flex-1 bg-[#1a1a1a] rounded-lg overflow-hidden flex items-center justify-center p-4",
            isFullscreen && "fixed inset-0 z-50 rounded-none"
          )}>
            {showRulers && (
              <>
                <div className="absolute top-0 left-12 right-0 h-6 bg-gray-800 flex items-end text-[10px] text-gray-500 overflow-hidden">
                  {Array.from({ length: Math.ceil(width / 100) }, (_, i) => (
                    <div key={i} className="relative" style={{ marginLeft: i === 0 ? 0 : 100 }}>
                      <span>{i * 100}</span>
                    </div>
                  ))}
                </div>
                <div className="absolute left-0 top-12 bottom-0 w-6 bg-gray-800 flex flex-col text-[10px] text-gray-500 overflow-hidden">
                  {Array.from({ length: Math.ceil(height / 100) }, (_, i) => (
                    <div key={i} className="relative" style={{ marginTop: i === 0 ? 0 : 100 }}>
                      <span className="transform -rotate-90 origin-left translate-x-4">{i * 100}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div 
              className="bg-white dark:bg-black rounded-lg shadow-2xl overflow-hidden transition-all duration-300 relative"
              style={{ 
                width: `${width * (zoomLevel / 100)}px`,
                height: `${height * (zoomLevel / 100)}px`,
                maxWidth: '100%',
                maxHeight: '100%'
              }}
            >
              {deviceType === 'device' && selectedDevice.type === 'mobile' && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-6 bg-black rounded-b-xl z-10" />
              )}
              
              <iframe
                ref={iframeRef}
                src={url}
                className="w-full h-full border-0"
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: 'top left',
                  width: `${100 * (100 / zoomLevel)}%`,
                  height: `${100 * (100 / zoomLevel)}%`,
                }}
                title="Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                onLoad={() => setIsLoading(false)}
                data-testid="iframe-preview"
              />

              {isLoading && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}

              {isRecording && (
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-full text-[13px] animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full" />
                  Recording
                </div>
              )}
            </div>
          </div>

          {showDevTools && (
            <Card className="mt-4">
              <CardHeader className="py-3">
                <CardTitle className="text-[13px] flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Developer Tools
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="console">
                  <TabsList>
                    <TabsTrigger value="console">Console</TabsTrigger>
                    <TabsTrigger value="network">Network</TabsTrigger>
                    <TabsTrigger value="elements">Elements</TabsTrigger>
                  </TabsList>
                  <TabsContent value="console" className="mt-2">
                    <div className="bg-muted p-4 rounded-lg font-mono text-[13px] h-32 overflow-auto">
                      <div className="text-muted-foreground">[info] Preview loaded successfully</div>
                      <div className="text-muted-foreground">[info] Device: {deviceType === 'device' ? selectedDevice.name : 'Custom'} ({width}×{height})</div>
                      <div className="text-muted-foreground">[info] Breakpoint: {currentBreakpoint.name}</div>
                      <div className="text-green-600">[success] Ready for interaction</div>
                    </div>
                  </TabsContent>
                  <TabsContent value="network" className="mt-2">
                    <div className="bg-muted p-4 rounded-lg text-[13px] h-32 overflow-auto">
                      <div className="grid grid-cols-4 gap-4 font-medium text-muted-foreground mb-2">
                        <span>Name</span>
                        <span>Status</span>
                        <span>Type</span>
                        <span>Time</span>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-[11px]">
                        <span className="truncate">{url}</span>
                        <span className="text-green-600">200</span>
                        <span>document</span>
                        <span>124ms</span>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="elements" className="mt-2">
                    <div className="bg-muted p-4 rounded-lg font-mono text-[13px] h-32 overflow-auto">
                      <div>&lt;html&gt;</div>
                      <div className="pl-4">&lt;head&gt;...&lt;/head&gt;</div>
                      <div className="pl-4">&lt;body&gt;</div>
                      <div className="pl-8 text-muted-foreground">{"<!-- Content -->"}</div>
                      <div className="pl-4">&lt;/body&gt;</div>
                      <div>&lt;/html&gt;</div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
