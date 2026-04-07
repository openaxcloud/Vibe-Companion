import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  DollarSign, 
  FileText, 
  Ticket,
  TrendingUp,
  Package,
  BookOpen,
  Globe,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { apiRequest } from '@/lib/queryClient';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  totalRevenue: number;
  activeSubscriptions: number;
  openTickets: number;
  publishedDocs: number;
  publishedPages: number;
}

interface ProviderHealth {
  provider: string;
  status: 'healthy' | 'unhealthy' | 'timeout';
  responseTime?: number;
  error?: string;
  recommendation?: string;
}

interface ActivityEvent {
  id: string;
  type: 'user_registration' | 'project_created' | 'support_ticket';
  title: string;
  description: string;
  timestamp: string;
}

export function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/admin/dashboard/stats']
  });

  const { data: providerHealth, isLoading: isLoadingHealth } = useQuery<{ providers: ProviderHealth[] }>({
    queryKey: ['/api/health/providers'],
    refetchInterval: 60000
  });

  const { data: activityData, isLoading: isLoadingActivity } = useQuery<{ events: ActivityEvent[] }>({
    queryKey: ['/api/admin/dashboard/activity'],
    refetchInterval: 30000
  });

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers ?? 0,
      icon: Users,
      description: `${stats?.activeUsers ?? 0} active in last 30 days`,
      color: 'text-blue-500'
    },
    {
      title: 'Revenue',
      value: `$${(stats?.totalRevenue ?? 0).toFixed(2)}`,
      icon: DollarSign,
      description: `${stats?.activeSubscriptions ?? 0} active subscriptions`,
      color: 'text-green-500'
    },
    {
      title: 'Projects',
      value: stats?.totalProjects ?? 0,
      icon: Package,
      description: 'Total projects created',
      color: 'text-purple-500'
    },
    {
      title: 'Open Tickets',
      value: stats?.openTickets ?? 0,
      icon: Ticket,
      description: 'Awaiting response',
      color: 'text-orange-500'
    },
    {
      title: 'Documentation',
      value: stats?.publishedDocs ?? 0,
      icon: BookOpen,
      description: 'Published articles',
      color: 'text-cyan-500'
    },
    {
      title: 'CMS Pages',
      value: stats?.publishedPages ?? 0,
      icon: FileText,
      description: 'Published pages',
      color: 'text-pink-500'
    }
  ];

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8">
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2" data-testid="heading-admin-dashboard">Admin Dashboard</h1>
          <p className="text-[11px] sm:text-[13px] text-zinc-400" data-testid="text-dashboard-subtitle">Overview of your platform statistics</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-zinc-800 border-zinc-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-2">
                  <div className="h-3 sm:h-4 bg-zinc-700 rounded w-20 sm:w-24 animate-pulse" />
                  <div className="h-6 w-6 sm:h-8 sm:w-8 bg-zinc-700 rounded animate-pulse" />
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="h-6 sm:h-8 bg-zinc-700 rounded w-12 sm:w-16 mb-1 animate-pulse" />
                  <div className="h-2 sm:h-3 bg-zinc-700 rounded w-24 sm:w-32 animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.title} className="bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-colors" data-testid={`card-stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-2">
                    <CardTitle className="text-[11px] sm:text-[13px] font-medium text-zinc-300">
                      {stat.title}
                    </CardTitle>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0">
                    <div className="text-[15px] sm:text-2xl font-bold text-white" data-testid={`text-stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}-value`}>{stat.value}</div>
                    <p className="text-[10px] sm:text-[11px] text-zinc-500 mt-1 truncate">{stat.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* AI Provider Health Status */}
        <div className="mt-4 sm:mt-6 lg:mt-8">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-[15px] lg:text-xl font-semibold text-white" data-testid="heading-ai-provider-health">AI Provider Health</h2>
            <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
          </div>
          <Card className="bg-zinc-800 border-zinc-700">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              {isLoadingHealth ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="h-4 bg-zinc-700 rounded w-24 animate-pulse" />
                      <div className="h-4 bg-zinc-700 rounded w-16 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {providerHealth?.providers?.map((provider) => {
                    const isHealthy = provider.status === 'healthy';
                    const isTimeout = provider.status === 'timeout';
                    const StatusIcon = isHealthy ? CheckCircle : isTimeout ? AlertCircle : XCircle;
                    const statusColor = isHealthy ? 'text-green-500' : isTimeout ? 'text-yellow-500' : 'text-red-500';
                    
                    return (
                      <div key={provider.provider} className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800" data-testid={`card-provider-${provider.provider.toLowerCase()}`}>
                        <div className="flex items-center space-x-3">
                          <StatusIcon className={`h-5 w-5 ${statusColor}`} />
                          <div>
                            <p className="text-[13px] font-medium text-white capitalize" data-testid={`text-provider-${provider.provider.toLowerCase()}-name`}>{provider.provider}</p>
                            {provider.error && (
                              <p className="text-[11px] text-zinc-500 mt-0.5">{provider.error}</p>
                            )}
                            {provider.recommendation && (
                              <p className="text-[11px] text-yellow-400 mt-0.5">{provider.recommendation}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {provider.responseTime !== undefined ? (
                            <p className="text-[13px] text-zinc-400">{provider.responseTime}ms</p>
                          ) : (
                            <p className="text-[13px] text-zinc-500">N/A</p>
                          )}
                          <p className={`text-[11px] ${statusColor} capitalize`}>{provider.status}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="mt-4 sm:mt-6 lg:mt-8">
          <h2 className="text-base sm:text-[15px] lg:text-xl font-semibold text-white mb-3 sm:mb-4" data-testid="heading-recent-activity">Recent Activity</h2>
          <Card className="bg-zinc-800 border-zinc-700">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="space-y-4">
                {isLoadingActivity ? (
                  <p className="text-[13px] text-zinc-500">Loading activity...</p>
                ) : activityData?.events && activityData.events.length > 0 ? (
                  activityData.events.slice(0, 5).map((event) => (
                    <div key={event.id} className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className={`w-2 h-2 rounded-full ${
                          event.type === 'user_registration' ? 'bg-green-500' :
                          event.type === 'project_created' ? 'bg-blue-500' :
                          'bg-orange-500'
                        }`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-white">{event.title ?? 'Untitled Event'}</p>
                        <p className="text-[11px] text-zinc-500">{event.description ?? 'No description'}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[13px] text-zinc-500">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 sm:mt-6 lg:mt-8">
          <h2 className="text-base sm:text-[15px] lg:text-xl font-semibold text-white mb-3 sm:mb-4" data-testid="heading-quick-actions">Quick Actions</h2>
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
            <Card 
              className="bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-colors cursor-pointer" 
              data-testid="card-quick-action-users"
              onClick={() => window.location.href = '/admin/users'}
            >
              <CardContent className="p-3 sm:p-4 flex items-center space-x-2 sm:space-x-3">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                <span className="text-[11px] sm:text-[13px] text-white">View All Users</span>
              </CardContent>
            </Card>
            <Card 
              className="bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-colors cursor-pointer" 
              data-testid="card-quick-action-tickets"
              onClick={() => window.location.href = '/admin/requests'}
            >
              <CardContent className="p-3 sm:p-4 flex items-center space-x-2 sm:space-x-3">
                <Ticket className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                <span className="text-[11px] sm:text-[13px] text-white">Open Tickets</span>
              </CardContent>
            </Card>
            <Card 
              className="bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-colors cursor-pointer" 
              data-testid="card-quick-action-revenue"
              onClick={() => window.location.href = '/admin/billing'}
            >
              <CardContent className="p-3 sm:p-4 flex items-center space-x-2 sm:space-x-3">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                <span className="text-[11px] sm:text-[13px] text-white">Revenue Report</span>
              </CardContent>
            </Card>
            <Card 
              className="bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-colors cursor-pointer" 
              data-testid="card-quick-action-status"
              onClick={() => window.location.href = '/admin/monitoring'}
            >
              <CardContent className="p-3 sm:p-4 flex items-center space-x-2 sm:space-x-3">
                <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                <span className="text-[11px] sm:text-[13px] text-white">System Status</span>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}