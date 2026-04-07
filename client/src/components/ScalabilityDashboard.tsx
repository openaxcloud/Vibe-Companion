import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { 
  Server, Database, Cloud, Activity, Cpu, HardDrive, 
  Zap, Shield, Globe, BarChart3, RefreshCw, Settings,
  CheckCircle2, AlertCircle, XCircle
} from 'lucide-react';

interface ClusterStatus {
  status: string;
  cluster: {
    metrics: {
      totalCPU: number;
      totalMemory: number;
      usedCPU: number;
      usedMemory: number;
      activeContainers: number;
      totalRequests: number;
      errorRate: number;
    };
    containers: Array<{
      id: string;
      projectId: string;
      status: string;
      port: number;
      resources: {
        cpuLimit: number;
        memoryLimit: number;
      };
    }>;
    health: {
      cpuUtilization: number;
      memoryUtilization: number;
      containerCount: number;
      requestsPerSecond: number;
      errorRate: number;
    };
  };
  loadBalancer: {
    services: Record<string, any>;
  };
  services: {
    redis: string;
    database: string;
    cdn: string;
  };
}

interface DatabasePoolStats {
  stats: {
    totalConnections: number;
    idleConnections: number;
    activeConnections: number;
    waitingRequests: number;
    configuration: {
      max: number;
      min: number;
      idleTimeoutMillis: number;
      connectionTimeoutMillis: number;
    };
  };
  health: {
    status: string;
    activeConnections: number;
    waitingRequests: number;
  };
}

interface CDNStatus {
  enabled: boolean;
  providers: {
    cloudflare: boolean;
    cloudfront: boolean;
    fastly: boolean;
  };
  edgeLocations: string[];
  purgeStats: {
    totalPurges: number;
    urlsPurged: number;
    tagsPurged: number;
    lastPurge: string | null;
  };
}

