import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Users, 
  FolderGit2, 
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface ProviderHealth {
  provider: string;
  status: 'healthy' | 'unhealthy' | 'timeout' | 'missing';
  responseTime?: number;
  error?: string;
  recommendation?: string;
}

export default function MobileAdminDashboard() {
  const { data: stats, isLoading } = useQuery<{
    users: number;
    projects: number;
    activeUsers: number;
    totalSessions: number;
  }>({
    queryKey: ['/api/admin/dashboard/stats']
  });

  const { data: providerHealth, isLoading: isLoadingHealth } = useQuery<{ providers: ProviderHealth[] }>({
    queryKey: ['/api/health/providers'],
    refetchInterval: 60000
  });

  const statCards = [
    { 
      title: 'Total Users', 
      value: stats?.users ?? 0, 
      icon: Users, 
      color: 'text-blue-500',
      description: 'Registered users'
    },
    { 
      title: 'Projects', 
      value: stats?.projects ?? 0, 
      icon: FolderGit2, 
      color: 'text-purple-500',
      description: 'Active projects'
    },
    { 
      title: 'Active Users', 
      value: stats?.activeUsers ?? 0, 
      icon: Activity, 
      color: 'text-green-500',
      description: 'Last 24 hours'
    },
    { 
      title: 'AI Sessions', 
      value: stats?.totalSessions ?? 0, 
      icon: TrendingUp, 
      color: 'text-orange-500',
      description: 'Total sessions'
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Mobile Header */}
      <div className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800 p-4">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-[13px] text-zinc-400 mt-1">E-Code Platform Management</p>
      </div>

      <div className="p-4 space-y-6">
        {/* Stats Grid - Mobile Optimized */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="bg-zinc-800 border-zinc-700">
                <CardContent className="p-4">
                  <div className="h-16 bg-zinc-700 rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card 
                  key={stat.title} 
                  className="bg-zinc-800 border-zinc-700"
                  data-testid={`card-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                    <p className="text-[11px] text-zinc-500 mt-1">{stat.title}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* AI Provider Health Status - Mobile Optimized */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-zinc-400" />
              AI Provider Health
            </h2>
            {!isLoadingHealth && (
              <Badge variant="outline" className="text-[11px] text-zinc-400 border-zinc-700">
                <RefreshCw className="h-3 w-3 mr-1" />
                Auto-refresh
              </Badge>
            )}
          </div>

          <Card className="bg-zinc-800 border-zinc-700" data-testid="card-provider-health">
            <CardContent className="p-4">
              {isLoadingHealth ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg">
                      <div className="h-4 bg-zinc-700 rounded w-20 animate-pulse" />
                      <div className="h-4 bg-zinc-700 rounded w-12 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {providerHealth?.providers.map((provider) => {
                    const isHealthy = provider.status === 'healthy';
                    const isTimeout = provider.status === 'timeout';
                    const isMissing = provider.status === 'missing';
                    const StatusIcon = isHealthy ? CheckCircle : isTimeout ? AlertCircle : XCircle;
                    const statusColor = isHealthy ? 'text-green-500' : isTimeout ? 'text-yellow-500' : 'text-red-500';
                    const bgColor = isHealthy ? 'bg-green-500/10' : isTimeout ? 'bg-yellow-500/10' : 'bg-red-500/10';
                    
                    return (
                      <div 
                        key={provider.provider} 
                        className={`p-3 ${bgColor} rounded-lg border border-zinc-800`}
                        data-testid={`provider-${provider.provider.toLowerCase()}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <StatusIcon className={`h-5 w-5 ${statusColor} flex-shrink-0`} />
                            <div>
                              <p className="text-[13px] font-medium text-white capitalize">
                                {provider.provider}
                              </p>
                              {provider.responseTime !== undefined && (
                                <p className="text-[11px] text-zinc-400 mt-0.5">
                                  {provider.responseTime}ms
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`text-[11px] ${statusColor} border-current`}
                          >
                            {provider.status}
                          </Badge>
                        </div>
                        
                        {provider.error && (
                          <p className="text-[11px] text-zinc-400 mt-2 pl-7">
                            {provider.error}
                          </p>
                        )}
                        
                        {provider.recommendation && (
                          <div className="mt-2 pl-7">
                            <p className="text-[11px] text-yellow-400">
                              💡 {provider.recommendation}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* System Status Summary */}
        <Card className="bg-zinc-800 border-zinc-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-zinc-400">Database</span>
              <Badge variant="outline" className="text-green-500 border-green-500/50">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-zinc-400">API Endpoints</span>
              <Badge variant="outline" className="text-green-500 border-green-500/50">
                <CheckCircle className="h-3 w-3 mr-1" />
                Operational
              </Badge>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-zinc-400">Valid AI Providers</span>
              <Badge variant="outline" className="text-blue-500 border-blue-500/50">
                {providerHealth?.providers.filter(p => p.status === 'healthy').length || 0}/5
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Mobile-Optimized Info */}
        <div className="text-center text-[11px] text-zinc-500 pb-4">
          <p>Provider health refreshes automatically every 60 seconds</p>
          <p className="mt-1">Pull to refresh or navigate to update stats</p>
        </div>
      </div>
    </div>
  );
}
