import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, AlertTriangle, CheckCircle, TrendingUp, TrendingDown,
  Server, Database, Network, Users, Clock, Zap, 
  MemoryStick, Cpu, HardDrive, Globe, Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    load: number[];
  };
  memory: {
    used: number;
    total: number;
    available: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    available: number;
    percentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
}

interface ApplicationMetrics {
  requests: {
    total: number;
    success: number;
    errors: number;
    rate: number;
  };
  response: {
    average: number;
    p95: number;
    p99: number;
  };
  database: {
    connections: number;
    queries: number;
    slowQueries: number;
    queryTime: number;
  };
  uptime: number;
}

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

interface ReplitMonitoringProps {
  projectId: number;
}

export function ReplitMonitoring({ projectId }: ReplitMonitoringProps) {
  const { toast } = useToast();
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    cpu: { usage: 0, cores: 0, load: [0, 0, 0] },
    memory: { used: 0, total: 0, available: 0, percentage: 0 },
    disk: { used: 0, total: 0, available: 0, percentage: 0 },
    network: { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 }
  });
  
  const [appMetrics, setAppMetrics] = useState<ApplicationMetrics>({
    requests: { total: 0, success: 0, errors: 0, rate: 0 },
    response: { average: 0, p95: 0, p99: 0 },
    database: { connections: 0, queries: 0, slowQueries: 0, queryTime: 0 },
    uptime: 0
  });
  
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const metricsIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    fetchMetrics();
    fetchAlerts();
    startMetricsPolling();
    
    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, [projectId]);

  const startMetricsPolling = () => {
    metricsIntervalRef.current = setInterval(() => {
      fetchMetrics();
    }, 5000); // Update every 5 seconds
  };

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const [systemRes, appRes] = await Promise.all([
        fetch(`/api/monitoring/${projectId}/system`, { credentials: 'include' }),
        fetch(`/api/monitoring/${projectId}/application`, { credentials: 'include' })
      ]);
      
      if (systemRes.ok) {
        const systemData = await systemRes.json();
        setSystemMetrics(systemData.metrics);
      }
      
      if (appRes.ok) {
        const appData = await appRes.json();
        setAppMetrics(appData.metrics);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch(`/api/monitoring/${projectId}/alerts`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await apiRequest('POST', `/api/monitoring/${projectId}/alerts/${alertId}/resolve`);

      if (response.ok) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId ? { ...alert, resolved: true } : alert
        ));
        toast({
          title: "Alert Resolved",
          description: "Alert has been marked as resolved"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to resolve alert",
        variant: "destructive"
      });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const getHealthStatus = () => {
    const cpuHealthy = systemMetrics.cpu.usage < 80;
    const memoryHealthy = systemMetrics.memory.percentage < 85;
    const diskHealthy = systemMetrics.disk.percentage < 90;
    const errorRateHealthy = (appMetrics.requests.errors / appMetrics.requests.total) < 0.05;
    
    const healthyChecks = [cpuHealthy, memoryHealthy, diskHealthy, errorRateHealthy].filter(Boolean).length;
    
    if (healthyChecks >= 4) return { status: 'healthy', color: 'text-green-600' };
    if (healthyChecks >= 2) return { status: 'warning', color: 'text-yellow-600' };
    return { status: 'critical', color: 'text-red-600' };
  };

  const health = getHealthStatus();
  const activeAlerts = alerts.filter(a => !a.resolved);
  const criticalAlerts = activeAlerts.filter(a => a.type === 'critical');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Application Monitoring
          </h2>
          <p className="text-muted-foreground">
            Real-time performance monitoring and alerting
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge className={`${health.color} bg-opacity-10 border-current`}>
            {health.status === 'healthy' && <CheckCircle className="h-3 w-3 mr-1" />}
            {health.status === 'warning' && <AlertTriangle className="h-3 w-3 mr-1" />}
            {health.status === 'critical' && <AlertTriangle className="h-3 w-3 mr-1" />}
            System {health.status}
          </Badge>
          
          {criticalAlerts.length > 0 && (
            <Badge className="text-red-600 bg-red-50 border-red-200">
              {criticalAlerts.length} Critical Alert{criticalAlerts.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-[13px] text-muted-foreground">CPU Usage</p>
                <p className={`text-2xl font-bold ${systemMetrics.cpu.usage > 80 ? 'text-red-600' : 'text-green-600'}`}>
                  {systemMetrics.cpu.usage.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MemoryStick className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-[13px] text-muted-foreground">Memory</p>
                <p className={`text-2xl font-bold ${systemMetrics.memory.percentage > 85 ? 'text-red-600' : 'text-green-600'}`}>
                  {systemMetrics.memory.percentage.toFixed(1)}%
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatBytes(systemMetrics.memory.used)} / {formatBytes(systemMetrics.memory.total)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-[13px] text-muted-foreground">Requests/sec</p>
                <p className="text-2xl font-bold">{appMetrics.requests.rate.toFixed(1)}</p>
                <div className="flex items-center gap-1 text-[11px]">
                  {appMetrics.requests.rate > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  )}
                  <span className="text-muted-foreground">
                    {appMetrics.requests.total} total
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-[13px] text-muted-foreground">Response Time</p>
                <p className="text-2xl font-bold">{appMetrics.response.average.toFixed(0)}ms</p>
                <p className="text-[11px] text-muted-foreground">
                  p95: {appMetrics.response.p95.toFixed(0)}ms
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="system" className="space-y-4">
        <TabsList>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="application">Application</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="alerts">Alerts ({activeAlerts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CPU Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  CPU Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-[13px] mb-1">
                    <span>Usage</span>
                    <span>{systemMetrics.cpu.usage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        systemMetrics.cpu.usage > 80 ? 'bg-red-500' : 
                        systemMetrics.cpu.usage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${systemMetrics.cpu.usage}%` }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-[13px]">
                  <div>
                    <p className="text-muted-foreground">Cores</p>
                    <p className="font-medium">{systemMetrics.cpu.cores}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Load Average</p>
                    <p className="font-medium">{systemMetrics.cpu.load[0]?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Memory Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MemoryStick className="h-4 w-4" />
                  Memory Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-[13px] mb-1">
                    <span>Used</span>
                    <span>{systemMetrics.memory.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        systemMetrics.memory.percentage > 85 ? 'bg-red-500' : 
                        systemMetrics.memory.percentage > 70 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${systemMetrics.memory.percentage}%` }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-[13px]">
                  <div>
                    <p className="text-muted-foreground">Used</p>
                    <p className="font-medium">{formatBytes(systemMetrics.memory.used)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Available</p>
                    <p className="font-medium">{formatBytes(systemMetrics.memory.available)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Disk Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Disk Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-[13px] mb-1">
                    <span>Used</span>
                    <span>{systemMetrics.disk.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        systemMetrics.disk.percentage > 90 ? 'bg-red-500' : 
                        systemMetrics.disk.percentage > 75 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${systemMetrics.disk.percentage}%` }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-[13px]">
                  <div>
                    <p className="text-muted-foreground">Used</p>
                    <p className="font-medium">{formatBytes(systemMetrics.disk.used)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Free</p>
                    <p className="font-medium">{formatBytes(systemMetrics.disk.available)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Network Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  Network Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-[13px]">
                  <div>
                    <p className="text-muted-foreground">Bytes In</p>
                    <p className="font-medium">{formatBytes(systemMetrics.network.bytesIn)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Bytes Out</p>
                    <p className="font-medium">{formatBytes(systemMetrics.network.bytesOut)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Packets In</p>
                    <p className="font-medium">{systemMetrics.network.packetsIn.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Packets Out</p>
                    <p className="font-medium">{systemMetrics.network.packetsOut.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="application" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Request Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  HTTP Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{appMetrics.requests.total}</p>
                      <p className="text-[11px] text-muted-foreground">Total</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{appMetrics.requests.success}</p>
                      <p className="text-[11px] text-muted-foreground">Success</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{appMetrics.requests.errors}</p>
                      <p className="text-[11px] text-muted-foreground">Errors</p>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-[13px] mb-1">
                      <span>Success Rate</span>
                      <span>{((appMetrics.requests.success / appMetrics.requests.total) * 100 || 0).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-green-500"
                        style={{ width: `${(appMetrics.requests.success / appMetrics.requests.total) * 100 || 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Response Time */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Response Times
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-[13px] text-muted-foreground">Average</span>
                    <span className="font-medium">{appMetrics.response.average.toFixed(0)}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[13px] text-muted-foreground">95th Percentile</span>
                    <span className="font-medium">{appMetrics.response.p95.toFixed(0)}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[13px] text-muted-foreground">99th Percentile</span>
                    <span className="font-medium">{appMetrics.response.p99.toFixed(0)}ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Uptime */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-[13px]">Application Running</span>
                  </div>
                  <div>
                    <p className="text-[13px] text-muted-foreground">Uptime</p>
                    <p className="text-2xl font-bold">{formatUptime(appMetrics.uptime)}</p>
                  </div>
                  <div>
                    <p className="text-[13px] text-muted-foreground">Started</p>
                    <p className="text-[13px]">{new Date(Date.now() - appMetrics.uptime * 1000).toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" />
                Database Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{appMetrics.database.connections}</p>
                  <p className="text-[13px] text-muted-foreground">Active Connections</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{appMetrics.database.queries}</p>
                  <p className="text-[13px] text-muted-foreground">Queries/sec</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">{appMetrics.database.slowQueries}</p>
                  <p className="text-[13px] text-muted-foreground">Slow Queries</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">{appMetrics.database.queryTime.toFixed(1)}ms</p>
                  <p className="text-[13px] text-muted-foreground">Avg Query Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {activeAlerts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
                <p className="text-muted-foreground">No active alerts</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeAlerts.map((alert) => (
                <Card key={alert.id} className={`border-l-4 ${
                  alert.type === 'critical' ? 'border-l-red-500' :
                  alert.type === 'warning' ? 'border-l-yellow-500' : 'border-l-blue-500'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {alert.type === 'critical' && <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />}
                        {alert.type === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />}
                        {alert.type === 'info' && <Shield className="h-5 w-5 text-blue-600 mt-0.5" />}
                        
                        <div>
                          <h3 className="font-medium">{alert.title}</h3>
                          <p className="text-[13px] text-muted-foreground mt-1">{alert.message}</p>
                          <p className="text-[11px] text-muted-foreground mt-2">
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resolveAlert(alert.id)}
                      >
                        Resolve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}