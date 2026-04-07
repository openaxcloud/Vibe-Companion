import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Settings,
  Download,
  Share
} from 'lucide-react';
import { CodeHealthRadar } from '@/components/CodeHealthRadar';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

export default function HealthDashboard() {
  const [refreshing, setRefreshing] = useState(false);

  // Fetch system metrics for overview cards
  const { data: metrics, isLoading: metricsLoading, refetch } = useQuery({
    queryKey: ['/api/health/detailed'],
    refetchInterval: 30000
  });

  const refresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const overviewStats = [
    {
      title: 'System Health',
      value: '89.2%',
      change: '+2.3%',
      trend: 'up' as const,
      icon: Activity,
      description: 'Overall platform stability',
      status: 'good' as const
    },
    {
      title: 'Performance Score',
      value: '92.1%',
      change: '+0.8%',
      trend: 'up' as const,
      icon: TrendingUp,
      description: 'Response time & efficiency',
      status: 'excellent' as const
    },
    {
      title: 'Active Issues',
      value: '3',
      change: '-2',
      trend: 'down' as const,
      icon: AlertTriangle,
      description: 'Warnings requiring attention',
      status: 'warning' as const
    },
    {
      title: 'Services Online',
      value: '9/9',
      change: '100%',
      trend: 'stable' as const,
      icon: CheckCircle2,
      description: 'All core services operational',
      status: 'excellent' as const
    }
  ];

  const getStatusColor = (status: 'excellent' | 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-blue-500';
      case 'warning': return 'text-amber-500';
      case 'critical': return 'text-red-500';
    }
  };

  const getStatusBadge = (status: 'excellent' | 'good' | 'warning' | 'critical') => {
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

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    const baseClass = "h-4 w-4";
    switch (trend) {
      case 'up':
        return <TrendingUp className={`${baseClass} text-green-500`} />;
      case 'down':
        return <TrendingUp className={`${baseClass} text-red-500 rotate-180`} />;
      case 'stable':
        return <TrendingUp className={`${baseClass} text-muted-foreground rotate-90`} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container-responsive py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">System Health Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Real-time monitoring and health analytics for E-Code platform
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" data-testid="button-configure">
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
              <Button variant="outline" size="sm" data-testid="button-export">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" data-testid="button-share">
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={refresh}
                disabled={refreshing}
                data-testid="button-refresh"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container-responsive py-8 space-y-8">
        {/* Overview Cards */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {overviewStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.title} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${getStatusColor(stat.status)}`} />
                        <CardTitle className="text-[13px] font-medium">{stat.title}</CardTitle>
                      </div>
                      {getStatusBadge(stat.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">{stat.value}</span>
                        <div className="flex items-center gap-1 text-[13px]">
                          {getTrendIcon(stat.trend)}
                          <span className={
                            stat.trend === 'up' ? 'text-green-500' :
                            stat.trend === 'down' ? 'text-red-500' :
                            'text-muted-foreground'
                          }>
                            {stat.change}
                          </span>
                        </div>
                      </div>
                      <CardDescription className="text-[11px]">
                        {stat.description}
                      </CardDescription>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Code Health Radar */}
        <section>
          <CodeHealthRadar />
        </section>

        {/* Quick Actions */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>
                Common maintenance and optimization tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button variant="outline" className="h-16 flex flex-col gap-1" data-testid="button-health-check">
                  <Activity className="h-5 w-5" />
                  <span className="text-[13px]">Run Health Check</span>
                </Button>
                <Button variant="outline" className="h-16 flex flex-col gap-1" data-testid="button-performance-audit">
                  <TrendingUp className="h-5 w-5" />
                  <span className="text-[13px]">Performance Audit</span>
                </Button>
                <Button variant="outline" className="h-16 flex flex-col gap-1" data-testid="button-security-scan">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-[13px]">Security Scan</span>
                </Button>
                <Button variant="outline" className="h-16 flex flex-col gap-1" data-testid="button-generate-report">
                  <Download className="h-5 w-5" />
                  <span className="text-[13px]">Generate Report</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* System Alerts */}
        <section>
          <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                System Alerts
              </CardTitle>
              <CardDescription className="text-amber-600 dark:text-amber-400">
                Items requiring attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-card dark:bg-amber-950/40 rounded-lg">
                  <div className="w-2 h-2 bg-amber-500 rounded-full mt-2" />
                  <div className="flex-1">
                    <h4 className="font-medium text-[13px]">Database Connection Pool</h4>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Connection pool utilization is at 78%. Consider increasing pool size for better performance.
                    </p>
                    <Button size="sm" variant="link" className="h-auto p-0 text-[11px] mt-1">
                      View Details →
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 bg-card dark:bg-amber-950/40 rounded-lg">
                  <div className="w-2 h-2 bg-amber-500 rounded-full mt-2" />
                  <div className="flex-1">
                    <h4 className="font-medium text-[13px]">Memory Usage</h4>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      System memory usage has exceeded 85% threshold. Monitor for potential memory leaks.
                    </p>
                    <Button size="sm" variant="link" className="h-auto p-0 text-[11px] mt-1">
                      View Details →
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 bg-card dark:bg-amber-950/40 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                  <div className="flex-1">
                    <h4 className="font-medium text-[13px]">SSL Certificate</h4>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      SSL certificate for *.e-code.ai expires in 14 days. Renewal recommended.
                    </p>
                    <Button size="sm" variant="link" className="h-auto p-0 text-[11px] mt-1">
                      Renew Now →
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}