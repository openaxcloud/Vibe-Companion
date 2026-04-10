// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadialBarChart, RadialBar,
  PieChart, Pie, Cell
} from 'recharts';
import {
  Activity, Cpu, HardDrive, Network, AlertCircle,
  TrendingUp, TrendingDown, Clock, Zap, Server,
  AlertTriangle, CheckCircle, Info, RefreshCw,
  Download, Calendar, Filter, ChevronUp, ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { LazyMotionDiv } from '@/lib/motion';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface DeploymentMetricsProps {
  deploymentId: string;
  className?: string;
}

interface MetricData {
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  requestCount: number;
  errorCount: number;
  responseTime: number;
  activeConnections: number;
  networkIn: number;
  networkOut: number;
  diskUsage: number;
  containerCount: number;
  healthScore: number;
}

interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  score: number;
  issues: string[];
  recommendations: string[];
}

const COLORS = {
  healthy: '#10b981', // green
  warning: '#f59e0b', // yellow
  critical: '#ef4444', // red
  primary: '#F26207', // E-Code orange
  secondary: '#F99D25',
  cpu: '#3b82f6', // blue
  memory: '#8b5cf6', // purple
  network: '#06b6d4', // cyan
  disk: '#ec4899', // pink
};

export function DeploymentMetrics({ deploymentId, className }: DeploymentMetricsProps) {
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | 'week' | 'month'>('hour');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'all' | 'cpu' | 'memory' | 'network' | 'errors'>('all');

  // Fetch metrics data
  const { data: metrics, isLoading, refetch } = useQuery({
    queryKey: ['/api/deployments', deploymentId, 'metrics', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/deployments/${deploymentId}/metrics?range=${timeRange}`);
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false, // RATE LIMIT FIX: Increased from 5s to 30s
    refetchIntervalInBackground: false,
  });

  // Fetch health status
  const { data: health } = useQuery({
    queryKey: ['/api/deployments', deploymentId, 'health'],
    queryFn: async () => {
      const response = await fetch(`/api/deployments/${deploymentId}/health`);
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false, // RATE LIMIT FIX: Increased from 5s to 30s
    refetchIntervalInBackground: false,
  });

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    if (timeRange === 'hour') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (timeRange === 'day') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
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
      case 'critical': return <AlertCircle className="h-5 w-5" />;
      default: return <Info className="h-5 w-5" />;
    }
  };

  const calculateTrend = (data: MetricData[], key: keyof MetricData) => {
    if (!data || data.length < 2) return 0;
    const recent = data.slice(-10);
    const older = data.slice(-20, -10);
    const recentAvg = recent.reduce((sum, d) => sum + Number(d[key]), 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + Number(d[key]), 0) / older.length;
    return ((recentAvg - olderAvg) / olderAvg) * 100;
  };

  const MetricCard = ({ 
    title, 
    value, 
    unit, 
    trend, 
    icon: Icon, 
    color 
  }: { 
    title: string; 
    value: number | string; 
    unit?: string; 
    trend?: number; 
    icon: any; 
    color: string;
  }) => (
    <LazyMotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="glassmorphism hover:shadow-lg transition-all duration-300">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gradient-to-r ${color}`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-[13px] text-muted-foreground">{title}</p>
                <p className="text-2xl font-bold">
                  {typeof value === 'number' ? value.toFixed(1) : value}
                  {unit && <span className="text-[13px] text-muted-foreground ml-1">{unit}</span>}
                </p>
              </div>
            </div>
            {trend !== undefined && (
              <div className={`flex items-center gap-1 ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {trend >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span className="text-[13px] font-medium">{Math.abs(trend).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </LazyMotionDiv>
  );

  const chartData = metrics?.metrics || [];
  const healthData = health || { status: 'unknown', score: 0, issues: [], recommendations: [] };

  // Calculate current metrics
  const currentMetrics = chartData[chartData.length - 1] || {
    cpuUsage: 0,
    memoryUsage: 0,
    requestCount: 0,
    errorCount: 0,
    responseTime: 0,
    activeConnections: 0,
    networkIn: 0,
    networkOut: 0,
    diskUsage: 0,
    containerCount: 1,
    healthScore: 100,
  };

  const errorRate = currentMetrics.requestCount > 0 
    ? (currentMetrics.errorCount / currentMetrics.requestCount) * 100 
    : 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Deployment Metrics</h2>
          <Badge 
            variant={healthData.status === 'healthy' ? 'default' : 'destructive'}
            className={cn(
              healthData.status === 'healthy' && 'bg-green-500',
              healthData.status === 'warning' && 'bg-yellow-500',
              healthData.status === 'critical' && 'bg-red-500'
            )}
          >
            {getStatusIcon(healthData.status)}
            <span className="ml-1">{healthData.status}</span>
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hour">Last Hour</SelectItem>
              <SelectItem value="day">Last Day</SelectItem>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-ecode-primary hover:bg-ecode-primary/90' : ''}
          >
            <RefreshCw className={cn('h-4 w-4', autoRefresh && 'animate-spin')} />
            <span className="ml-2">{autoRefresh ? 'Auto' : 'Manual'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Health Score */}
      <Card className="glassmorphism">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Health Score</span>
            <span className="text-3xl font-bold" style={{ color: COLORS[healthData.status] }}>
              {healthData.score}%
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress 
            value={healthData.score} 
            className="h-3"
            style={{
              background: `linear-gradient(to right, 
                ${COLORS.critical} 0%, 
                ${COLORS.warning} 50%, 
                ${COLORS.healthy} 100%)`
            }}
          />
          {healthData.issues.length > 0 && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Issues Detected</AlertTitle>
              <AlertDescription>
                <ul className="list-disc ml-4 mt-2">
                  {healthData.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {healthData.recommendations.length > 0 && (
            <Alert className="mt-4 border-ecode-primary/20 bg-ecode-primary/5">
              <Info className="h-4 w-4 text-ecode-primary" />
              <AlertTitle>Recommendations</AlertTitle>
              <AlertDescription>
                <ul className="list-disc ml-4 mt-2">
                  {healthData.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="CPU Usage"
          value={currentMetrics.cpuUsage}
          unit="%"
          trend={calculateTrend(chartData, 'cpuUsage')}
          icon={Cpu}
          color="from-blue-500 to-blue-600"
        />
        <MetricCard
          title="Memory Usage"
          value={currentMetrics.memoryUsage}
          unit="%"
          trend={calculateTrend(chartData, 'memoryUsage')}
          icon={HardDrive}
          color="from-purple-500 to-purple-600"
        />
        <MetricCard
          title="Response Time"
          value={currentMetrics.responseTime}
          unit="ms"
          trend={calculateTrend(chartData, 'responseTime')}
          icon={Clock}
          color="from-cyan-500 to-cyan-600"
        />
        <MetricCard
          title="Error Rate"
          value={errorRate}
          unit="%"
          trend={calculateTrend(chartData, 'errorCount')}
          icon={AlertCircle}
          color={errorRate > 5 ? "from-red-500 to-red-600" : "from-green-500 to-green-600"}
        />
      </div>

      {/* Detailed Charts */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="traffic">Traffic</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card className="glassmorphism">
            <CardHeader>
              <CardTitle>CPU & Memory Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.cpu} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={COLORS.cpu} stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.memory} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={COLORS.memory} stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    labelFormatter={formatTimestamp}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="cpuUsage"
                    name="CPU %"
                    stroke={COLORS.cpu}
                    fillOpacity={1}
                    fill="url(#cpuGradient)"
                    animationDuration={300}
                  />
                  <Area
                    type="monotone"
                    dataKey="memoryUsage"
                    name="Memory %"
                    stroke={COLORS.memory}
                    fillOpacity={1}
                    fill="url(#memoryGradient)"
                    animationDuration={300}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glassmorphism">
            <CardHeader>
              <CardTitle>Response Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    labelFormatter={formatTimestamp}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="responseTime"
                    name="Response Time (ms)"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    dot={false}
                    animationDuration={300}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="traffic" className="space-y-4">
          <Card className="glassmorphism">
            <CardHeader>
              <CardTitle>Request Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    labelFormatter={formatTimestamp}
                  />
                  <Legend />
                  <Bar 
                    dataKey="requestCount" 
                    name="Requests"
                    fill={COLORS.primary}
                    animationDuration={300}
                  />
                  <Bar 
                    dataKey="errorCount" 
                    name="Errors"
                    fill={COLORS.critical}
                    animationDuration={300}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glassmorphism">
            <CardHeader>
              <CardTitle>Network I/O</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="networkInGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.network} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={COLORS.network} stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="networkOutGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.disk} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={COLORS.disk} stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} />
                  <YAxis tickFormatter={(value) => `${(value / 1024 / 1024).toFixed(1)}MB`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    labelFormatter={formatTimestamp}
                    formatter={(value: number) => `${(value / 1024 / 1024).toFixed(2)}MB`}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="networkIn"
                    name="Network In"
                    stroke={COLORS.network}
                    fillOpacity={1}
                    fill="url(#networkInGradient)"
                    animationDuration={300}
                  />
                  <Area
                    type="monotone"
                    dataKey="networkOut"
                    name="Network Out"
                    stroke={COLORS.disk}
                    fillOpacity={1}
                    fill="url(#networkOutGradient)"
                    animationDuration={300}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <Card className="glassmorphism">
            <CardHeader>
              <CardTitle>Resource Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-[13px] font-medium mb-4">Current Usage</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <RadialBarChart 
                      cx="50%" 
                      cy="50%" 
                      innerRadius="10%" 
                      outerRadius="100%"
                      data={[
                        { name: 'CPU', value: currentMetrics.cpuUsage, fill: COLORS.cpu },
                        { name: 'Memory', value: currentMetrics.memoryUsage, fill: COLORS.memory },
                        { name: 'Disk', value: currentMetrics.diskUsage, fill: COLORS.disk },
                      ]}
                    >
                      <RadialBar dataKey="value" />
                      <Legend />
                      <Tooltip />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[13px] font-medium">Details</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-muted-foreground">Active Connections</span>
                      <span className="font-medium">{currentMetrics.activeConnections}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-muted-foreground">Container Count</span>
                      <span className="font-medium">{currentMetrics.containerCount}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-muted-foreground">Disk Usage</span>
                      <span className="font-medium">{currentMetrics.diskUsage.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card className="glassmorphism">
            <CardHeader>
              <CardTitle>Error Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    labelFormatter={formatTimestamp}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="errorCount"
                    name="Error Count"
                    stroke={COLORS.critical}
                    strokeWidth={2}
                    dot={{ fill: COLORS.critical }}
                    animationDuration={300}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey={(data: any) => data.requestCount > 0 ? (data.errorCount / data.requestCount) * 100 : 0}
                    name="Error Rate %"
                    stroke={COLORS.warning}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    animationDuration={300}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}