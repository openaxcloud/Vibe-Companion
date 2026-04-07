import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Activity, 
  Shield, 
  Zap, 
  Database, 
  Globe, 
  RefreshCw, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface HealthMetric {
  name: string;
  value: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  icon: React.ElementType;
  description: string;
  trend: 'up' | 'down' | 'stable';
  isEstimated?: boolean;
}

interface RadarPoint {
  x: number;
  y: number;
  metric: HealthMetric;
}

interface HealthApiResponse {
  status: 'healthy' | 'degraded';
  metrics: {
    system: {
      cpu: { usage: number; loadAverage: number[] };
      memory: { used: number; total: number; percentage: number };
      uptime: number;
    };
    api: {
      requestCount: number;
      errorCount: number;
      averageLatency: number;
      p95Latency: number;
      p99Latency: number;
    };
    websocket: {
      activeConnections: number;
      totalMessages: number;
      messageRate: number;
    };
    timestamp: number;
  };
  checks: {
    memory: boolean;
    cpu: boolean;
    errorRate: boolean;
  };
}

const BASELINE_VALUE = 85;

function computeHealthMetrics(data: HealthApiResponse | undefined): HealthMetric[] {
  const metrics = data?.metrics;
  const checks = data?.checks;
  
  const errorRate = metrics?.api?.requestCount && metrics.api.requestCount > 0
    ? (metrics.api.errorCount / metrics.api.requestCount) * 100
    : 0;
  const codeQualityValue = metrics?.api
    ? Math.round(Math.max(0, Math.min(100, 100 - errorRate * 10)))
    : BASELINE_VALUE;
  
  const avgLatency = metrics?.api?.averageLatency ?? 0;
  const performanceValue = metrics?.api
    ? Math.round(Math.max(0, Math.min(100, 100 - (avgLatency / 10))))
    : BASELINE_VALUE;
  
  const reliabilityValue = checks
    ? (checks.memory && checks.cpu && checks.errorRate ? 95 : 
       (checks.memory && checks.cpu ? 80 : 
        (checks.errorRate ? 70 : 60)))
    : BASELINE_VALUE;
  
  const cpuUsage = metrics?.system?.cpu?.usage ?? 50;
  const memUsage = metrics?.system?.memory?.percentage ?? 50;
  const scalabilityValue = Math.round(Math.max(0, Math.min(100, 100 - ((cpuUsage + memUsage) / 2))));
  
  const hasRealData = !!data?.metrics;
  
  const healthMetrics: HealthMetric[] = [
    {
      name: 'Code Quality',
      value: hasRealData ? codeQualityValue : BASELINE_VALUE,
      status: 'good',
      icon: Shield,
      description: hasRealData 
        ? `Based on error rate: ${errorRate.toFixed(1)}%`
        : 'Estimated value - real analysis pending',
      trend: 'stable',
      isEstimated: !hasRealData
    },
    {
      name: 'Performance',
      value: hasRealData ? performanceValue : BASELINE_VALUE,
      status: 'excellent',
      icon: Zap,
      description: hasRealData
        ? `Avg latency: ${avgLatency.toFixed(0)}ms, P95: ${metrics?.api?.p95Latency?.toFixed(0) ?? 0}ms`
        : 'Estimated value - real analysis pending',
      trend: 'stable',
      isEstimated: !hasRealData
    },
    {
      name: 'Security',
      value: BASELINE_VALUE,
      status: 'good',
      icon: Shield,
      description: 'Estimated value - real analysis pending',
      trend: 'stable',
      isEstimated: true
    },
    {
      name: 'Reliability',
      value: hasRealData ? reliabilityValue : BASELINE_VALUE,
      status: 'excellent',
      icon: Activity,
      description: hasRealData
        ? `System uptime: ${Math.floor((metrics?.system?.uptime ?? 0) / 3600)}h ${Math.floor(((metrics?.system?.uptime ?? 0) % 3600) / 60)}m`
        : 'Estimated value - real analysis pending',
      trend: 'stable',
      isEstimated: !hasRealData
    },
    {
      name: 'Scalability',
      value: hasRealData ? scalabilityValue : BASELINE_VALUE,
      status: 'warning',
      icon: TrendingUp,
      description: hasRealData
        ? `CPU: ${cpuUsage.toFixed(1)}%, Memory: ${memUsage.toFixed(1)}%`
        : 'Estimated value - real analysis pending',
      trend: 'stable',
      isEstimated: !hasRealData
    },
    {
      name: 'Database',
      value: BASELINE_VALUE,
      status: 'excellent',
      icon: Database,
      description: 'Estimated value - real analysis pending',
      trend: 'stable',
      isEstimated: true
    }
  ];

  healthMetrics.forEach(metric => {
    if (metric.value >= 90) metric.status = 'excellent';
    else if (metric.value >= 75) metric.status = 'good';
    else if (metric.value >= 60) metric.status = 'warning';
    else metric.status = 'critical';
  });

  return healthMetrics;
}