export const ScalabilityDashboard: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch cluster status
  const { data: clusterStatus, isLoading: clusterLoading, refetch: refetchCluster } = useQuery<ClusterStatus>({
    queryKey: ['/api/scalability/cluster/status'],
    refetchInterval: 30000, // RATE LIMIT FIX: Increased from 5s to 30s
    refetchIntervalInBackground: false,
  });

  // Fetch database pool stats
  const { data: poolStats, isLoading: poolLoading } = useQuery<DatabasePoolStats>({
    queryKey: ['/api/scalability/database/pool/stats'],
    refetchInterval: 10000
  });

  // Fetch CDN status
  const { data: cdnStatus, isLoading: cdnLoading } = useQuery<CDNStatus>({
    queryKey: ['/api/scalability/cdn/status'],
    refetchInterval: 30000
  });

  // Create container mutation
  const createContainer = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiRequest('POST', '/api/scalability/cluster/containers', { userId: '1', projectId });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Container created successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/scalability/cluster/status'] });
    },
    onError: () => {
      toast({ title: 'Failed to create container', variant: 'destructive' });
    }
  });

  // Scale cluster mutation
  const scaleCluster = useMutation({
    mutationFn: async (direction: 'up' | 'down') => {
      const response = await apiRequest('POST', `/api/scalability/cluster/scale/${direction}`);
      return response.json();
    },
    onSuccess: (_, direction) => {
      toast({ title: `Cluster scaled ${direction} successfully` });
      refetchCluster();
    }
  });

  // Purge CDN cache
  const purgeCDN = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/scalability/cdn/purge', { pattern: '*' });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'CDN cache purged successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/scalability/cdn/status'] });
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
      case 'active':
      case 'healthy':
      case 'running':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'degraded':
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'down':
      case 'error':
      case 'stopped':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'operational':
      case 'active':
      case 'healthy':
      case 'running':
        return 'default';
      case 'degraded':
      case 'warning':
        return 'secondary';
      case 'down':
      case 'error':
      case 'stopped':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Scalability Dashboard</h1>
          <p className="text-muted-foreground">Fortune 500-grade infrastructure management</p>
        </div>
        <Button onClick={() => refetchCluster()} variant="outline" data-testid="button-refresh-cluster">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">System Status</CardTitle>
            {getStatusIcon(clusterStatus?.status || 'unknown')}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {clusterStatus?.status || 'Loading...'}
            </div>
            <p className="text-[11px] text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Active Containers</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clusterStatus?.cluster.metrics.activeContainers || 0}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Running instances
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clusterStatus?.cluster.health.cpuUtilization.toFixed(1) || 0}%
            </div>
            <Progress 
              value={clusterStatus?.cluster.health.cpuUtilization || 0} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Memory Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clusterStatus?.cluster.health.memoryUtilization.toFixed(1) || 0}%
            </div>
            <Progress 
              value={clusterStatus?.cluster.health.memoryUtilization || 0} 
              className="mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="cdn">CDN</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Infrastructure Services</CardTitle>
              <CardDescription>Real-time status of scalability components</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-4 border rounded">
                  <div className="flex items-center space-x-3">
                    <Database className="h-5 w-5" />
                    <div>
                      <p className="font-medium">Redis Cache</p>
                      <p className="text-[13px] text-muted-foreground">In-memory data store</p>
                    </div>
                  </div>
                  <Badge variant={getStatusColor(clusterStatus?.services.redis || 'unknown')}>
                    {clusterStatus?.services.redis || 'Unknown'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded">
                  <div className="flex items-center space-x-3">
                    <Shield className="h-5 w-5" />
                    <div>
                      <p className="font-medium">Database Pool</p>
                      <p className="text-[13px] text-muted-foreground">Connection pooling</p>
                    </div>
                  </div>
                  <Badge variant={getStatusColor(clusterStatus?.services.database || 'unknown')}>
                    {clusterStatus?.services.database || 'Unknown'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded">
                  <div className="flex items-center space-x-3">
                    <Globe className="h-5 w-5" />
                    <div>
                      <p className="font-medium">CDN</p>
                      <p className="text-[13px] text-muted-foreground">Content delivery</p>
                    </div>
                  </div>
                  <Badge variant={getStatusColor(clusterStatus?.services.cdn || 'unknown')}>
                    {clusterStatus?.services.cdn || 'Unknown'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cluster Actions</CardTitle>
              <CardDescription>Manage your infrastructure scaling</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button 
                onClick={() => scaleCluster.mutate('up')}
                disabled={scaleCluster.isPending}
                data-testid="button-scale-up"
              >
                <Zap className="h-4 w-4 mr-2" />
                Scale Up
              </Button>
              <Button 
                onClick={() => scaleCluster.mutate('down')}
                disabled={scaleCluster.isPending}
                variant="outline"
                data-testid="button-scale-down"
              >
                Scale Down
              </Button>
              <Button 
                onClick={() => createContainer.mutate('new-project')}
                disabled={createContainer.isPending}
                variant="outline"
                data-testid="button-create-container"
              >
                <Server className="h-4 w-4 mr-2" />
                Create Container
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="containers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Containers</CardTitle>
              <CardDescription>
                {clusterStatus?.cluster.containers.length || 0} containers running
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clusterStatus?.cluster.containers.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No containers are currently running. Create a new container to get started.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {clusterStatus?.cluster.containers.map((container) => (
                    <div key={container.id} className="flex items-center justify-between p-4 border rounded">
                      <div className="flex items-center space-x-4">
                        <Server className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{container.id}</p>
                          <p className="text-[13px] text-muted-foreground">
                            Project: {container.projectId} • Port: {container.port}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-[13px]">CPU: {container.resources.cpuLimit}%</p>
                          <p className="text-[13px]">Memory: {container.resources.memoryLimit}MB</p>
                        </div>
                        <Badge variant={getStatusColor(container.status)}>
                          {container.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Database Connection Pool</CardTitle>
              <CardDescription>Enterprise-grade connection management</CardDescription>
            </CardHeader>
            <CardContent>
              {poolStats && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[13px] text-muted-foreground">Total Connections</p>
                      <p className="text-2xl font-bold">{poolStats.stats.totalConnections}</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-muted-foreground">Active</p>
                      <p className="text-2xl font-bold">{poolStats.stats.activeConnections}</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-muted-foreground">Idle</p>
                      <p className="text-2xl font-bold">{poolStats.stats.idleConnections}</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-muted-foreground">Waiting</p>
                      <p className="text-2xl font-bold">{poolStats.stats.waitingRequests}</p>
                    </div>
                  </div>

                  <div className="border rounded p-4">
                    <h4 className="font-medium mb-2">Pool Configuration</h4>
                    <div className="grid grid-cols-2 gap-2 text-[13px]">
                      <div>Max Connections: {poolStats.stats.configuration.max}</div>
                      <div>Min Connections: {poolStats.stats.configuration.min}</div>
                      <div>Idle Timeout: {poolStats.stats.configuration.idleTimeoutMillis}ms</div>
                      <div>Connection Timeout: {poolStats.stats.configuration.connectionTimeoutMillis}ms</div>
                    </div>
                  </div>

                  <Alert>
                    <Database className="h-4 w-4" />
                    <AlertDescription>
                      Pool Status: <Badge variant={getStatusColor(poolStats.health.status)}>
                        {poolStats.health.status}
                      </Badge>
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cdn" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>CDN Configuration</CardTitle>
              <CardDescription>Multi-provider content delivery network</CardDescription>
            </CardHeader>
            <CardContent>
              {cdnStatus && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">CDN Status</p>
                      <p className="text-[13px] text-muted-foreground">
                        {cdnStatus.enabled ? 'Enabled and serving content' : 'Disabled'}
                      </p>
                    </div>
                    <Badge variant={cdnStatus.enabled ? 'default' : 'secondary'} className={cdnStatus.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}>
                      {cdnStatus.enabled ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">CDN Providers</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="border rounded p-3">
                        <p className="font-medium">Cloudflare</p>
                        <Badge variant={cdnStatus.providers.cloudflare ? 'default' : 'secondary'} className={cdnStatus.providers.cloudflare ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}>
                          {cdnStatus.providers.cloudflare ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="border rounded p-3">
                        <p className="font-medium">CloudFront</p>
                        <Badge variant={cdnStatus.providers.cloudfront ? 'default' : 'secondary'} className={cdnStatus.providers.cloudfront ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}>
                          {cdnStatus.providers.cloudfront ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="border rounded p-3">
                        <p className="font-medium">Fastly</p>
                        <Badge variant={cdnStatus.providers.fastly ? 'default' : 'secondary'} className={cdnStatus.providers.fastly ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}>
                          {cdnStatus.providers.fastly ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Edge Locations</h4>
                    <div className="flex flex-wrap gap-2">
                      {cdnStatus.edgeLocations.map((location) => (
                        <Badge key={location} variant="outline">
                          {location}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="border rounded p-4">
                    <h4 className="font-medium mb-2">Cache Statistics</h4>
                    <div className="grid grid-cols-2 gap-2 text-[13px]">
                      <div>Total Purges: {cdnStatus.purgeStats.totalPurges}</div>
                      <div>URLs Purged: {cdnStatus.purgeStats.urlsPurged}</div>
                      <div>Tags Purged: {cdnStatus.purgeStats.tagsPurged}</div>
                      <div>Last Purge: {cdnStatus.purgeStats.lastPurge || 'Never'}</div>
                    </div>
                    <Button 
                      onClick={() => purgeCDN.mutate(undefined)}
                      disabled={purgeCDN.isPending}
                      className="mt-4"
                      variant="outline"
                      data-testid="button-purge-cdn"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Purge Cache
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Metrics</CardTitle>
              <CardDescription>Real-time performance monitoring</CardDescription>
            </CardHeader>
            <CardContent>
              {clusterStatus && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[13px] text-muted-foreground">Total CPU</p>
                      <p className="text-2xl font-bold">{clusterStatus.cluster.metrics.totalCPU}</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-muted-foreground">Used CPU</p>
                      <p className="text-2xl font-bold">{clusterStatus.cluster.metrics.usedCPU}</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-muted-foreground">Total Memory</p>
                      <p className="text-2xl font-bold">
                        {(clusterStatus.cluster.metrics.totalMemory / 1024).toFixed(1)}GB
                      </p>
                    </div>
                    <div>
                      <p className="text-[13px] text-muted-foreground">Used Memory</p>
                      <p className="text-2xl font-bold">
                        {(clusterStatus.cluster.metrics.usedMemory / 1024).toFixed(1)}GB
                      </p>
                    </div>
                  </div>

                  <div className="border rounded p-4">
                    <h4 className="font-medium mb-2">Request Metrics</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-[13px] text-muted-foreground">Total Requests</p>
                        <p className="text-xl font-bold">
                          {clusterStatus.cluster.metrics.totalRequests}
                        </p>
                      </div>
                      <div>
                        <p className="text-[13px] text-muted-foreground">Requests/sec</p>
                        <p className="text-xl font-bold">
                          {clusterStatus.cluster.health.requestsPerSecond}
                        </p>
                      </div>
                      <div>
                        <p className="text-[13px] text-muted-foreground">Error Rate</p>
                        <p className="text-xl font-bold">
                          {clusterStatus.cluster.health.errorRate.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ScalabilityDashboard;