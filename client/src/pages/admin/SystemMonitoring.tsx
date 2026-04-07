import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  HardDrive, 
  Cpu, 
  MemoryStick, 
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Server,
  Clock,
  Users,
  FolderKanban,
  Gauge,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { queryClient } from '@/lib/queryClient';

interface SystemOverview {
  timestamp: string;
  database: {
    pool: {
      total: number;
      idle: number;
      waiting: number;
      max: number;
      usagePercent: number;
    };
    storage: {
      usedBytes: number;
      limitBytes: number;
      usedGB: number;
      limitGB: number;
      usagePercent: number;
    };
    performance: {
      totalQueries: number;
      totalErrors: number;
      avgQueryTimeMs: number;
      slowQueriesCount: number;
    };
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
    heapUsagePercent: number;
  };
  cpu: {
    loadAverage: {
      '1min': number;
      '5min': number;
      '15min': number;
    };
    cores: number;
    uptime: {
      seconds: number;
      formatted: string;
    };
  };
  projects: {
    total: number;
    active: number;
    avgStorageBytes: number;
  };
  users: {
    total: number;
    active: number;
    byTier: Record<string, number>;
  };
}

interface StorageAnalysis {
  timestamp: string;
  total: {
    sizeBytes: number;
    sizeGB: number;
    limitGB: number;
    usagePercent: number;
    remainingGB: number;
  };
  tables: Array<{
    table: string;
    sizePretty: string;
    sizeBytes: number;
    percentOfTotal: number;
  }>;
  topProjects: Array<{
    rank: number;
    id: number;
    name: string;
    fileCount: number;
    estimatedSizeMB: number;
    lastUpdated: string;
  }>;
}

interface SystemAlert {
  level: 'info' | 'warning' | 'critical';
  category: string;
  message: string;
  value: number;
  threshold: number;
}

interface AlertsResponse {
  timestamp: string;
  alerts: SystemAlert[];
  summary: {
    critical: number;
    warning: number;
    info: number;
  };
}

interface CapacityForecast {
  timestamp: string;
  currentUsage: {
    storage: { percent: number; usedGB: number; limitGB: number };
    connections: { percent: number; current: number; max: number };
    memory: { percent: number; usedMB: number; totalMB: number };
  };
  forecast: {
    storageDaysRemaining: number;
    estimatedDailyGrowthGB: number;
    projectedFullDate: string;
  };
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    category: string;
    recommendation: string;
    impact: string;
  }>;
}

