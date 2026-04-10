// @ts-nocheck
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  Activity,
  Server,
  Database,
  Globe,
  Shield,
  Clock,
  TrendingUp,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface ServiceStatus {
  id: string;
  name: string;
  category: 'core' | 'features' | 'infrastructure';
  status: 'operational' | 'degraded' | 'partial' | 'down';
  uptime: number;
  responseTime: number;
  lastChecked: Date;
  description?: string;
  affectedRegions?: string[];
}

interface Incident {
  id: number;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedServices: string[];
  startedAt: Date;
  resolvedAt?: Date;
  updates: IncidentUpdate[];
}

interface IncidentUpdate {
  id: number;
  incidentId: number;
  message: string;
  timestamp: Date;
  status: Incident['status'];
}

interface MaintenanceWindow {
  id: number;
  title: string;
  description: string;
  scheduledFor: Date;
  duration: number; // minutes
  affectedServices: string[];
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

interface Metric {
  timestamp: Date;
  value: number;
}

export function StatusPage() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');

  // Fetch service status
  const { data: services = [] } = useQuery<ServiceStatus[]>({
    queryKey: ['/api/status/services'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch incidents
  const { data: incidents = [] } = useQuery<Incident[]>({
    queryKey: ['/api/status/incidents']
  });

  // Fetch maintenance windows
  const { data: maintenance = [] } = useQuery<MaintenanceWindow[]>({
    queryKey: ['/api/status/maintenance']
  });

  // Fetch uptime metrics
  const { data: uptimeMetrics = [] } = useQuery<Metric[]>({
    queryKey: [`/api/status/uptime?range=${selectedTimeRange}`]
  });

  const getStatusIcon = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'partial':
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      case 'down':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'operational': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'partial': return 'text-orange-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getSeverityColor = (severity: Incident['severity']) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const overallStatus = services.every(s => s.status === 'operational') 
    ? 'operational' 
    : services.some(s => s.status === 'down') 
    ? 'down' 
    : 'degraded';

  const averageUptime = services.reduce((sum, s) => sum + s.uptime, 0) / services.length;

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card className={cn(
        "border-2",
        overallStatus === 'operational' && "border-green-600 bg-green-50 dark:bg-green-950",
        overallStatus === 'degraded' && "border-yellow-600 bg-yellow-50 dark:bg-yellow-950",
        overallStatus === 'down' && "border-red-600 bg-red-50 dark:bg-red-950"
      )}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {overallStatus === 'operational' && <CheckCircle className="h-8 w-8 text-green-600" />}
              {overallStatus === 'degraded' && <AlertTriangle className="h-8 w-8 text-yellow-600" />}
              {overallStatus === 'down' && <XCircle className="h-8 w-8 text-red-600" />}
              <div>
                <CardTitle className="text-2xl">
                  {overallStatus === 'operational' && 'All Systems Operational'}
                  {overallStatus === 'degraded' && 'Partial System Degradation'}
                  {overallStatus === 'down' && 'Major Service Disruption'}
                </CardTitle>
                <CardDescription>
                  Last updated: {new Date().toLocaleTimeString()}
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px]">Overall Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageUptime.toFixed(2)}%</div>
            <p className="text-[11px] text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px]">Active Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {incidents.filter(i => i.status !== 'resolved').length}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {incidents.filter(i => i.severity === 'critical').length} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px]">Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {services.filter(s => s.status === 'operational').length}/{services.length}
            </div>
            <p className="text-[11px] text-muted-foreground">Operational</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px]">Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(services.reduce((sum, s) => sum + s.responseTime, 0) / services.length)}ms
            </div>
            <p className="text-[11px] text-muted-foreground">Average</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          {['core', 'features', 'infrastructure'].map(category => {
            const categoryServices = services.filter(s => s.category === category);
            
            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="capitalize">{category} Services</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {categoryServices.map(service => (
                      <div key={service.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(service.status)}
                          <div>
                            <p className="font-medium">{service.name}</p>
                            {service.description && (
                              <p className="text-[13px] text-muted-foreground">
                                {service.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-[13px]">
                          <div className="text-right">
                            <p className="font-medium">{service.uptime}%</p>
                            <p className="text-[11px] text-muted-foreground">Uptime</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{service.responseTime}ms</p>
                            <p className="text-[11px] text-muted-foreground">Response</p>
                          </div>
                          <Badge variant="outline" className={getStatusColor(service.status)}>
                            {service.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          {incidents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-[15px] font-semibold">No Active Incidents</h3>
                <p className="text-[13px] text-muted-foreground">
                  All systems are operating normally
                </p>
              </CardContent>
            </Card>
          ) : (
            incidents.map(incident => (
              <Card key={incident.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-[15px] flex items-center gap-2">
                        {incident.title}
                        <Badge className={getSeverityColor(incident.severity)}>
                          {incident.severity}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Started {new Date(incident.startedAt).toLocaleString()}
                        {incident.resolvedAt && ` • Resolved ${new Date(incident.resolvedAt).toLocaleString()}`}
                      </CardDescription>
                    </div>
                    <Badge variant={incident.status === 'resolved' ? 'secondary' : 'default'}>
                      {incident.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-3">
                    <p className="text-[13px] text-muted-foreground mb-1">Affected Services:</p>
                    <div className="flex gap-2">
                      {incident.affectedServices.map(serviceId => {
                        const service = services.find(s => s.id === serviceId);
                        return (
                          <Badge key={serviceId} variant="outline">
                            {service?.name || serviceId}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[13px] font-medium">Updates:</p>
                    <ScrollArea className="h-40">
                      <div className="space-y-2">
                        {incident.updates
                          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                          .map(update => (
                            <div key={update.id} className="flex gap-3 text-[13px]">
                              <span className="text-muted-foreground whitespace-nowrap">
                                {new Date(update.timestamp).toLocaleTimeString()}
                              </span>
                              <div>
                                <Badge variant="outline" className="text-[11px] mb-1">
                                  {update.status}
                                </Badge>
                                <p>{update.message}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          {maintenance.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Calendar className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-[15px] font-semibold">No Scheduled Maintenance</h3>
                <p className="text-[13px] text-muted-foreground">
                  No maintenance windows are currently scheduled
                </p>
              </CardContent>
            </Card>
          ) : (
            maintenance.map(window => (
              <Card key={window.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-[15px]">{window.title}</CardTitle>
                      <CardDescription>{window.description}</CardDescription>
                    </div>
                    <Badge variant={window.status === 'scheduled' ? 'secondary' : 'default'}>
                      {window.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[13px]">
                    <div>
                      <p className="text-muted-foreground">Scheduled For</p>
                      <p className="font-medium">
                        {new Date(window.scheduledFor).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Duration</p>
                      <p className="font-medium">{window.duration} minutes</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Affected Services</p>
                      <div className="flex gap-1 mt-1">
                        {window.affectedServices.map(serviceId => (
                          <Badge key={serviceId} variant="outline" className="text-[11px]">
                            {services.find(s => s.id === serviceId)?.name || serviceId}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Uptime History</CardTitle>
                <select
                  value={selectedTimeRange}
                  onChange={(e) => setSelectedTimeRange(e.target.value)}
                  className="px-3 py-1 border rounded-md text-[13px]"
                >
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <Activity className="h-8 w-8" />
                <span className="ml-2">Uptime chart visualization</span>
              </div>
              
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[13px]">Average Uptime</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">99.95%</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[13px]">Total Incidents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">3</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[13px]">Total Downtime</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">45m</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}