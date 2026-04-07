import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Terminal, 
  Network, 
  Code2, 
  Activity, 
  Settings,
  Search,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  Bug,
  Info,
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronDown,
  Copy,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ConsoleMessage {
  id: string;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: Date;
  source?: string;
  stack?: string;
  count?: number;
}

interface RequestBody {
  [key: string]: unknown;
}

interface NetworkRequest {
  id: string;
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  type: string;
  size?: number;
  time?: number;
  timestamp: Date;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: RequestBody;
  responseBody?: RequestBody;
}

interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  attributes: Record<string, string>;
  computedStyles?: Record<string, string>;
  dimensions?: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
}

interface PreviewDevToolsProps {
  previewUrl?: string;
  projectId?: number;
  onClose?: () => void;
}

export function PreviewDevTools({ previewUrl, projectId, onClose }: PreviewDevToolsProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('console');
  const [isMinimized, setIsMinimized] = useState(false);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [networkRequests, setNetworkRequests] = useState<NetworkRequest[]>([]);
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [consoleFilter, setConsoleFilter] = useState('all');
  const [networkFilter, setNetworkFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Connect to preview WebSocket for dev tools data
  useEffect(() => {
    if (!previewUrl) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/preview-devtools/${projectId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Connected to preview dev tools
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'console':
          handleConsoleMessage(data.payload);
          break;
        case 'network':
          handleNetworkRequest(data.payload);
          break;
        case 'performance':
          handlePerformanceUpdate(data.payload);
          break;
        case 'element':
          setSelectedElement(data.payload);
          break;
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [previewUrl, projectId]);

  // Auto-scroll console to bottom
  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleMessages, autoScroll]);

  const handleConsoleMessage = (message: ConsoleMessage) => {
    setConsoleMessages(prev => {
      // Group identical messages
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.message === message.message && lastMessage.level === message.level) {
        return [
          ...prev.slice(0, -1),
          { ...lastMessage, count: (lastMessage.count || 1) + 1 }
        ];
      }
      return [...prev, { ...message, id: Date.now().toString(), timestamp: new Date() }];
    });
  };

  const handleNetworkRequest = (request: NetworkRequest) => {
    setNetworkRequests(prev => {
      const existingIndex = prev.findIndex(r => r.id === request.id);
      if (existingIndex !== -1) {
        // Update existing request
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...request };
        return updated;
      }
      return [...prev, { ...request, timestamp: new Date() }];
    });
  };

  const handlePerformanceUpdate = (metrics: PerformanceMetric[]) => {
    setPerformanceMetrics(metrics);
  };

  const clearConsole = () => {
    setConsoleMessages([]);
    toast({
      title: "Console Cleared",
      description: "All console messages have been removed",
    });
  };

  const clearNetwork = () => {
    setNetworkRequests([]);
    toast({
      title: "Network Log Cleared",
      description: "All network requests have been removed",
    });
  };

  const exportLogs = () => {
    const logs = {
      console: consoleMessages,
      network: networkRequests,
      performance: performanceMetrics,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devtools-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startElementInspection = () => {
    setIsInspecting(true);
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'startInspect' }));
    }
  };

  const stopElementInspection = () => {
    setIsInspecting(false);
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'stopInspect' }));
    }
  };

  const getConsoleIcon = (level: ConsoleMessage['level']) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'debug':
        return <Bug className="h-4 w-4 text-gray-500" />;
      default:
        return <ChevronRight className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status?: number) => {
    if (!status) return 'text-gray-500';
    if (status >= 200 && status < 300) return 'text-green-500';
    if (status >= 300 && status < 400) return 'text-blue-500';
    if (status >= 400 && status < 500) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-green-100 text-green-800';
      case 'POST':
        return 'bg-blue-100 text-blue-800';
      case 'PUT':
        return 'bg-yellow-100 text-yellow-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredConsoleMessages = consoleMessages.filter(msg => {
    if (consoleFilter !== 'all' && msg.level !== consoleFilter) return false;
    if (searchQuery && !msg.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredNetworkRequests = networkRequests.filter(req => {
    if (networkFilter !== 'all' && req.type !== networkFilter) return false;
    if (searchQuery && !req.url.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="shadow-lg"
        >
          <Maximize2 className="h-4 w-4 mr-2" />
          Developer Tools
        </Button>
      </div>
    );
  }

  return (
    <Card className="fixed bottom-0 left-0 right-0 z-50 h-[400px] border-t-2 shadow-2xl">
      <CardHeader className="py-2 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[13px] font-medium flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Preview Developer Tools
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={exportLogs}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsMinimized(true)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            {onClose && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
              >
                ×
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 h-[calc(100%-3rem)]">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="w-full justify-start rounded-none border-b">
            <TabsTrigger value="console" className="gap-2">
              <Terminal className="h-4 w-4" />
              Console
              {consoleMessages.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5">
                  {consoleMessages.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="network" className="gap-2">
              <Network className="h-4 w-4" />
              Network
              {networkRequests.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5">
                  {networkRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="elements" className="gap-2">
              <Code2 className="h-4 w-4" />
              Elements
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-2">
              <Activity className="h-4 w-4" />
              Performance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="console" className="h-[calc(100%-2.5rem)] p-0">
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 p-2 border-b">
                <Select value={consoleFilter} onValueChange={setConsoleFilter}>
                  <SelectTrigger className="w-[120px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="log">Logs</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warn">Warnings</SelectItem>
                    <SelectItem value="error">Errors</SelectItem>
                    <SelectItem value="debug">Debug</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex-1 relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter console messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8"
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={cn(autoScroll && "bg-accent")}
                >
                  Auto-scroll
                </Button>
                <Button size="sm" variant="ghost" onClick={clearConsole}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1 font-mono text-[11px]">
                  {filteredConsoleMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex items-start gap-2 p-2 rounded hover:bg-surface-hover-solid",
                        msg.level === 'error' && "bg-red-50 dark:bg-surface-tertiary-solid",
                        msg.level === 'warn' && "bg-yellow-50 dark:bg-surface-tertiary-solid"
                      )}
                    >
                      {getConsoleIcon(msg.level)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "break-all",
                            msg.level === 'error' && "text-red-600 dark:text-red-400",
                            msg.level === 'warn' && "text-yellow-600 dark:text-yellow-400"
                          )}>
                            {msg.message}
                          </span>
                          {msg.count && msg.count > 1 && (
                            <Badge variant="secondary" className="h-4 px-1 text-[11px]">
                              {msg.count}
                            </Badge>
                          )}
                        </div>
                        {msg.stack && (
                          <pre className="mt-1 text-[11px] text-muted-foreground overflow-x-auto">
                            {msg.stack}
                          </pre>
                        )}
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {msg.timestamp.toLocaleTimeString()}
                          {msg.source && (
                            <>
                              <Separator orientation="vertical" className="h-3" />
                              <span>{msg.source}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="network" className="h-[calc(100%-2.5rem)] p-0">
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 p-2 border-b">
                <Select value={networkFilter} onValueChange={setNetworkFilter}>
                  <SelectTrigger className="w-[120px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="xhr">XHR</SelectItem>
                    <SelectItem value="fetch">Fetch</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="css">CSS</SelectItem>
                    <SelectItem value="js">JS</SelectItem>
                    <SelectItem value="img">Images</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="font">Fonts</SelectItem>
                    <SelectItem value="ws">WebSocket</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex-1 relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter network requests..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8"
                  />
                </div>
                <Button size="sm" variant="ghost" onClick={clearNetwork}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Method</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-right p-2">Size</th>
                      <th className="text-right p-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNetworkRequests.map((req) => (
                      <tr key={req.id} className="border-b hover:bg-surface-hover-solid cursor-pointer">
                        <td className="p-2 max-w-[300px] truncate" title={req.url}>
                          {req.url.split('/').pop() || req.url}
                        </td>
                        <td className={cn("p-2", getStatusColor(req.status))}>
                          {req.status || 'Pending'}
                        </td>
                        <td className="p-2">
                          <Badge variant="outline" className={cn("text-[11px]", getMethodColor(req.method))}>
                            {req.method}
                          </Badge>
                        </td>
                        <td className="p-2 text-muted-foreground">{req.type}</td>
                        <td className="p-2 text-right text-muted-foreground">
                          {req.size ? `${(req.size / 1024).toFixed(1)} KB` : '-'}
                        </td>
                        <td className="p-2 text-right text-muted-foreground">
                          {req.time ? `${req.time} ms` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="elements" className="h-[calc(100%-2.5rem)] p-0">
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 p-2 border-b">
                <Button
                  size="sm"
                  variant={isInspecting ? "default" : "outline"}
                  onClick={isInspecting ? stopElementInspection : startElementInspection}
                >
                  <Search className="h-4 w-4 mr-2" />
                  {isInspecting ? "Stop Inspecting" : "Select Element"}
                </Button>
              </div>
              <ScrollArea className="flex-1 p-4">
                {selectedElement ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-[13px] font-medium mb-2">Element</h3>
                      <div className="bg-muted p-2 rounded font-mono text-[11px]">
                        &lt;{selectedElement.tagName.toLowerCase()}
                        {selectedElement.id && ` id="${selectedElement.id}"`}
                        {selectedElement.className && ` class="${selectedElement.className}"`}
                        &gt;
                      </div>
                    </div>

                    {Object.keys(selectedElement.attributes).length > 0 && (
                      <div>
                        <h3 className="text-[13px] font-medium mb-2">Attributes</h3>
                        <div className="space-y-1">
                          {Object.entries(selectedElement.attributes).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-2 text-[11px]">
                              <span className="font-medium">{key}:</span>
                              <span className="text-muted-foreground">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedElement.dimensions && (
                      <div>
                        <h3 className="text-[13px] font-medium mb-2">Dimensions</h3>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="font-medium">Width:</span> {selectedElement.dimensions.width}px
                          </div>
                          <div>
                            <span className="font-medium">Height:</span> {selectedElement.dimensions.height}px
                          </div>
                          <div>
                            <span className="font-medium">X:</span> {selectedElement.dimensions.x}px
                          </div>
                          <div>
                            <span className="font-medium">Y:</span> {selectedElement.dimensions.y}px
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedElement.computedStyles && Object.keys(selectedElement.computedStyles).length > 0 && (
                      <div>
                        <h3 className="text-[13px] font-medium mb-2">Computed Styles</h3>
                        <ScrollArea className="h-[150px] border rounded p-2">
                          <div className="space-y-1">
                            {Object.entries(selectedElement.computedStyles).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2 text-[11px]">
                                <span className="font-medium">{key}:</span>
                                <span className="text-muted-foreground">{value}</span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Code2 className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-[13px]">Click "Select Element" to inspect an element</p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="h-[calc(100%-2.5rem)] p-0">
            <ScrollArea className="h-full p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-[13px] font-medium mb-3">Performance Metrics</h3>
                  <div className="grid gap-3">
                    {performanceMetrics.map((metric) => (
                      <div key={metric.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-medium">{metric.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px]">
                              {metric.value} {metric.unit}
                            </span>
                            <Badge variant={
                              metric.status === 'good' ? 'default' :
                              metric.status === 'warning' ? 'secondary' : 'destructive'
                            }>
                              {metric.status}
                            </Badge>
                          </div>
                        </div>
                        <Progress 
                          value={Math.min((metric.value / 100) * 100, 100)} 
                          className={cn(
                            "h-2",
                            metric.status === 'good' && "[&>div]:bg-green-500",
                            metric.status === 'warning' && "[&>div]:bg-yellow-500",
                            metric.status === 'critical' && "[&>div]:bg-red-500"
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-[13px] font-medium mb-3">Real-time Monitoring</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">FPS</span>
                          <Activity className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-2xl font-bold">60</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">Memory</span>
                          <Activity className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-2xl font-bold">128 MB</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}