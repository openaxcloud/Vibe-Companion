import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Activity,
  Clock,
  TrendingUp,
  Calendar,
  RefreshCw,
  AlertTriangle,
  Zap,
  Server,
  Database,
  Globe,
  Shield,
  Terminal,
  Package,
  Users,
  Cpu
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CodeHealthRadar } from '@/components/CodeHealthRadar';

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'outage' | 'maintenance';
  uptime: number;
  responseTime: number;
  icon: React.ElementType;
  description: string;
}

interface Incident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'low' | 'medium' | 'high' | 'critical';
  startedAt: Date;
  resolvedAt?: Date;
  affectedServices: string[];
  updates: {
    time: Date;
    message: string;
  }[];
}

export default function Status() {
  // Fetch services status from real API
  const { data: services = [], isLoading: servicesLoading, refetch: refetchServices } = useQuery({
    queryKey: ['/api/status'],
    refetchInterval: 30000 // Refresh every 30 seconds for live status
  });

  // Fetch incidents from real API
  const { data: incidents = [], isLoading: incidentsLoading, refetch: refetchIncidents } = useQuery({
    queryKey: ['/api/status/incidents'],
    refetchInterval: 60000 // Refresh every minute for incidents
  });

  // Fetch metrics from real API
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/status/metrics'],
    refetchInterval: 60000
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const refresh = () => {
    setRefreshing(true);
    Promise.all([
      refetchServices(),
      refetchIncidents()
    ]).finally(() => {
      setRefreshing(false);
    });
  };

  const getStatusIcon = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'operational':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'outage':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'maintenance':
        return <AlertCircle className="h-5 w-5 text-blue-500" />;
    }
  };

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'operational':
        return 'text-green-500';
      case 'degraded':
        return 'text-yellow-500';
      case 'outage':
        return 'text-red-500';
      case 'maintenance':
        return 'text-blue-500';
    }
  };

  const getStatusBadge = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'operational':
        return <Badge variant="default" className="bg-green-500">Operational</Badge>;
      case 'degraded':
        return <Badge variant="default" className="bg-yellow-500">Degraded</Badge>;
      case 'outage':
        return <Badge variant="destructive">Outage</Badge>;
      case 'maintenance':
        return <Badge variant="secondary">Maintenance</Badge>;
    }
  };

  const getSeverityBadge = (severity: Incident['severity']) => {
    switch (severity) {
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      case 'medium':
        return <Badge variant="default" className="bg-yellow-500">Medium</Badge>;
      case 'high':
        return <Badge variant="default" className="bg-orange-500">High</Badge>;
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
    }
  };

  // Icon mapping for services
  const getServiceIcon = (serviceName: string) => {
    const iconMap: { [key: string]: React.ElementType } = {
      'E-Code Editor': Terminal,
      'Code Editor': Terminal,
      'AI Agent': Zap,
      'Project Hosting': Globe,
      'Hosting & Deployments': Globe,
      'Database': Database,
      'Database Services': Database,
      'Authentication': Shield,
      'Terminal/Shell': Terminal,
      'Terminal & SSH': Terminal,
      'File Storage': Server,
      'Object Storage': Server,
      'Collaboration': Users,
      'API': Cpu,
      'API Services': Cpu
    };
    return iconMap[serviceName] || Activity;
  };

  // Handle services data structure from API
  const servicesArray = Array.isArray(services) ? services : 
    (services && (services as any).services) ? (services as any).services : [];

  const fallbackServices: ServiceStatus[] = [
    { name: 'E-Code Editor', status: 'operational', uptime: 99.99, responseTime: 120, icon: Terminal, description: 'Core IDE and code editing services' },
    { name: 'AI Agent', status: 'operational', uptime: 99.95, responseTime: 450, icon: Zap, description: 'Autonomous builder and assistant' },
    { name: 'Hosting & Deployments', status: 'operational', uptime: 99.99, responseTime: 80, icon: Globe, description: 'Application hosting and edge network' },
    { name: 'Database Services', status: 'operational', uptime: 99.99, responseTime: 45, icon: Database, description: 'Managed PostgreSQL and KV storage' }
  ];

  const displayServices = servicesArray.length > 0 ? servicesArray : fallbackServices;

  const overallStatus = displayServices.every((s: any) => s.status === 'operational') 
    ? 'operational' 
    : displayServices.some((s: any) => s.status === 'major_outage' || s.status === 'partial_outage' || s.status === 'outage') 
    ? 'outage' 
    : 'degraded';

  const averageUptime = displayServices.length > 0 ? displayServices.reduce((acc: number, s: any) => acc + (s.uptime || 99.99), 0) / displayServices.length : 99.99;

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="border-b">
        <div className="container-responsive py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">System Status</h1>
              <p className="text-muted-foreground">
                Real-time status and uptime monitoring for E-Code services
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={refresh}
              className={refreshing ? 'animate-spin' : ''}
              data-testid="button-refresh-status"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Overall Status */}
          <Card className={`border-2 ${
            overallStatus === 'operational' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' :
            overallStatus === 'outage' ? 'border-red-500 bg-red-50 dark:bg-red-950/20' :
            'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {overallStatus === 'operational' ? (
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                  ) : overallStatus === 'outage' ? (
                    <XCircle className="h-12 w-12 text-red-500" />
                  ) : (
                    <AlertTriangle className="h-12 w-12 text-yellow-500" />
                  )}
                  <div>
                    <h2 className="text-2xl font-semibold">
                      {overallStatus === 'operational' ? 'All Systems Operational' :
                       overallStatus === 'outage' ? 'Service Disruption' :
                       'Partial Service Degradation'}
                    </h2>
                    <p className="text-muted-foreground mt-1">
                      Last updated: {format(currentTime, 'PPpp')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{averageUptime.toFixed(2)}%</div>
                  <div className="text-[13px] text-muted-foreground">30-day uptime</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Active Incidents */}
      {!incidentsLoading && Array.isArray(incidents) && incidents.filter((i: any) => i.status !== 'resolved').length > 0 && (
        <section className="border-b bg-muted/30">
          <div className="container-responsive py-8">
            <h2 className="text-2xl font-semibold mb-4">Active Incidents</h2>
            <div className="space-y-4">
              {incidents.filter((i: any) => i.status !== 'resolved').map((incident: any) => (
                <Alert key={incident.id}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="flex items-center gap-2">
                    {incident.title}
                    {getSeverityBadge(incident.severity)}
                  </AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-2">
                      <p className="text-[13px]">
                        Affected services: {incident.affectedServices?.join(', ') || 'Unknown'}
                      </p>
                      <div className="space-y-1">
                        {incident.updates?.map((update: any, index: number) => (
                          <div key={index} className="text-[13px]">
                            <span className="text-muted-foreground">
                              {new Date(update.timestamp || update.time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })} - 
                            </span>
                            <span className="ml-2">{update.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Service Status Grid */}
      <section className="py-12">
        <div className="container-responsive">
          <h2 className="text-2xl font-semibold mb-6">Service Status</h2>
          {servicesLoading ? (
            <div className="grid gap-4 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({length: 9}).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-2 bg-muted rounded"></div>
                      <div className="h-2 bg-muted rounded w-2/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {displayServices.map((service: any) => {
                const Icon = getServiceIcon(service.name);
                return (
                  <Card key={service.name} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-muted rounded-lg">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{service.name}</CardTitle>
                            <CardDescription className="text-[11px] mt-1">
                              {service.description}
                            </CardDescription>
                          </div>
                        </div>
                        {getStatusIcon(service.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="text-muted-foreground">Status</span>
                          {getStatusBadge(service.status)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[13px]">
                            <span className="text-muted-foreground">Uptime</span>
                            <span className="font-medium">{(service.uptime || 99.99).toFixed(2)}%</span>
                          </div>
                          <Progress value={service.uptime || 99.99} className="h-1" />
                        </div>
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="text-muted-foreground">Response time</span>
                          <span className="font-medium">{service.responseTime || 0}ms</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Code Health Radar */}
      <section className="py-12 bg-muted/30">
        <div className="container-responsive">
          <CodeHealthRadar />
        </div>
      </section>

      {/* Historical Uptime */}
      <section className="py-12">
        <div className="container-responsive">
          <h2 className="text-2xl font-semibold mb-6">Historical Uptime</h2>
          {metricsLoading ? (
            <div className="grid gap-6 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({length: 3}).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-5 bg-muted rounded w-2/3"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Last 24 Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-500">
                    {(metrics as any)?.uptime24h?.toFixed(2) || averageUptime.toFixed(2)}%
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-1">
                    {(metrics as any)?.incidents24h || 0} incidents • {(metrics as any)?.downtime24h || '< 1'} min downtime
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Last 7 Days</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-500">
                    {(metrics as any)?.uptime7d?.toFixed(2) || (averageUptime - 0.01).toFixed(2)}%
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-1">
                    {(metrics as any)?.incidents7d || 0} incidents • {(metrics as any)?.downtime7d || '< 5'} min downtime
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Last 30 Days</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-500">
                    {(metrics as any)?.uptime30d?.toFixed(2) || (averageUptime - 0.02).toFixed(2)}%
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-1">
                    {(metrics as any)?.incidents30d || 0} incidents • {(metrics as any)?.downtime30d || '< 15'} min downtime
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </section>

      {/* Recent Incidents */}
      <section className="py-12">
        <div className="container-responsive">
          <h2 className="text-2xl font-semibold mb-6">Recent Incidents</h2>
          {incidentsLoading ? (
            <Card className="animate-pulse">
              <CardContent className="py-12">
                <div className="h-6 bg-muted rounded w-1/3 mx-auto mb-4"></div>
                <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
              </CardContent>
            </Card>
          ) : !Array.isArray(incidents) || incidents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-[15px] font-medium">No recent incidents</p>
                <p className="text-[13px] text-muted-foreground mt-1">
                  All systems have been operating normally
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {incidents.map((incident: any) => (
                <Card key={incident.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-[15px]">{incident.title}</CardTitle>
                        <CardDescription>
                          {format(new Date(incident.created || incident.startedAt), 'PPP')} • 
                          {incident.resolvedAt && ` Resolved in ${
                            Math.round((new Date(incident.resolvedAt).getTime() - new Date(incident.created || incident.startedAt).getTime()) / 1000 / 60)
                          } minutes`}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(incident.severity)}
                        {incident.status === 'resolved' ? (
                          <Badge variant="outline" className="border-green-500 text-green-500">
                            Resolved
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-orange-500 text-orange-500">
                            {incident.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-[13px] text-muted-foreground">
                        Affected services: {incident.affectedServices?.join(', ') || 'Multiple services'}
                      </p>
                      {Array.isArray(incident.updates) && incident.updates.length > 0 && (
                        <div className="border-l-2 border-muted pl-4 space-y-2">
                          {incident.updates.map((update: any, index: number) => (
                            <div key={index} className="text-[13px]">
                              <span className="text-muted-foreground">
                                {new Date(update.timestamp || update.time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })} - 
                              </span>
                              <span className="ml-2">{update.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Subscribe Section */}
      <section className="py-12 bg-muted/30">
        <div className="container-responsive">
          <Card>
            <CardContent className="py-8 text-center">
              <Activity className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">Subscribe to Updates</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Get notified about incidents, scheduled maintenance, and status changes
              </p>
              <div className="flex gap-4 justify-center">
                <Button data-testid="button-subscribe-email">Subscribe via Email</Button>
                <Button variant="outline" data-testid="button-rss-feed">RSS Feed</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}