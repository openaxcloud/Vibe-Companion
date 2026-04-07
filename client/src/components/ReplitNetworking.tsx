import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Network,
  Send,
  Globe,
  Activity,
  Wifi,
  WifiOff,
  AlertCircle,
  Check,
  X,
  Play,
  Pause,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronRight,
  Download,
  Upload,
  Clock,
  Server,
  Shield,
  Zap,
  Settings,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface NetworkRequest {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  url: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: Date;
  status?: number;
  statusText?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  responseTime?: number;
  error?: string;
}

interface ReplitNetworkingProps {
  projectId: number;
  className?: string;
}

export function ReplitNetworking({ projectId, className }: ReplitNetworkingProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'http' | 'websocket' | 'monitor'>('http');
  const [requests, setRequests] = useState<NetworkRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<NetworkRequest | null>(null);
  const [isRecording, setIsRecording] = useState(true);
  
  // HTTP Request State
  const [method, setMethod] = useState<NetworkRequest['method']>('GET');
  const [url, setUrl] = useState('https://api.example.com/data');
  const [headers, setHeaders] = useState('Content-Type: application/json');
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // WebSocket State
  const [wsUrl, setWsUrl] = useState('wss://echo.websocket.org');
  const [wsConnected, setWsConnected] = useState(false);
  const [wsMessages, setWsMessages] = useState<Array<{ type: 'sent' | 'received'; data: string; timestamp: Date }>>([]);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [wsMessage, setWsMessage] = useState('');

  // Network Monitoring
  const { data: networkStats } = useQuery({
    queryKey: [`/api/network/${projectId}/stats`],
    refetchInterval: isRecording ? 5000 : false,
  });

  // Send HTTP Request
  const sendRequest = async () => {
    setIsLoading(true);
    const startTime = Date.now();
    
    const newRequest: NetworkRequest = {
      id: Date.now().toString(),
      method,
      url,
      headers: parseHeaders(headers),
      body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
      timestamp: new Date(),
    };

    try {
      // Make real request through proxy
      const response = await proxyHttpRequest.mutateAsync(newRequest);
      
      newRequest.status = response.status;
      newRequest.statusText = response.statusText;
      newRequest.responseHeaders = response.headers;
      newRequest.responseBody = response.body;
      newRequest.responseTime = response.responseTime || Date.now() - startTime;
      
      setRequests(prev => [newRequest, ...prev]);
      setSelectedRequest(newRequest);
      
      toast({
        title: 'Request Sent',
        description: `${method} ${url} - ${response.status} ${response.statusText}`,
      });
    } catch (error) {
      newRequest.error = error instanceof Error ? error.message : 'Request failed';
      newRequest.responseTime = Date.now() - startTime;
      setRequests(prev => [newRequest, ...prev]);
      setSelectedRequest(newRequest);
      
      toast({
        title: 'Request Failed',
        description: newRequest.error,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Parse headers from text
  const parseHeaders = (text: string): Record<string, string> => {
    const headers: Record<string, string> = {};
    text.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        headers[key.trim()] = valueParts.join(':').trim();
      }
    });
    return headers;
  };

  // Real HTTP proxy request
  const proxyHttpRequest = useMutation({
    mutationFn: async (request: NetworkRequest) => {
      const response = await apiRequest('POST', `/api/network/${projectId}/proxy`, {
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,
        projectId
      });
      
      // Parse response based on Content-Type
      const contentType = response.headers.get('content-type') || '';
      let body: string;
      let responseTime = 0;
      
      try {
        if (contentType.includes('application/json')) {
          const data = await response.json();
          body = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
          responseTime = data.responseTime || 0;
        } else {
          // For non-JSON responses (HTML, XML, plain text, etc.), use text
          body = await response.text();
        }
      } catch (error) {
        // Fallback to text if JSON parsing fails
        body = await response.text();
      }
      
      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body,
        responseTime
      };
    }
  });

  // WebSocket Connection
  const connectWebSocket = () => {
    if (wsConnection) {
      wsConnection.close();
    }

    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setWsConnected(true);
        setWsMessages(prev => [...prev, {
          type: 'received',
          data: 'Connected to ' + wsUrl,
          timestamp: new Date(),
        }]);
        toast({
          title: 'WebSocket Connected',
          description: 'Connection established successfully',
        });
      };

      ws.onmessage = (event) => {
        setWsMessages(prev => [...prev, {
          type: 'received',
          data: event.data,
          timestamp: new Date(),
        }]);
      };

      ws.onclose = () => {
        setWsConnected(false);
        setWsMessages(prev => [...prev, {
          type: 'received',
          data: 'Connection closed',
          timestamp: new Date(),
        }]);
      };

      ws.onerror = () => {
        toast({
          title: 'WebSocket Error',
          description: 'Failed to connect to WebSocket server',
          variant: 'destructive',
        });
      };

      setWsConnection(ws);
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: 'Invalid WebSocket URL',
        variant: 'destructive',
      });
    }
  };

  const disconnectWebSocket = () => {
    if (wsConnection) {
      wsConnection.close();
      setWsConnection(null);
    }
  };

  const sendWebSocketMessage = () => {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN && wsMessage) {
      wsConnection.send(wsMessage);
      setWsMessages(prev => [...prev, {
        type: 'sent',
        data: wsMessage,
        timestamp: new Date(),
      }]);
      setWsMessage('');
    }
  };

  // Copy response to clipboard
  const copyResponse = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Response copied to clipboard',
    });
  };

  // Export requests
  const exportRequests = () => {
    const data = JSON.stringify(requests, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-requests-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Exported',
      description: 'Network requests exported successfully',
    });
  };

  const getStatusColor = (status?: number) => {
    if (!status) return 'text-muted-foreground';
    if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400';
    if (status >= 300 && status < 400) return 'text-yellow-600 dark:text-yellow-400';
    if (status >= 400 && status < 500) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'POST': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'PUT': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
      case 'DELETE': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      case 'PATCH': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Networking
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isRecording ? 'default' : 'outline'}
              onClick={() => setIsRecording(!isRecording)}
            >
              {isRecording ? (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  Recording
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  Paused
                </>
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRequests([])}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Clear
            </Button>
            <Button size="sm" variant="outline" onClick={exportRequests}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
          <TabsList className="mx-6 mb-0">
            <TabsTrigger value="http">
              <Globe className="h-4 w-4 mr-1" />
              HTTP Client
            </TabsTrigger>
            <TabsTrigger value="websocket">
              <Activity className="h-4 w-4 mr-1" />
              WebSocket
            </TabsTrigger>
            <TabsTrigger value="monitor">
              <Shield className="h-4 w-4 mr-1" />
              Monitor
            </TabsTrigger>
          </TabsList>

          {/* HTTP Client Tab */}
          <TabsContent value="http" className="flex-1 flex flex-col p-6 pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
              {/* Request Builder */}
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                      <SelectItem value="HEAD">HEAD</SelectItem>
                      <SelectItem value="OPTIONS">OPTIONS</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Enter request URL"
                    className="flex-1"
                  />
                  <Button onClick={sendRequest} disabled={isLoading}>
                    <Send className="h-4 w-4 mr-1" />
                    Send
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Headers</Label>
                  <Textarea
                    value={headers}
                    onChange={(e) => setHeaders(e.target.value)}
                    placeholder="Content-Type: application/json&#10;Authorization: Bearer token"
                    className="font-mono text-[13px] h-24"
                  />
                </div>

                {method !== 'GET' && method !== 'HEAD' && (
                  <div className="space-y-2">
                    <Label>Body</Label>
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder='{"key": "value"}'
                      className="font-mono text-[13px] h-32"
                    />
                  </div>
                )}

                {/* Request History */}
                <div className="space-y-2">
                  <Label>History</Label>
                  <ScrollArea className="h-64 border rounded-lg p-2">
                    {requests.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        No requests yet
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {requests.map((req) => (
                          <button
                            key={req.id}
                            onClick={() => setSelectedRequest(req)}
                            className={cn(
                              'w-full text-left p-2 rounded hover:bg-muted transition-colors',
                              selectedRequest?.id === req.id && 'bg-muted'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={cn('text-[11px]', getMethodColor(req.method))}>
                                  {req.method}
                                </Badge>
                                <span className="text-[13px] truncate flex-1">
                                  {new URL(req.url).pathname}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px]">
                                <span className={getStatusColor(req.status)}>
                                  {req.status || '—'}
                                </span>
                                <span className="text-muted-foreground">
                                  {req.responseTime ? `${req.responseTime}ms` : '—'}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>

              {/* Response Viewer */}
              <div className="border rounded-lg p-4 space-y-4">
                {selectedRequest ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Response</h3>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(selectedRequest.status)}>
                          {selectedRequest.status} {selectedRequest.statusText}
                        </Badge>
                        {selectedRequest.responseTime && (
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            {selectedRequest.responseTime}ms
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyResponse(selectedRequest.responseBody || '')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {selectedRequest.error ? (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Request Failed</AlertTitle>
                        <AlertDescription>{selectedRequest.error}</AlertDescription>
                      </Alert>
                    ) : (
                      <Tabs defaultValue="body">
                        <TabsList>
                          <TabsTrigger value="body">Body</TabsTrigger>
                          <TabsTrigger value="headers">Headers</TabsTrigger>
                          <TabsTrigger value="raw">Raw</TabsTrigger>
                        </TabsList>
                        <TabsContent value="body">
                          <ScrollArea className="h-96 border rounded p-4">
                            <pre className="text-[13px]">
                              {selectedRequest.responseBody || 'No response body'}
                            </pre>
                          </ScrollArea>
                        </TabsContent>
                        <TabsContent value="headers">
                          <ScrollArea className="h-96 border rounded p-4">
                            <Table>
                              <TableBody>
                                {selectedRequest.responseHeaders && Object.entries(selectedRequest.responseHeaders).map(([key, value]) => (
                                  <TableRow key={key}>
                                    <TableCell className="font-medium">{key}</TableCell>
                                    <TableCell>{value}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        </TabsContent>
                        <TabsContent value="raw">
                          <ScrollArea className="h-96 border rounded p-4">
                            <pre className="text-[13px] font-mono">
                              {`${selectedRequest.method} ${selectedRequest.url}
${Object.entries(selectedRequest.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}

${selectedRequest.body || ''}`}
                            </pre>
                          </ScrollArea>
                        </TabsContent>
                      </Tabs>
                    )}
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-16">
                    <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Send a request to see the response</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* WebSocket Tab */}
          <TabsContent value="websocket" className="flex-1 flex flex-col p-6 pt-4">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                  placeholder="wss://echo.websocket.org"
                  className="flex-1"
                  disabled={wsConnected}
                />
                {wsConnected ? (
                  <Button variant="destructive" onClick={disconnectWebSocket}>
                    <WifiOff className="h-4 w-4 mr-1" />
                    Disconnect
                  </Button>
                ) : (
                  <Button onClick={connectWebSocket}>
                    <Wifi className="h-4 w-4 mr-1" />
                    Connect
                  </Button>
                )}
              </div>

              {wsConnected && (
                <div className="flex gap-2">
                  <Input
                    value={wsMessage}
                    onChange={(e) => setWsMessage(e.target.value)}
                    placeholder="Enter message to send"
                    onKeyDown={(e) => e.key === 'Enter' && sendWebSocketMessage()}
                  />
                  <Button onClick={sendWebSocketMessage}>
                    <Send className="h-4 w-4 mr-1" />
                    Send
                  </Button>
                </div>
              )}

              <ScrollArea className="h-96 border rounded-lg p-4">
                {wsMessages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No messages yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {wsMessages.map((msg, index) => (
                      <div
                        key={index}
                        className={cn(
                          'p-2 rounded',
                          msg.type === 'sent' ? 'bg-primary/10 ml-8' : 'bg-muted mr-8'
                        )}
                      >
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                          <span>{msg.type === 'sent' ? 'Sent' : 'Received'}</span>
                          <span>{msg.timestamp.toLocaleTimeString()}</span>
                        </div>
                        <pre className="text-[13px] whitespace-pre-wrap">{msg.data}</pre>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Network Monitor Tab */}
          <TabsContent value="monitor" className="flex-1 flex flex-col p-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] text-muted-foreground">Total Requests</p>
                      <p className="text-2xl font-bold">{requests.length}</p>
                    </div>
                    <Activity className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] text-muted-foreground">Success Rate</p>
                      <p className="text-2xl font-bold">
                        {requests.length > 0
                          ? Math.round((requests.filter(r => r.status && r.status < 400).length / requests.length) * 100)
                          : 0}%
                      </p>
                    </div>
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] text-muted-foreground">Avg Response Time</p>
                      <p className="text-2xl font-bold">
                        {requests.length > 0
                          ? Math.round(requests.reduce((acc, r) => acc + (r.responseTime || 0), 0) / requests.length)
                          : 0}ms
                      </p>
                    </div>
                    <Zap className="h-8 w-8 text-yellow-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] text-muted-foreground">Failed Requests</p>
                      <p className="text-2xl font-bold">
                        {requests.filter(r => r.error || (r.status && r.status >= 400)).length}
                      </p>
                    </div>
                    <X className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Network Activity</h3>
              <ScrollArea className="h-96 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Method</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Size</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((req) => (
                      <TableRow key={req.id} className="cursor-pointer hover:bg-muted">
                        <TableCell>
                          <Badge variant="outline" className={cn('text-[11px]', getMethodColor(req.method))}>
                            {req.method}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {req.url}
                        </TableCell>
                        <TableCell>
                          <span className={getStatusColor(req.status)}>
                            {req.status || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {req.responseTime ? `${req.responseTime}ms` : '—'}
                        </TableCell>
                        <TableCell>
                          {req.responseBody ? `${req.responseBody.length}B` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}