function getStatusColor(percent: number): string {
  if (percent < 60) return 'bg-green-500';
  if (percent < 80) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getTextColor(percent: number): string {
  if (percent < 60) return 'text-green-500';
  if (percent < 80) return 'text-yellow-500';
  return 'text-red-500';
}

function AlertBanner({ alerts }: { alerts: SystemAlert[] }) {
  const criticalAlerts = alerts.filter(a => a.level === 'critical');
  const warningAlerts = alerts.filter(a => a.level === 'warning');

  if (criticalAlerts.length === 0 && warningAlerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mb-6">
      {criticalAlerts.map((alert, i) => (
        <div key={`critical-${i}`} className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium text-red-500">{alert.category}:</span>
            <span className="text-sm text-red-400 ml-2">{alert.message}</span>
          </div>
          <Badge variant="destructive">{alert.value}%</Badge>
        </div>
      ))}
      {warningAlerts.map((alert, i) => (
        <div key={`warning-${i}`} className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium text-yellow-500">{alert.category}:</span>
            <span className="text-sm text-yellow-400 ml-2">{alert.message}</span>
          </div>
          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">{alert.value}</Badge>
        </div>
      ))}
    </div>
  );
}

export function SystemMonitoring() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const { data: overview, isLoading: isLoadingOverview, refetch: refetchOverview } = useQuery<SystemOverview>({
    queryKey: ['/api/admin/system/overview'],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: storage, isLoading: isLoadingStorage, refetch: refetchStorage } = useQuery<StorageAnalysis>({
    queryKey: ['/api/admin/system/storage'],
    refetchInterval: autoRefresh ? 60000 : false,
  });

  const { data: alertsData, isLoading: isLoadingAlerts, refetch: refetchAlerts } = useQuery<AlertsResponse>({
    queryKey: ['/api/admin/system/alerts'],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: forecast, isLoading: isLoadingForecast, refetch: refetchForecast } = useQuery<CapacityForecast>({
    queryKey: ['/api/admin/system/capacity-forecast'],
    refetchInterval: autoRefresh ? 60000 : false,
  });

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refetchOverview(),
      refetchStorage(),
      refetchAlerts(),
      refetchForecast(),
    ]);
    setLastRefresh(new Date());
  }, [refetchOverview, refetchStorage, refetchAlerts, refetchForecast]);

  useEffect(() => {
    if (autoRefresh) {
      setLastRefresh(new Date());
    }
  }, [overview, autoRefresh]);

  const isLoading = isLoadingOverview || isLoadingStorage || isLoadingAlerts || isLoadingForecast;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">System Monitoring</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time infrastructure metrics and capacity planning
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto' : 'Manual'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {alertsData && <AlertBanner alerts={alertsData.alerts} />}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-500" />
                Database Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingOverview ? (
                <div className="h-24 animate-pulse bg-muted rounded" />
              ) : overview ? (
                <>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Pool Usage</span>
                      <span className={getTextColor(overview.database.pool.usagePercent)}>
                        {overview.database.pool.total}/{overview.database.pool.max}
                      </span>
                    </div>
                    <Progress 
                      value={overview.database.pool.usagePercent} 
                      className="h-2"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Storage</span>
                      <span className={getTextColor(overview.database.storage.usagePercent)}>
                        {overview.database.storage.usedGB}GB / {overview.database.storage.limitGB}GB
                      </span>
                    </div>
                    <Progress 
                      value={overview.database.storage.usagePercent} 
                      className="h-2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Queries</span>
                      <p className="font-medium">{overview.database.performance.totalQueries.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Avg Time</span>
                      <p className="font-medium">{overview.database.performance.avgQueryTimeMs}ms</p>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MemoryStick className="h-4 w-4 text-purple-500" />
                Memory Usage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingOverview ? (
                <div className="h-24 animate-pulse bg-muted rounded" />
              ) : overview ? (
                <>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Heap</span>
                      <span className={getTextColor(overview.memory.heapUsagePercent)}>
                        {overview.memory.heapUsedMB}MB / {overview.memory.heapTotalMB}MB
                      </span>
                    </div>
                    <Progress 
                      value={overview.memory.heapUsagePercent} 
                      className="h-2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">RSS</span>
                      <p className="font-medium">{overview.memory.rssMB}MB</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">External</span>
                      <p className="font-medium">{Math.round(overview.memory.external / (1024 * 1024))}MB</p>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Cpu className="h-4 w-4 text-orange-500" />
                CPU / Uptime
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingOverview ? (
                <div className="h-24 animate-pulse bg-muted rounded" />
              ) : overview ? (
                <>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <span className="text-muted-foreground">1min</span>
                      <p className="font-medium">{overview.cpu.loadAverage['1min'].toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <span className="text-muted-foreground">5min</span>
                      <p className="font-medium">{overview.cpu.loadAverage['5min'].toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <span className="text-muted-foreground">15min</span>
                      <p className="font-medium">{overview.cpu.loadAverage['15min'].toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Uptime</span>
                    </div>
                    <span className="font-medium text-green-500">{overview.cpu.uptime.formatted}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">CPU Cores</span>
                    <span className="font-medium">{overview.cpu.cores}</span>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-green-500" />
                Storage Capacity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingStorage ? (
                <div className="h-24 animate-pulse bg-muted rounded" />
              ) : storage ? (
                <>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Used</span>
                      <span className={getTextColor(storage.total.usagePercent)}>
                        {storage.total.usagePercent}%
                      </span>
                    </div>
                    <Progress 
                      value={storage.total.usagePercent} 
                      className="h-2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Used</span>
                      <p className="font-medium">{storage.total.sizeGB}GB</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Remaining</span>
                      <p className="font-medium text-green-500">{storage.total.remainingGB}GB</p>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                User Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingOverview ? (
                <div className="h-20 animate-pulse bg-muted rounded" />
              ) : overview ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold">{overview.users.total.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Users</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-500">{overview.users.active.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Active (30d)</p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">Users by Tier</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(overview.users.byTier).map(([tier, count]) => (
                        <Badge key={tier} variant="outline" className="text-xs">
                          {tier}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-purple-500" />
                Project Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingOverview ? (
                <div className="h-20 animate-pulse bg-muted rounded" />
              ) : overview ? (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-2xl font-bold">{overview.projects.total.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-500">{overview.projects.active.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Active (7d)</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{Math.round(overview.projects.avgStorageBytes / 1024)}KB</p>
                    <p className="text-xs text-muted-foreground">Avg Size</p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {forecast && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                Capacity Planning
              </CardTitle>
              <CardDescription>
                Storage forecast and optimization recommendations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Storage Forecast</span>
                  </div>
                  <p className={`text-3xl font-bold ${forecast.forecast.storageDaysRemaining < 30 ? 'text-red-500' : forecast.forecast.storageDaysRemaining < 90 ? 'text-yellow-500' : 'text-green-500'}`}>
                    {forecast.forecast.storageDaysRemaining} days
                  </p>
                  <p className="text-xs text-muted-foreground">until storage limit reached</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Daily Growth</span>
                  </div>
                  <p className="text-3xl font-bold">{forecast.forecast.estimatedDailyGrowthGB}GB</p>
                  <p className="text-xs text-muted-foreground">average per day</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Projected Full Date</span>
                  </div>
                  <p className="text-xl font-bold">
                    {new Date(forecast.forecast.projectedFullDate).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground">at current growth rate</p>
                </div>
              </div>

              {forecast.recommendations.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-3">Recommendations</h3>
                  <div className="space-y-2">
                    {forecast.recommendations.map((rec, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border ${
                          rec.priority === 'high'
                            ? 'bg-red-500/10 border-red-500/30'
                            : rec.priority === 'medium'
                            ? 'bg-yellow-500/10 border-yellow-500/30'
                            : 'bg-blue-500/10 border-blue-500/30'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {rec.priority === 'high' ? (
                            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                          ) : rec.priority === 'medium' ? (
                            <Info className="h-4 w-4 text-yellow-500 mt-0.5" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{rec.recommendation}</p>
                            <p className="text-xs text-muted-foreground mt-1">{rec.impact}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Top 10 Projects by Size</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStorage ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-8 animate-pulse bg-muted rounded" />
                  ))}
                </div>
              ) : storage?.topProjects?.length ? (
                <div className="space-y-2">
                  {storage.topProjects.map((project) => (
                    <div key={project.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-6">#{project.rank}</span>
                        <span className="font-medium truncate max-w-[200px]">{project.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{project.fileCount} files</span>
                        <span className="font-medium text-foreground">{project.estimatedSizeMB}MB</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No project data available</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Storage by Table</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStorage ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-8 animate-pulse bg-muted rounded" />
                  ))}
                </div>
              ) : storage?.tables?.length ? (
                <div className="space-y-2">
                  {storage.tables.slice(0, 10).map((table) => (
                    <div key={table.table} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{table.table}</span>
                        <span className="text-muted-foreground">{table.sizePretty}</span>
                      </div>
                      <Progress value={table.percentOfTotal} className="h-1" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No table data available</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

export default SystemMonitoring;
