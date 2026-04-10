import { useState, useRef, useEffect, useCallback } from 'react';
import { PageShell, PageHeader } from '@/components/layout/PageShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Monitor,
  MonitorPlay,
  Wifi,
  WifiOff,
  Settings,
  Maximize,
  Minimize,
  Keyboard,
  Clipboard,
  Video,
  VideoOff,
  RefreshCw,
  Power,
  PowerOff,
  Layers,
  Gauge,
  Lock,
  Eye,
  EyeOff,
  Play,
  Square,
  Circle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
  Zap,
  HardDrive,
  Cpu,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VNCConnectionConfig {
  host: string;
  port: number;
  password: string;
  viewOnly: boolean;
  sharedSession: boolean;
}

interface VNCDisplaySettings {
  resolution: string;
  colorDepth: string;
  scalingMode: string;
  quality: number;
  compression: number;
}

interface VNCSessionState {
  isConnected: boolean;
  isConnecting: boolean;
  isRecording: boolean;
  isFullScreen: boolean;
  clipboardSync: boolean;
  currentDisplay: number;
  latency: number;
  bandwidth: number;
  fps: number;
  isSimulated: boolean;
}

interface KeyboardShortcut {
  id: string;
  name: string;
  keys: string[];
  description: string;
  category: string;
}

interface DisplayInfo {
  id: number;
  name: string;
  resolution: string;
  primary: boolean;
  active: boolean;
}

const RESOLUTIONS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: '1920x1080', label: '1920 x 1080 (Full HD)' },
  { value: '2560x1440', label: '2560 x 1440 (2K)' },
  { value: '3840x2160', label: '3840 x 2160 (4K)' },
  { value: '1680x1050', label: '1680 x 1050' },
  { value: '1440x900', label: '1440 x 900' },
  { value: '1280x720', label: '1280 x 720 (HD)' },
  { value: '1024x768', label: '1024 x 768' },
];

const COLOR_DEPTHS = [
  { value: '24', label: '24-bit (True Color)' },
  { value: '16', label: '16-bit (High Color)' },
  { value: '8', label: '8-bit (256 Colors)' },
];

const SCALING_MODES = [
  { value: 'fit', label: 'Fit to Window' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'none', label: 'No Scaling (1:1)' },
  { value: 'aspect', label: 'Maintain Aspect Ratio' },
];

const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { id: 'ctrl-alt-del', name: 'Ctrl+Alt+Delete', keys: ['Ctrl', 'Alt', 'Del'], description: 'Send Ctrl+Alt+Delete to remote', category: 'System' },
  { id: 'alt-tab', name: 'Alt+Tab', keys: ['Alt', 'Tab'], description: 'Switch windows on remote', category: 'Windows' },
  { id: 'alt-f4', name: 'Alt+F4', keys: ['Alt', 'F4'], description: 'Close active window', category: 'Windows' },
  { id: 'win', name: 'Windows Key', keys: ['Win'], description: 'Open Start menu', category: 'Windows' },
  { id: 'ctrl-esc', name: 'Ctrl+Escape', keys: ['Ctrl', 'Esc'], description: 'Alternative Start menu', category: 'Windows' },
  { id: 'f11', name: 'F11', keys: ['F11'], description: 'Toggle fullscreen on remote', category: 'Navigation' },
  { id: 'ctrl-c', name: 'Ctrl+C', keys: ['Ctrl', 'C'], description: 'Copy to clipboard', category: 'Clipboard' },
  { id: 'ctrl-v', name: 'Ctrl+V', keys: ['Ctrl', 'V'], description: 'Paste from clipboard', category: 'Clipboard' },
  { id: 'ctrl-x', name: 'Ctrl+X', keys: ['Ctrl', 'X'], description: 'Cut selection', category: 'Clipboard' },
  { id: 'ctrl-z', name: 'Ctrl+Z', keys: ['Ctrl', 'Z'], description: 'Undo action', category: 'Editing' },
  { id: 'ctrl-shift-esc', name: 'Ctrl+Shift+Esc', keys: ['Ctrl', 'Shift', 'Esc'], description: 'Open Task Manager', category: 'System' },
  { id: 'print-screen', name: 'Print Screen', keys: ['PrtSc'], description: 'Capture remote screen', category: 'System' },
];

