import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Server,
  TrendingUp,
  RefreshCw,
  Zap,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  stats: {
    totalRequests: number;
    totalErrors: number;
    overallSuccessRate: number;
    endpointStats: Record<string, any>;
  };
  system: {
    uptime: number;
    memory: any;
    cpu: any;
  };
}

interface Metric {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: string;
}

export default function PerformanceMonitor() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [realtimeMetrics, setRealtimeMetrics] = useState<Metric[]>([]);

  // Fetch health status
  const { data: health, refetch: refetchHealth } = useQuery<HealthStatus>({
    queryKey: ['/api/monitoring/status'],
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Fetch time series data
  const { data: timeSeries } = useQuery<{ data: any[] }>({
    queryKey: ['/api/monitoring/metrics/timeseries'],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Setup real-time monitoring stream
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isCancelled = false;

    if (!autoRefresh) {
      return;
    }

    eventSource = new EventSource('/api/monitoring/stream');
    
    eventSource.onmessage = (event) => {
      if (!isCancelled) {
        const data = JSON.parse(event.data);
        
        if (data.type === 'metric') {
          setRealtimeMetrics(prev => [...prev.slice(-20), data.metric]);
        }
      }
    };

    eventSource.onerror = () => {
      eventSource?.close();
      eventSource = null;
    };

    return () => {
      isCancelled = true;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [autoRefresh]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500';
      case 'degraded':
        return 'text-yellow-500';
      case 'unhealthy':
        return 'text-red-500';
      default:
        return '';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Performance Monitor</h1>
          <p className="text-[11px] sm:text-[13px] text-muted-foreground">
            Real-time system performance and health metrics
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchHealth()}
            className="flex-1 sm:flex-none"
            data-testid="button-refresh-health"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            <span className="hidden xs:inline">Refresh</span>
          </Button>
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="flex-1 sm:flex-none"
            data-testid="button-toggle-autorefresh"
          >
            <Activity className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="text-[11px] sm:text-[13px]">Auto {autoRefresh ? 'ON' : 'OFF'}</span>
          </Button>
        </div>
      </div>

      {/* System Status */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(health.status)}
              <span className={getStatusColor(health.status)}>
                System {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
              </span>
            </CardTitle>
            <CardDescription>
              Overall system health and performance status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {health.issues.length > 0 && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Performance Issues Detected</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2">
                    {health.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              <Card>
                <CardHeader className="p-3 sm:p-4 pb-2">
                  <CardTitle className="text-[11px] sm:text-[13px] font-medium">Uptime</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="text-[15px] sm:text-2xl font-bold">
                    {formatUptime(health.system.uptime)}
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
                    System running time
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-3 sm:p-4 pb-2">
                  <CardTitle className="text-[11px] sm:text-[13px] font-medium">Success Rate</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="text-[15px] sm:text-2xl font-bold">
                    {health.stats.overallSuccessRate.toFixed(1)}%
                  </div>
                  <Progress
                    value={health.stats.overallSuccessRate}
                    className="mt-2"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-3 sm:p-4 pb-2">
                  <CardTitle className="text-[11px] sm:text-[13px] font-medium">Total Requests</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="text-[15px] sm:text-2xl font-bold">
                    {health.stats.totalRequests.toLocaleString()}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    In the last 5 minutes
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-3 sm:p-4 pb-2">
                  <CardTitle className="text-[11px] sm:text-[13px] font-medium">Memory Usage</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="text-[15px] sm:text-2xl font-bold">
                    {formatBytes(health.system.memory.heapUsed)}
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
                    of {formatBytes(health.system.memory.heapTotal)}
                  </p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Response Time Chart */}
      {timeSeries?.data && timeSeries.data.length > 0 && (
        <Card data-testid="card-response-time-chart">
          <CardHeader className="p-3 sm:p-4 lg:p-6">
            <CardTitle className="text-[13px] sm:text-base lg:text-[15px]">Response Time Trends</CardTitle>
            <CardDescription className="text-[11px] sm:text-[13px]">
              Average response times over the last 10 minutes
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 lg:p-6 pt-0">
            <div className="h-[200px] sm:h-[250px] lg:h-[300px] w-full overflow-x-auto">
              <ResponsiveContainer width="100%" height="100%" minWidth={300}>
                <AreaChart data={timeSeries.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgResponseTime"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.6}
                    name="Avg Response Time (ms)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request Volume Chart */}
      {timeSeries?.data && timeSeries.data.length > 0 && (
        <Card data-testid="card-request-volume-chart">
          <CardHeader className="p-3 sm:p-4 lg:p-6">
            <CardTitle className="text-[13px] sm:text-base lg:text-[15px]">Request Volume</CardTitle>
            <CardDescription className="text-[11px] sm:text-[13px]">
              Number of requests and errors over time
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 lg:p-6 pt-0">
            <div className="h-[200px] sm:h-[250px] lg:h-[300px] w-full overflow-x-auto">
              <ResponsiveContainer width="100%" height="100%" minWidth={300}>
                <LineChart data={timeSeries.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                  />
                  <Line
                    type="monotone"
                    dataKey="requests"
                    stroke="#82ca9d"
                    name="Requests"
                  />
                  <Line
                    type="monotone"
                    dataKey="errorCount"
                    stroke="#ff7c7c"
                    name="Errors"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Endpoint Performance */}
      {health?.stats.endpointStats && (
        <Card data-testid="card-endpoint-performance">
          <CardHeader className="p-3 sm:p-4 lg:p-6">
            <CardTitle className="text-[13px] sm:text-base lg:text-[15px]">Endpoint Performance</CardTitle>
            <CardDescription className="text-[11px] sm:text-[13px]">
              Performance metrics for individual API endpoints
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
            <div className="space-y-3 sm:space-y-4">
              {Object.entries(health.stats.endpointStats).map(([key, stat]: [string, any]) => (
                <div key={key} className="border rounded-lg p-2 sm:p-3 lg:p-4" data-testid={`card-endpoint-${key}`}>
                  {/* Mobile: stacked layout, Desktop: flex row */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] sm:text-[11px]">{stat.method}</Badge>
                      <span className="font-mono text-[10px] sm:text-[11px] lg:text-[13px] break-all">{stat.endpoint}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-[11px] lg:text-[13px]">
                      <span className="flex items-center">
                        <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                        {stat.avgResponseTime.toFixed(0)}ms
                      </span>
                      <span className="flex items-center">
                        <Zap className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                        p95: {stat.p95.toFixed(0)}ms
                      </span>
                      <span className={stat.successRate < 95 ? 'text-red-500' : 'text-green-500'}>
                        {stat.successRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  {/* Mobile: 2-col grid, Desktop: 5-col */}
                  <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-1 sm:gap-2 text-[10px] sm:text-[11px] text-muted-foreground">
                    <div>Count: {stat.count}</div>
                    <div>Min: {stat.minResponseTime}ms</div>
                    <div>Max: {stat.maxResponseTime}ms</div>
                    <div>p50: {stat.p50}ms</div>
                    <div>p99: {stat.p99}ms</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time Activity */}
      <Card data-testid="card-realtime-activity">
        <CardHeader className="p-3 sm:p-4 lg:p-6">
          <CardTitle className="text-[13px] sm:text-base lg:text-[15px]">Real-time Activity</CardTitle>
          <CardDescription className="text-[11px] sm:text-[13px]">
            Live stream of API requests (last 20)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
          <div className="space-y-2">
            {realtimeMetrics.length === 0 ? (
              <p className="text-muted-foreground text-center py-4 sm:py-8 text-[11px] sm:text-[13px]">
                Waiting for activity...
              </p>
            ) : (
              realtimeMetrics.map((metric, i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 py-2 px-2 sm:px-3 rounded-md bg-muted/50"
                  data-testid={`metric-row-${i}`}
                >
                  <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                    <Badge
                      variant={metric.statusCode >= 400 ? 'destructive' : 'default'}
                      className="text-[10px] sm:text-[11px]"
                    >
                      {metric.statusCode}
                    </Badge>
                    <span className="font-mono text-[10px] sm:text-[11px] lg:text-[13px] break-all">
                      {metric.method} {metric.endpoint}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-[11px] lg:text-[13px] text-muted-foreground">
                    <span>{metric.responseTime}ms</span>
                    <span className="truncate">{formatDistanceToNow(new Date(metric.timestamp))} ago</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}