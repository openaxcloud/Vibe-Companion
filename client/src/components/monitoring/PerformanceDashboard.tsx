import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { Activity, AlertCircle, Clock, Cpu, HardDrive, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface PerformanceMetrics {
  requestsPerMinute: number;
  avgResponseTime: number;
  errorRate: number;
  currentMemoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  uptime: number;
}

interface EndpointRanking {
  endpoint: string;
  avgResponseTime: number;
  callCount: number;
  errorCount: number;
}

interface Bottleneck {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  endpoints?: EndpointRanking[];
  recommendation: string;
  usage?: any;
  percentage?: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function PerformanceDashboard() {
  const [realTimeMetrics, setRealTimeMetrics] = useState<PerformanceMetrics | null>(null);

  // Fetch real-time metrics
  const { data: metrics } = useQuery({
    queryKey: ['/api/monitoring/metrics'],
    refetchInterval: 30000, // RATE LIMIT FIX: Increased from 5s to 30s
    refetchIntervalInBackground: false,
  });

  // Fetch endpoint rankings
  const { data: endpoints } = useQuery({
    queryKey: ['/api/monitoring/endpoints'],
    refetchInterval: 30000, // RATE LIMIT FIX: Increased from 10s to 30s
    refetchIntervalInBackground: false,
  });

  // Fetch bottlenecks
  const { data: bottlenecks } = useQuery({
    queryKey: ['/api/monitoring/bottlenecks'],
    refetchInterval: 15000
  });

  // Set up SSE for real-time updates
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isCancelled = false;
    
    const start = () => {
      eventSource = new EventSource('/api/monitoring/stream');
      
      eventSource.onmessage = (event) => {
        if (!isCancelled) {
          const data = JSON.parse(event.data);
          setRealTimeMetrics(data);
        }
      };

      eventSource.onerror = () => {
        console.error('SSE connection error');
        eventSource?.close();
        eventSource = null;
      };
    };
    
    start();

    return () => {
      isCancelled = true;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Performance Monitoring</h1>
        <Badge variant="outline" className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Live Monitoring
        </Badge>
      </div>

      {/* Real-time metrics cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Requests/min</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {realTimeMetrics?.requestsPerMinute || 0}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Real-time request rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {realTimeMetrics?.avgResponseTime.toFixed(2) || 0}ms
            </div>
            <p className="text-[11px] text-muted-foreground">
              Average processing time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Error Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((realTimeMetrics?.errorRate || 0) * 100).toFixed(2)}%
            </div>
            <p className="text-[11px] text-muted-foreground">
              Failed requests ratio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Uptime</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatUptime(realTimeMetrics?.uptime || 0)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Service availability
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="endpoints" className="space-y-4">
        <TabsList>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="memory">Memory Usage</TabsTrigger>
          <TabsTrigger value="bottlenecks">Bottlenecks</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Endpoint Performance</CardTitle>
              <CardDescription>
                Response times and call counts for API endpoints
              </CardDescription>
            </CardHeader>
            <CardContent>
              {endpoints && endpoints.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={endpoints.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="endpoint" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar 
                      yAxisId="left"
                      dataKey="avgResponseTime" 
                      fill="#8884d8" 
                      name="Avg Response Time (ms)"
                    />
                    <Bar 
                      yAxisId="right"
                      dataKey="callCount" 
                      fill="#82ca9d" 
                      name="Call Count"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No endpoint data available yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Memory Usage</CardTitle>
              <CardDescription>
                Current memory consumption breakdown
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {realTimeMetrics?.currentMemoryUsage && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium">Heap Used</span>
                      <span className="text-[13px] text-muted-foreground">
                        {formatBytes(realTimeMetrics.currentMemoryUsage.heapUsed)} / {formatBytes(realTimeMetrics.currentMemoryUsage.heapTotal)}
                      </span>
                    </div>
                    <Progress 
                      value={(realTimeMetrics.currentMemoryUsage.heapUsed / realTimeMetrics.currentMemoryUsage.heapTotal) * 100} 
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium">RSS</span>
                      <span className="text-[13px] text-muted-foreground">
                        {formatBytes(realTimeMetrics.currentMemoryUsage.rss)}
                      </span>
                    </div>
                    <Progress 
                      value={(realTimeMetrics.currentMemoryUsage.rss / (1024 * 1024 * 1024)) * 100} 
                      className="h-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium">External</span>
                      <span className="text-[13px] text-muted-foreground">
                        {formatBytes(realTimeMetrics.currentMemoryUsage.external)}
                      </span>
                    </div>
                    <Progress 
                      value={(realTimeMetrics.currentMemoryUsage.external / (1024 * 1024 * 512)) * 100} 
                      className="h-2"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bottlenecks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Bottlenecks</CardTitle>
              <CardDescription>
                Identified issues that may impact performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bottlenecks && bottlenecks.length > 0 ? (
                <div className="space-y-4">
                  {bottlenecks.map((bottleneck: Bottleneck, index: number) => (
                    <Alert key={index}>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${getSeverityColor(bottleneck.severity)}`}>
                              {bottleneck.type.replace(/_/g, ' ').toUpperCase()}
                            </span>
                            <Badge variant={
                              bottleneck.severity === 'critical' ? 'destructive' :
                              bottleneck.severity === 'high' ? 'outline' :
                              'secondary'
                            }>
                              {bottleneck.severity}
                            </Badge>
                          </div>
                          <p className="text-[13px]">{bottleneck.recommendation}</p>
                          {bottleneck.endpoints && (
                            <ul className="text-[13px] text-muted-foreground ml-4">
                              {bottleneck.endpoints.slice(0, 3).map((ep, i) => (
                                <li key={i}>• {ep.endpoint} ({ep.avgResponseTime.toFixed(0)}ms)</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : (
                <Alert>
                  <Activity className="h-4 w-4" />
                  <AlertDescription>
                    No performance bottlenecks detected. System is running optimally.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>
                Historical performance data over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Cpu className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Historical trend data will appear here</p>
                <p className="text-[13px]">Collecting performance metrics...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}