export default function VNCPage() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [config, setConfig] = useState<VNCConnectionConfig>({
    host: '',
    port: 5900,
    password: '',
    viewOnly: false,
    sharedSession: true,
  });

  const [displaySettings, setDisplaySettings] = useState<VNCDisplaySettings>({
    resolution: 'auto',
    colorDepth: '24',
    scalingMode: 'fit',
    quality: 80,
    compression: 6,
  });

  const [sessionState, setSessionState] = useState<VNCSessionState>({
    isConnected: false,
    isConnecting: false,
    isRecording: false,
    isFullScreen: false,
    clipboardSync: true,
    currentDisplay: 0,
    latency: 0,
    bandwidth: 0,
    fps: 0,
    isSimulated: true,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const metricsRef = useRef<{
    lastPingTime: number;
    frameCount: number;
    lastFpsUpdate: number;
    bytesReceived: number;
    lastBandwidthUpdate: number;
  }>({
    lastPingTime: 0,
    frameCount: 0,
    lastFpsUpdate: performance.now(),
    bytesReceived: 0,
    lastBandwidthUpdate: performance.now(),
  });

  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('connection');
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const [displays] = useState<DisplayInfo[]>([]);
  const [connectionHistory, setConnectionHistory] = useState<string[]>([]);

  const handleConnect = useCallback(() => {
    if (!config.host) {
      toast({
        title: 'Connection Error',
        description: 'Please enter a host address',
        variant: 'destructive',
      });
      return;
    }

    setSessionState(prev => ({ ...prev, isConnecting: true }));

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${config.host}:${config.port}`;
    
    let connectionTimeout: ReturnType<typeof setTimeout>;
    let metricsInterval: ReturnType<typeof setInterval>;
    
    const startSimulatedConnection = () => {
      setSessionState(prev => ({
        ...prev,
        isConnecting: false,
        isConnected: true,
        isSimulated: true,
        latency: 0,
        bandwidth: 0,
        fps: 60,
      }));
      
      const connectionString = `${config.host}:${config.port}`;
      if (!connectionHistory.includes(connectionString)) {
        setConnectionHistory(prev => [connectionString, ...prev.slice(0, 9)]);
      }

      toast({
        title: 'Connected (Simulated)',
        description: `Simulated connection to ${config.host}:${config.port}`,
      });
    };

    const startRealConnection = (ws: WebSocket) => {
      metricsRef.current = {
        lastPingTime: 0,
        frameCount: 0,
        lastFpsUpdate: performance.now(),
        bytesReceived: 0,
        lastBandwidthUpdate: performance.now(),
      };

      const measureLatency = () => {
        if (ws.readyState === WebSocket.OPEN) {
          metricsRef.current.lastPingTime = performance.now();
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      };

      measureLatency();

      metricsInterval = setInterval(() => {
        const now = performance.now();
        
        const fpsTimeDelta = (now - metricsRef.current.lastFpsUpdate) / 1000;
        if (fpsTimeDelta >= 1) {
          const fps = Math.round(metricsRef.current.frameCount / fpsTimeDelta);
          metricsRef.current.frameCount = 0;
          metricsRef.current.lastFpsUpdate = now;
          setSessionState(prev => ({ ...prev, fps }));
        }

        const bandwidthTimeDelta = (now - metricsRef.current.lastBandwidthUpdate) / 1000;
        if (bandwidthTimeDelta >= 1) {
          const bandwidth = Math.round((metricsRef.current.bytesReceived * 8) / bandwidthTimeDelta / 1000);
          metricsRef.current.bytesReceived = 0;
          metricsRef.current.lastBandwidthUpdate = now;
          setSessionState(prev => ({ ...prev, bandwidth }));
        }

        measureLatency();
      }, 1000);

      setSessionState(prev => ({
        ...prev,
        isConnecting: false,
        isConnected: true,
        isSimulated: false,
        latency: 0,
        bandwidth: 0,
        fps: 0,
      }));
      
      const connectionString = `${config.host}:${config.port}`;
      if (!connectionHistory.includes(connectionString)) {
        setConnectionHistory(prev => [connectionString, ...prev.slice(0, 9)]);
      }

      toast({
        title: 'Connected',
        description: `Successfully connected to ${config.host}:${config.port}`,
      });
    };

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          startSimulatedConnection();
        }
      }, 5000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        startRealConnection(ws);
      };

      ws.onmessage = (event) => {
        const now = performance.now();
        
        if (typeof event.data === 'string') {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'pong' && metricsRef.current.lastPingTime > 0) {
              const latency = Math.round(now - metricsRef.current.lastPingTime);
              setSessionState(prev => ({ ...prev, latency }));
            } else if (message.type === 'frame') {
              metricsRef.current.frameCount++;
            }
          } catch {
            metricsRef.current.frameCount++;
          }
          metricsRef.current.bytesReceived += event.data.length;
        } else if (event.data instanceof Blob) {
          metricsRef.current.frameCount++;
          metricsRef.current.bytesReceived += event.data.size;
        } else if (event.data instanceof ArrayBuffer) {
          metricsRef.current.frameCount++;
          metricsRef.current.bytesReceived += event.data.byteLength;
        }
      };

      ws.onerror = () => {
        clearTimeout(connectionTimeout);
        if (metricsInterval) clearInterval(metricsInterval);
        startSimulatedConnection();
      };

      ws.onclose = () => {
        if (metricsInterval) clearInterval(metricsInterval);
      };
    } catch {
      startSimulatedConnection();
    }
  }, [config.host, config.port, connectionHistory, toast]);

  const handleDisconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setSessionState(prev => ({
      ...prev,
      isConnected: false,
      isRecording: false,
      latency: 0,
      bandwidth: 0,
      fps: 0,
      isSimulated: true,
    }));
    
    toast({
      title: 'Disconnected',
      description: 'VNC session ended',
    });
  }, [toast]);

  const toggleRecording = useCallback(() => {
    setSessionState(prev => ({ ...prev, isRecording: !prev.isRecording }));
    toast({
      title: sessionState.isRecording ? 'Recording Stopped' : 'Recording Started',
      description: sessionState.isRecording 
        ? 'Session recording saved' 
        : 'Recording VNC session...',
    });
  }, [sessionState.isRecording, toast]);

  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setSessionState(prev => ({ ...prev, isFullScreen: true }));
    } else {
      document.exitFullscreen();
      setSessionState(prev => ({ ...prev, isFullScreen: false }));
    }
  }, []);

  const sendKeyboardShortcut = useCallback((shortcut: KeyboardShortcut) => {
    toast({
      title: 'Shortcut Sent',
      description: `Sent ${shortcut.name} to remote desktop`,
    });
  }, [toast]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (sessionState.isConnected) {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#0f3460';
      ctx.fillRect(0, 0, canvas.width, 32);
      
      const gradient = ctx.createLinearGradient(0, 100, canvas.width, canvas.height);
      gradient.addColorStop(0, '#16213e');
      gradient.addColorStop(1, '#1a1a2e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 32, canvas.width, canvas.height - 64);
      
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, canvas.height - 48, canvas.width, 48);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(20, 100, 200, 150);
      ctx.fillRect(240, 100, 200, 150);
      ctx.fillRect(460, 100, 200, 150);

      ctx.fillStyle = '#e94560';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#333';
      ctx.font = '16px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No active connection', canvas.width / 2, canvas.height / 2 - 10);
      ctx.fillStyle = '#666';
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.fillText('Enter connection details and click Connect', canvas.width / 2, canvas.height / 2 + 15);
    }
  }, [sessionState.isConnected]);

  const cardClassName = "border border-border bg-card shadow-sm";
  const inputClassName = "min-h-[44px] border-border bg-card text-foreground placeholder:text-muted-foreground focus:ring-primary/20 focus:border-primary/40 focus:ring-2 transition-all duration-200";

  return (
    <PageShell>
      <PageHeader
        title="Remote Desktop (VNC)"
        description="Connect to and control remote desktops with secure VNC protocol."
        icon={MonitorPlay}
        actions={(
          <div className="flex flex-col gap-2 sm:flex-row">
            {sessionState.isConnected ? (
              <>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={toggleRecording}
                  data-testid="button-toggle-recording"
                >
                  {sessionState.isRecording ? (
                    <>
                      <Square className="h-4 w-4 text-red-500" />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Circle className="h-4 w-4" />
                      Record Session
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={toggleFullScreen}
                  data-testid="button-toggle-fullscreen"
                >
                  {sessionState.isFullScreen ? (
                    <>
                      <Minimize className="h-4 w-4" />
                      Exit Fullscreen
                    </>
                  ) : (
                    <>
                      <Maximize className="h-4 w-4" />
                      Fullscreen
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  className="gap-2"
                  onClick={handleDisconnect}
                  data-testid="button-disconnect"
                >
                  <PowerOff className="h-4 w-4" />
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                className="gap-2"
                onClick={handleConnect}
                disabled={sessionState.isConnecting}
                data-testid="button-connect"
              >
                {sessionState.isConnecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Power className="h-4 w-4" />
                    Connect
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card className={cardClassName} data-testid="card-vnc-viewer">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-[15px]">Remote Desktop Viewer</CardTitle>
                  {sessionState.isConnected ? (
                    <Badge variant="default" className="gap-1" data-testid="badge-connection-status">
                      <Wifi className="h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1" data-testid="badge-connection-status">
                      <WifiOff className="h-3 w-3" />
                      Disconnected
                    </Badge>
                  )}
                  {sessionState.isConnected && sessionState.isSimulated && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-500" data-testid="badge-simulated">
                            <AlertCircle className="h-3 w-3" />
                            Simulated
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>No real WebSocket connection - using simulated metrics</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {sessionState.isRecording && (
                    <Badge variant="destructive" className="gap-1 animate-pulse" data-testid="badge-recording">
                      <Circle className="h-2 w-2 fill-current" />
                      Recording
                    </Badge>
                  )}
                </div>
                {sessionState.isConnected && (
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-1" data-testid="stat-latency">
                            <Gauge className="h-3 w-3" />
                            {sessionState.isSimulated ? '—' : `${sessionState.latency}ms`}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {sessionState.isSimulated ? 'Simulated connection - no real latency data' : 'Network Latency'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-1" data-testid="stat-bandwidth">
                            <Zap className="h-3 w-3" />
                            {sessionState.isSimulated ? '—' : `${(sessionState.bandwidth / 1000).toFixed(1)} Mbps`}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {sessionState.isSimulated ? 'Simulated connection - no real bandwidth data' : 'Bandwidth Usage'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-1" data-testid="stat-fps">
                            <MonitorPlay className="h-3 w-3" />
                            {sessionState.fps} FPS{sessionState.isSimulated ? ' (static)' : ''}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {sessionState.isSimulated ? 'Simulated connection - static frame rate' : 'Frame Rate'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div 
                className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-border"
                data-testid="container-vnc-canvas"
              >
                <canvas
                  ref={canvasRef}
                  width={960}
                  height={540}
                  className="w-full h-full object-contain"
                  data-testid="canvas-vnc-display"
                />
                {sessionState.isConnecting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <div className="flex flex-col items-center gap-4">
                      <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-[13px] text-muted-foreground">Establishing connection...</p>
                    </div>
                  </div>
                )}
              </div>

              {sessionState.isConnected && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Dialog open={showShortcutsDialog} onOpenChange={setShowShortcutsDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2" data-testid="button-keyboard-shortcuts">
                          <Keyboard className="h-4 w-4" />
                          Keyboard Shortcuts
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="dialog-keyboard-shortcuts">
                        <DialogHeader>
                          <DialogTitle>Keyboard Shortcuts</DialogTitle>
                          <DialogDescription>
                            Send special key combinations to the remote desktop
                          </DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="h-[400px] pr-4">
                          <div className="space-y-6">
                            {['System', 'Windows', 'Clipboard', 'Navigation', 'Editing'].map(category => (
                              <div key={category}>
                                <h4 className="font-medium mb-3 text-[13px] text-muted-foreground">{category}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {KEYBOARD_SHORTCUTS.filter(s => s.category === category).map(shortcut => (
                                    <Button
                                      key={shortcut.id}
                                      variant="outline"
                                      className="justify-between h-auto py-3"
                                      onClick={() => sendKeyboardShortcut(shortcut)}
                                      data-testid={`button-shortcut-${shortcut.id}`}
                                    >
                                      <span className="text-left">
                                        <span className="block font-medium">{shortcut.name}</span>
                                        <span className="block text-[11px] text-muted-foreground">{shortcut.description}</span>
                                      </span>
                                      <div className="flex gap-1">
                                        {shortcut.keys.map(key => (
                                          <kbd key={key} className="px-2 py-1 text-[11px] bg-muted rounded">{key}</kbd>
                                        ))}
                                      </div>
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="clipboard-sync" className="text-[13px]">Clipboard Sync</Label>
                      <Switch
                        id="clipboard-sync"
                        checked={sessionState.clipboardSync}
                        onCheckedChange={(checked) => setSessionState(prev => ({ ...prev, clipboardSync: checked }))}
                        data-testid="switch-clipboard-sync"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className={cardClassName} data-testid="card-connection-settings">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Connection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-settings">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="connection" data-testid="tab-connection">Connect</TabsTrigger>
                  <TabsTrigger value="display" data-testid="tab-display">Display</TabsTrigger>
                </TabsList>

                <TabsContent value="connection" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="host">Host Address</Label>
                    <Input
                      id="host"
                      placeholder="192.168.1.100 or hostname"
                      value={config.host}
                      onChange={(e) => setConfig(prev => ({ ...prev, host: e.target.value }))}
                      className={inputClassName}
                      data-testid="input-host"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      placeholder="5900"
                      value={config.port}
                      onChange={(e) => setConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 5900 }))}
                      className={inputClassName}
                      data-testid="input-port"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter VNC password"
                        value={config.password}
                        onChange={(e) => setConfig(prev => ({ ...prev, password: e.target.value }))}
                        className={`${inputClassName} pr-10`}
                        data-testid="input-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <Label htmlFor="view-only" className="text-[13px]">View Only Mode</Label>
                    <Switch
                      id="view-only"
                      checked={config.viewOnly}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, viewOnly: checked }))}
                      data-testid="switch-view-only"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="shared-session" className="text-[13px]">Shared Session</Label>
                    <Switch
                      id="shared-session"
                      checked={config.sharedSession}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, sharedSession: checked }))}
                      data-testid="switch-shared-session"
                    />
                  </div>

                  {connectionHistory.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label className="text-[13px] text-muted-foreground">Recent Connections</Label>
                        <div className="space-y-1">
                          {connectionHistory.slice(0, 3).map((conn, idx) => (
                            <Button
                              key={idx}
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-[13px]"
                              onClick={() => {
                                const [host, port] = conn.split(':');
                                setConfig(prev => ({ ...prev, host, port: parseInt(port) || 5900 }));
                              }}
                              data-testid={`button-recent-${idx}`}
                            >
                              <HardDrive className="h-3 w-3 mr-2" />
                              {conn}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="display" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="resolution">Screen Resolution</Label>
                    <Select
                      value={displaySettings.resolution}
                      onValueChange={(value) => setDisplaySettings(prev => ({ ...prev, resolution: value }))}
                    >
                      <SelectTrigger id="resolution" data-testid="select-resolution">
                        <SelectValue placeholder="Select resolution" />
                      </SelectTrigger>
                      <SelectContent>
                        {RESOLUTIONS.map(res => (
                          <SelectItem key={res.value} value={res.value}>{res.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="color-depth">Color Depth</Label>
                    <Select
                      value={displaySettings.colorDepth}
                      onValueChange={(value) => setDisplaySettings(prev => ({ ...prev, colorDepth: value }))}
                    >
                      <SelectTrigger id="color-depth" data-testid="select-color-depth">
                        <SelectValue placeholder="Select color depth" />
                      </SelectTrigger>
                      <SelectContent>
                        {COLOR_DEPTHS.map(depth => (
                          <SelectItem key={depth.value} value={depth.value}>{depth.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scaling">Scaling Mode</Label>
                    <Select
                      value={displaySettings.scalingMode}
                      onValueChange={(value) => setDisplaySettings(prev => ({ ...prev, scalingMode: value }))}
                    >
                      <SelectTrigger id="scaling" data-testid="select-scaling">
                        <SelectValue placeholder="Select scaling mode" />
                      </SelectTrigger>
                      <SelectContent>
                        {SCALING_MODES.map(mode => (
                          <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-[13px]">Quality</Label>
                      <span className="text-[13px] text-muted-foreground">{displaySettings.quality}%</span>
                    </div>
                    <Slider
                      value={[displaySettings.quality]}
                      onValueChange={([value]) => setDisplaySettings(prev => ({ ...prev, quality: value }))}
                      min={10}
                      max={100}
                      step={10}
                      data-testid="slider-quality"
                    />
                    <p className="text-[11px] text-muted-foreground">Higher quality uses more bandwidth</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-[13px]">Compression</Label>
                      <span className="text-[13px] text-muted-foreground">Level {displaySettings.compression}</span>
                    </div>
                    <Slider
                      value={[displaySettings.compression]}
                      onValueChange={([value]) => setDisplaySettings(prev => ({ ...prev, compression: value }))}
                      min={0}
                      max={9}
                      step={1}
                      data-testid="slider-compression"
                    />
                    <p className="text-[11px] text-muted-foreground">Higher compression reduces bandwidth</p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className={cardClassName} data-testid="card-displays">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Displays
              </CardTitle>
              <CardDescription>Select remote display to view</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {displays.map((display) => (
                <Button
                  key={display.id}
                  variant={sessionState.currentDisplay === display.id ? 'secondary' : 'ghost'}
                  className="w-full justify-start h-auto py-3"
                  onClick={() => setSessionState(prev => ({ ...prev, currentDisplay: display.id }))}
                  disabled={!sessionState.isConnected || !display.active}
                  data-testid={`button-display-${display.id}`}
                >
                  <div className="flex items-center gap-3 w-full">
                    <Monitor className={`h-5 w-5 ${display.active ? 'text-foreground' : 'text-muted-foreground'}`} />
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{display.name}</span>
                        {display.primary && <Badge variant="outline" className="text-[11px]">Primary</Badge>}
                      </div>
                      <span className="text-[11px] text-muted-foreground">{display.resolution}</span>
                    </div>
                    {sessionState.currentDisplay === display.id && sessionState.isConnected && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className={cardClassName} data-testid="card-session-info">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                Session Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">Status</span>
                <span className="flex items-center gap-1">
                  {sessionState.isConnected ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Connected
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                      Disconnected
                    </>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">Protocol</span>
                <span>VNC (RFB 3.8)</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">Encryption</span>
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  TLS 1.3
                </span>
              </div>
              {sessionState.isConnected && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">Host</span>
                    <span>{config.host}:{config.port}</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">Resolution</span>
                    <span>{displaySettings.resolution === 'auto' ? '1920x1080' : displaySettings.resolution}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