export function CodeHealthRadar() {
  const [refreshing, setRefreshing] = useState(false);
  
  const { data: healthData, isLoading, refetch } = useQuery<HealthApiResponse>({
    queryKey: ['/api/monitoring/health'],
    refetchInterval: 30000
  });

  const healthMetrics = useMemo(() => computeHealthMetrics(healthData), [healthData]);

  const refresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Calculate radar chart points
  const calculateRadarPoints = (metrics: HealthMetric[]): RadarPoint[] => {
    const centerX = 150;
    const centerY = 150;
    const maxRadius = 120;
    
    return metrics.map((metric, index) => {
      const angle = (index * 2 * Math.PI) / metrics.length - Math.PI / 2;
      const radius = (metric.value / 100) * maxRadius;
      
      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        metric
      };
    });
  };

  const getStatusColor = (status: HealthMetric['status']) => {
    switch (status) {
      case 'excellent': return '#10b981'; // green-500
      case 'good': return '#3b82f6'; // blue-500
      case 'warning': return '#f59e0b'; // amber-500
      case 'critical': return '#ef4444'; // red-500
    }
  };

  const getStatusBadge = (status: HealthMetric['status']) => {
    switch (status) {
      case 'excellent':
        return <Badge className="bg-green-500 text-white">Excellent</Badge>;
      case 'good':
        return <Badge className="bg-blue-500 text-white">Good</Badge>;
      case 'warning':
        return <Badge className="bg-amber-500 text-white">Warning</Badge>;
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
    }
  };

  const getOverallStatus = () => {
    const criticalCount = healthMetrics.filter(m => m.status === 'critical').length;
    const warningCount = healthMetrics.filter(m => m.status === 'warning').length;
    
    if (criticalCount > 0) return 'critical';
    if (warningCount > 1) return 'warning';
    if (warningCount === 1) return 'good';
    return 'excellent';
  };

  const getOverallIcon = () => {
    const status = getOverallStatus();
    switch (status) {
      case 'excellent': return <CheckCircle2 className="h-6 w-6 text-green-500" />;
      case 'good': return <Activity className="h-6 w-6 text-blue-500" />;
      case 'warning': return <AlertTriangle className="h-6 w-6 text-amber-500" />;
      case 'critical': return <XCircle className="h-6 w-6 text-red-500" />;
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Code Health Radar
          </CardTitle>
          <CardDescription>System stability and performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-80 bg-muted rounded-lg"></div>
            <div className="grid grid-cols-2 gap-4">
              {Array.from({length: 6}).map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const radarPoints = calculateRadarPoints(healthMetrics);
  const overallStatus = getOverallStatus();
  const averageHealth = healthMetrics.reduce((acc, m) => acc + m.value, 0) / healthMetrics.length;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Code Health Radar
            </CardTitle>
            <CardDescription>Real-time system stability and performance metrics</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Health Status */}
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-3">
            {getOverallIcon()}
            <div>
              <h3 className="font-semibold">Overall System Health</h3>
              <p className="text-[13px] text-muted-foreground">
                {overallStatus === 'excellent' ? 'All systems performing optimally' :
                 overallStatus === 'good' ? 'Systems running well with minor issues' :
                 overallStatus === 'warning' ? 'Some systems need attention' :
                 'Critical issues require immediate attention'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{averageHealth.toFixed(1)}%</div>
            {getStatusBadge(overallStatus)}
          </div>
        </div>

        {/* Radar Chart */}
        <div className="flex justify-center">
          <svg width="300" height="300" className="border rounded-lg bg-background">
            {/* Grid lines */}
            {[20, 40, 60, 80, 100].map(percent => (
              <circle
                key={percent}
                cx="150"
                cy="150"
                r={(percent / 100) * 120}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
            ))}
            
            {/* Axis lines */}
            {healthMetrics.map((_, index) => {
              const angle = (index * 2 * Math.PI) / healthMetrics.length - Math.PI / 2;
              const endX = 150 + 120 * Math.cos(angle);
              const endY = 150 + 120 * Math.sin(angle);
              
              return (
                <line
                  key={index}
                  x1="150"
                  y1="150"
                  x2={endX}
                  y2={endY}
                  stroke="hsl(var(--muted))"
                  strokeWidth="1"
                />
              );
            })}

            {/* Health area */}
            <polygon
              points={radarPoints.map(p => `${p.x},${p.y}`).join(' ')}
              fill={getStatusColor(overallStatus)}
              fillOpacity="0.2"
              stroke={getStatusColor(overallStatus)}
              strokeWidth="2"
            />

            {/* Health points */}
            {radarPoints.map((point, index) => (
              <g key={index}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill={getStatusColor(point.metric.status)}
                  stroke="white"
                  strokeWidth="2"
                />
                
                {/* Labels */}
                <text
                  x={point.x + (point.x > 150 ? 10 : -10)}
                  y={point.y + 5}
                  textAnchor={point.x > 150 ? 'start' : 'end'}
                  className="text-[11px] fill-current"
                  style={{ fontSize: '10px' }}
                >
                  {point.metric.name}
                </text>
              </g>
            ))}

            {/* Center point */}
            <circle cx="150" cy="150" r="3" fill="hsl(var(--foreground))" />
          </svg>
        </div>

        {/* Metric Details */}
        <TooltipProvider>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {healthMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <Card key={metric.name} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <h4 className="font-medium text-[13px]">{metric.name}</h4>
                      {metric.isEstimated && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Estimated value - real analysis pending</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    {getStatusBadge(metric.status)}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] font-bold">{metric.value}%</span>
                      <div className={`flex items-center gap-1 text-[11px] ${
                        metric.trend === 'up' ? 'text-green-500' : 
                        metric.trend === 'down' ? 'text-red-500' : 
                        'text-muted-foreground'
                      }`}>
                        <TrendingUp className={`h-3 w-3 ${
                          metric.trend === 'down' ? 'rotate-180' : 
                          metric.trend === 'stable' ? 'rotate-90' : ''
                        }`} />
                        {metric.trend}
                      </div>
                    </div>
                    
                    <Progress 
                      value={metric.value} 
                      className="h-2"
                      style={{
                        '--progress-background': getStatusColor(metric.status)
                      } as React.CSSProperties}
                    />
                    
                    <p className="text-[11px] text-muted-foreground">
                      {metric.description}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </TooltipProvider>

        {/* Action Items */}
        {healthMetrics.some(m => m.status === 'warning' || m.status === 'critical') && (
          <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Recommended Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {healthMetrics
                  .filter(m => m.status === 'warning' || m.status === 'critical')
                  .map(metric => (
                    <div key={metric.name} className="flex items-center gap-2 text-[13px]">
                      <div className={`w-2 h-2 rounded-full ${
                        metric.status === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                      }`} />
                      <span className="font-medium">{metric.name}:</span>
                      <span className="text-muted-foreground">
                        {metric.status === 'critical' 
                          ? 'Requires immediate attention - check logs and monitoring dashboards'
                          : 'Consider optimization - review recent changes and performance metrics'
                        }
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}