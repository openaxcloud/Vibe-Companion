// @ts-nocheck
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar
} from 'recharts';
import { 
  Activity, AlertCircle, Clock, Cpu, HardDrive, Zap, Download, Maximize2,
  RefreshCw, Settings, TrendingUp, TrendingDown, Wifi, Database, Server,
  CheckCircle, XCircle, AlertTriangle, Info, Bell, BellOff, ChevronRight,
  BarChart3, PieChartIcon, LineChartIcon, Grid3x3
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { ResponseTimeChart } from '@/components/monitoring/ResponseTimeChart';
import { ResourceUsageChart } from '@/components/monitoring/ResourceUsageChart';
import { ErrorRateChart } from '@/components/monitoring/ErrorRateChart';
import { ThroughputChart } from '@/components/monitoring/ThroughputChart';
import { CustomMetricChart } from '@/components/monitoring/CustomMetricChart';
import { AlertManager } from '@/components/monitoring/AlertManager';
import { cn } from '@/lib/utils';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import { SkeletonCard, SkeletonChart } from '@/components/ui/skeleton-loader';

const CHART_COLORS = {
  primary: '#F26207', // E-Code orange
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  purple: '#8B5CF6',
  pink: '#EC4899',
  cyan: '#06B6D4'
};

const TIME_RANGES = [
  { value: '1', label: 'Last 1 Hour' },
  { value: '6', label: 'Last 6 Hours' },
  { value: '24', label: 'Last 24 Hours' },
  { value: '168', label: 'Last 7 Days' },
  { value: '720', label: 'Last 30 Days' },
];

export default function PerformanceDashboard() {
  const [timeRange, setTimeRange] = useState('24');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [realTimeData, setRealTimeData] = useState<any>(null);
  const [selectedMetric, setSelectedMetric] = useState('overview');

  // Fetch metrics data
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/monitoring/metrics', timeRange],
    queryParams: { timeRange },
    refetchInterval: autoRefresh ? 5000 : false
  });

  // Fetch alerts
  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['/api/monitoring/alerts'],
    refetchInterval: autoRefresh ? 10000 : false
  });

  // Fetch slow endpoints
  const { data: slowEndpoints } = useQuery({
    queryKey: ['/api/monitoring/slow-endpoints'],
    refetchInterval: 60000
  });

  // Export metrics mutation
  const exportMetrics = useMutation({
    mutationFn: async ({ format }: { format: 'json' | 'csv' }) => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - parseInt(timeRange));

      const response = await fetch('/api/monitoring/export?' + new URLSearchParams({
        format,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `metrics_${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  });

  // Setup WebSocket connection
  useEffect(() => {
    if (!ws) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/monitoring`;
      
      const websocket = new WebSocket(wsUrl);
      
      websocket.onopen = () => {
        // Authenticate if needed
        const token = localStorage.getItem('token');
        if (token) {
          websocket.send(JSON.stringify({
            type: 'auth',
            token
          }));
        }
      };

      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'metrics_realtime':
            setRealTimeData(data.data);
            break;
          case 'alert_triggered':
            queryClient.invalidateQueries({ queryKey: ['/api/monitoring/alerts'] });
            break;
          case 'alert_resolved':
            queryClient.invalidateQueries({ queryKey: ['/api/monitoring/alerts'] });
            break;
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      websocket.onclose = () => {
        setWs(null);
      };

      setWs(websocket);
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  }, []);

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    if (!metrics?.current) return null;

    const { system, requests, cache } = metrics.current;
    
    return {
      avgResponseTime: requests?.avgResponseTime || 0,
      errorRate: requests?.errorRate || 0,
      requestsPerMinute: requests?.total || 0,
      cpuUsage: system?.cpu?.usage?.user || 0,
      memoryUsage: system?.memory?.usedPercent || 0,
      cacheHitRate: cache?.hitRate || 0,
      activeAlerts: alerts?.active?.length || 0,
      status: determineSystemStatus(metrics.current)
    };
  }, [metrics, alerts]);

  const determineSystemStatus = (metrics: any) => {
    const errorRate = metrics?.requests?.errorRate || 0;
    const cpuUsage = metrics?.system?.cpu?.usage?.user || 0;
    const memoryUsage = metrics?.system?.memory?.usedPercent || 0;

    if (errorRate > 5 || cpuUsage > 90 || memoryUsage > 90) {
      return 'critical';
    }
    if (errorRate > 2 || cpuUsage > 70 || memoryUsage > 70) {
      return 'warning';
    }
    return 'healthy';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5" />;
      case 'warning': return <AlertTriangle className="h-5 w-5" />;
      case 'critical': return <XCircle className="h-5 w-5" />;
      default: return <Info className="h-5 w-5" />;
    }
  };

  if (metricsLoading || alertsLoading) {
    return (
      <PageShell>
        <PageHeader
          title="Performance Monitoring"
          description="Loading monitoring data..."
        />
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className={cn(isFullScreen && "fixed inset-0 z-50 bg-background")}>
      <PageHeader
        title="Performance Monitoring"
        description="Real-time application performance metrics and alerts"
        actions={
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40" data-testid="select-time-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map(range => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(autoRefresh && "bg-green-50 border-green-500 dark:bg-green-900/30 dark:border-green-700")}
              data-testid="button-auto-refresh"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", autoRefresh && "animate-spin")} />
              {autoRefresh ? 'Auto' : 'Manual'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMetrics.mutate({ format: 'csv' })}
              data-testid="button-export-metrics"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullScreen}
              data-testid="button-fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* System Status Banner */}
      {summaryMetrics && (
        <LazyMotionDiv
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mb-6 p-4 rounded-lg border flex items-center justify-between",
            summaryMetrics.status === 'healthy' && "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
            summaryMetrics.status === 'warning' && "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800",
            summaryMetrics.status === 'critical' && "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={getStatusColor(summaryMetrics.status)}>
              {getStatusIcon(summaryMetrics.status)}
            </div>
            <div>
              <h3 className="font-semibold capitalize">System Status: {summaryMetrics.status}</h3>
              <p className="text-[13px] text-muted-foreground">
                {summaryMetrics.activeAlerts} active alerts • 
                {summaryMetrics.errorRate.toFixed(2)}% error rate • 
                {summaryMetrics.avgResponseTime.toFixed(0)}ms avg response
              </p>
            </div>
          </div>
          
          {summaryMetrics.activeAlerts > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {summaryMetrics.activeAlerts} Alerts
            </Badge>
          )}
        </LazyMotionDiv>
      )}

      {/* Metrics Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Response Time"
          value={`${summaryMetrics?.avgResponseTime.toFixed(0) || 0}ms`}
          trend={realTimeData?.application?.avgResponseTime || 0}
          icon={<Clock className="h-4 w-4" />}
          color="blue"
        />
        <MetricCard
          title="Error Rate"
          value={`${summaryMetrics?.errorRate.toFixed(2) || 0}%`}
          trend={realTimeData?.application?.errorRate || 0}
          icon={<AlertCircle className="h-4 w-4" />}
          color="red"
          inverse
        />
        <MetricCard
          title="Throughput"
          value={`${summaryMetrics?.requestsPerMinute || 0} req/min`}
          trend={realTimeData?.application?.requestsPerMinute || 0}
          icon={<Zap className="h-4 w-4" />}
          color="green"
        />
        <MetricCard
          title="Cache Hit Rate"
          value={`${summaryMetrics?.cacheHitRate.toFixed(1) || 0}%`}
          trend={realTimeData?.cache?.hitRate || 0}
          icon={<Database className="h-4 w-4" />}
          color="purple"
        />
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs value={selectedMetric} onValueChange={setSelectedMetric} className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
          <TabsTrigger value="resources" data-testid="tab-resources">Resources</TabsTrigger>
          <TabsTrigger value="errors" data-testid="tab-errors">Errors</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts</TabsTrigger>
          <TabsTrigger value="custom" data-testid="tab-custom">Custom</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ResponseTimeChart data={metrics?.history} realTime={realTimeData} />
            <ThroughputChart data={metrics?.history} realTime={realTimeData} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ResourceUsageChart data={metrics?.history} realTime={realTimeData} />
            <ErrorRateChart data={metrics?.history} realTime={realTimeData} />
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <ResponseTimeChart data={metrics?.history} realTime={realTimeData} detailed />
          
          {/* Slow Endpoints Table */}
          {slowEndpoints?.endpoints && (
            <Card>
              <CardHeader>
                <CardTitle>Slowest Endpoints</CardTitle>
                <CardDescription>Endpoints with highest average response times</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {slowEndpoints.endpoints.map((endpoint: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex-1">
                          <p className="font-mono text-[13px]">{endpoint.endpoint}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {endpoint.count} calls
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{endpoint.avgTime.toFixed(0)}ms</p>
                          {endpoint.avgTime > 1000 && (
                            <Badge variant="destructive" className="text-[11px]">Slow</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <ResourceUsageChart data={metrics?.history} realTime={realTimeData} detailed />
          
          {/* System Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SystemInfoCard title="CPU" data={realTimeData?.cpu} icon={<Cpu />} />
            <SystemInfoCard title="Memory" data={realTimeData?.memory} icon={<HardDrive />} />
          </div>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <ErrorRateChart data={metrics?.history} realTime={realTimeData} detailed />
        </TabsContent>

        <TabsContent value="alerts">
          <AlertManager alerts={alerts} />
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <CustomMetricChart data={metrics?.history} customMetrics={metrics?.current?.custom} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

// Metric Card Component
function MetricCard({ title, value, trend, icon, color, inverse = false }: any) {
  const isPositive = inverse ? trend < 0 : trend > 0;
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900',
    red: 'text-red-600 bg-red-100 dark:bg-red-900',
    green: 'text-green-600 bg-green-100 dark:bg-green-900',
    purple: 'text-purple-600 bg-purple-100 dark:bg-purple-900',
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className={cn("p-2 rounded-lg", colorClasses[color])}>
            {icon}
          </span>
          {trend !== 0 && (
            <span className={cn(
              "text-[11px] flex items-center gap-1",
              isPositive ? "text-green-600" : "text-red-600"
            )}>
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-[11px] text-muted-foreground">{title}</p>
      </CardContent>
    </Card>
  );
}

// System Info Card Component
function SystemInfoCard({ title, data, icon }: any) {
  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-[13px] flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Object.entries(data).map(([key, value]: [string, any]) => (
            <div key={key} className="flex justify-between text-[13px]">
              <span className="text-muted-foreground capitalize">
                {key.replace(/_/g, ' ')}
              </span>
              <span className="font-medium">
                {typeof value === 'number' ? value.toFixed(2) : value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}