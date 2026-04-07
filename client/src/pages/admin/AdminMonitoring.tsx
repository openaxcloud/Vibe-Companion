import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  HeartPulse, 
  Activity, 
  Database, 
  Server, 
  Cpu, 
  HardDrive,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Gauge
} from 'lucide-react';

interface HealthData {
  status: string;
  service?: string;
  timestamp?: string;
  uptime?: string;
  environment?: string;
  version?: string;
  system?: {
    memory?: {
      usage: string;
      available: string;
      total: string;
    };
    cpu?: {
      cores: number;
      model: string;
      loadAverage: string[];
    };
  };
  database?: {
    status: string;
    connection: string;
  };
}

interface MetricsData {
  timestamp: number;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  requests: {
    total: number;
    errors: number;
    avgResponseTime: number;
  };
}

export default function AdminMonitoring() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [detailedHealth, setDetailedHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://e-code.ai';

  const monitoringEndpoints = [
    { 
      name: 'Health Status', 
      path: '/api/health', 
      description: 'Basic health check',
      icon: HeartPulse
    },
    { 
      name: 'System Metrics', 
      path: '/api/metrics', 
      description: 'CPU, Memory, Request stats',
      icon: Gauge
    },
    { 
      name: 'Detailed Health', 
      path: '/api/health/detailed', 
      description: 'Full system diagnostics',
      icon: Activity
    },
    { 
      name: 'Liveness Probe', 
      path: '/health/liveness', 
      description: 'Kubernetes liveness check',
      icon: CheckCircle2
    },
    { 
      name: 'Readiness Probe', 
      path: '/health/readiness', 
      description: 'Kubernetes readiness check',
      icon: Server
    },
    { 
      name: 'AI Providers', 
      path: '/api/health/providers', 
      description: 'AI provider status',
      icon: Cpu
    },
    { 
      name: 'API Documentation', 
      path: '/api/docs', 
      description: 'Swagger API docs',
      icon: ExternalLink
    },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [healthRes, metricsRes, detailedRes] = await Promise.all([
        fetch('/api/health').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/metrics').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/health/detailed').then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      setHealthData(healthRes);
      setMetricsData(metricsRes);
      setDetailedHealth(detailedRes);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: any) => {
    const statusStr = String(status || '').toLowerCase();
    switch (statusStr) {
      case 'healthy':
      case 'ok':
      case 'up':
      case 'ready':
      case 'active':
        return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Healthy</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-600"><AlertTriangle className="h-3 w-3 mr-1" /> Degraded</Badge>;
      case 'unhealthy':
      case 'down':
        return <Badge className="bg-red-600"><XCircle className="h-3 w-3 mr-1" /> Unhealthy</Badge>;
      default:
        return <Badge variant="secondary">{String(status || 'Unknown')}</Badge>;
    }
  };

  const formatBytes = (bytes: number) => {
    if (typeof bytes !== 'number' || isNaN(bytes)) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatUptime = (seconds: number) => {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white" data-testid="heading-system-monitoring">System Monitoring</h1>
            <p className="text-zinc-400 mt-1">E-Code Platform Health & Metrics Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-zinc-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last refresh: {lastRefresh.toLocaleTimeString()}
            </span>
            <Button 
              onClick={fetchData} 
              disabled={loading}
              size="sm"
              className="min-h-[44px]"
              data-testid="button-refresh-monitoring"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="overview" className="min-h-[44px]" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="endpoints" className="min-h-[44px]" data-testid="tab-endpoints">Endpoints</TabsTrigger>
            <TabsTrigger value="metrics" className="min-h-[44px]" data-testid="tab-metrics">Metrics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13px] font-medium text-zinc-400 flex items-center gap-2">
                    <HeartPulse className="h-4 w-4" />
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getStatusBadge(healthData?.status || 'unknown')}
                  <p className="text-[11px] text-zinc-500 mt-2">{healthData?.service || 'E-Code Platform'}</p>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13px] font-medium text-zinc-400 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Uptime
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-white">
                    {metricsData ? formatUptime(metricsData.uptime) : healthData?.uptime || '--'}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1">{healthData?.environment || 'development'}</p>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13px] font-medium text-zinc-400 flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    Memory Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-white">
                    {metricsData?.memory ? formatBytes(metricsData.memory.heapUsed) : '--'}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    of {metricsData?.memory ? formatBytes(metricsData.memory.heapTotal) : '--'} heap
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13px] font-medium text-zinc-400 flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Database
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getStatusBadge(detailedHealth?.database?.status || 'unknown')}
                  <p className="text-[11px] text-zinc-500 mt-2">{detailedHealth?.database?.connection || 'checking...'}</p>
                </CardContent>
              </Card>
            </div>

            {detailedHealth?.system && (
              <Card className="bg-zinc-900 border-zinc-800 mt-4">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    System Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="text-[13px] font-medium text-zinc-400 mb-2">Memory</h4>
                      <p className="text-white">Usage: {detailedHealth?.system?.memory?.usage ?? 'N/A'}</p>
                      <p className="text-zinc-400 text-[13px]">Available: {detailedHealth?.system?.memory?.available ?? 'N/A'}</p>
                      <p className="text-zinc-400 text-[13px]">Total: {detailedHealth?.system?.memory?.total ?? 'N/A'}</p>
                    </div>
                    <div>
                      <h4 className="text-[13px] font-medium text-zinc-400 mb-2">CPU</h4>
                      <p className="text-white">{detailedHealth?.system?.cpu?.cores ?? 0} cores</p>
                      <p className="text-zinc-400 text-[13px]">{detailedHealth?.system?.cpu?.model ?? 'Unknown'}</p>
                      <p className="text-zinc-400 text-[13px]">Load: {detailedHealth?.system?.cpu?.loadAverage ? detailedHealth.system.cpu.loadAverage.join(', ') : 'N/A'}</p>
                    </div>

                    <div>
                      <h4 className="text-[13px] font-medium text-zinc-400 mb-2">Platform</h4>
                      <p className="text-white">{detailedHealth?.system?.platform?.os ?? 'Unknown'} ({detailedHealth?.system?.platform?.arch ?? 'Unknown'})</p>
                      <p className="text-zinc-400 text-[13px]">Node.js {detailedHealth?.system?.platform?.nodeVersion ?? 'Unknown'}</p>
                      <p className="text-zinc-400 text-[13px]">Uptime: {detailedHealth?.system?.platform?.uptime ?? '0'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="endpoints" className="mt-6">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Monitoring Endpoints</CardTitle>
                <CardDescription>Direct access to E-Code platform monitoring APIs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {monitoringEndpoints.map((endpoint) => {
                    const Icon = endpoint.icon;
                    return (
                      <div 
                        key={endpoint.path}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-zinc-800/50 rounded-lg gap-3"
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <Icon className="h-5 w-5 text-zinc-400 mt-1 sm:mt-0" />
                          <div>
                            <p className="font-medium text-white">{endpoint.name}</p>
                            <p className="text-[13px] text-zinc-400">{endpoint.description}</p>
                            <code className="text-[11px] text-blue-400 mt-1 block">{baseUrl}{endpoint.path}</code>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-[44px] w-full sm:w-auto"
                          onClick={() => window.open(endpoint.path, '_blank')}
                          data-testid={`button-open-${endpoint.name.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metrics" className="mt-6">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  Real-time Metrics
                </CardTitle>
                <CardDescription>Auto-refreshes every 30 seconds</CardDescription>
              </CardHeader>
              <CardContent>
                {metricsData ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-[13px] font-medium text-zinc-400">Memory</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-zinc-400">RSS</span>
                          <span className="text-white">{formatBytes(metricsData.memory.rss)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Heap Total</span>
                          <span className="text-white">{formatBytes(metricsData.memory.heapTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Heap Used</span>
                          <span className="text-white">{formatBytes(metricsData.memory.heapUsed)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[13px] font-medium text-zinc-400">Requests</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Total</span>
                          <span className="text-white">{metricsData.requests.total}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Errors</span>
                          <span className="text-white">{metricsData.requests.errors}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Avg Response Time</span>
                          <span className="text-white">{metricsData.requests.avgResponseTime}ms</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-zinc-400">Loading metrics...</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
