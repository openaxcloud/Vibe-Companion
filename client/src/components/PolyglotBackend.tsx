// @ts-nocheck
/**
 * Polyglot Backend Interface Component
 * Displays and manages the multi-language backend services
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Activity, 
  Code, 
  Brain,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Gauge,
  Server,
  BarChart3,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ServiceHealth {
  service: string;
  status: 'healthy' | 'unhealthy';
  lastCheck: Date;
  responseTime?: number;
}

interface ServiceCapabilities {
  services: {
    typescript: ServiceInfo;
    'python-ml': ServiceInfo;
  };
  routing: Record<string, string>;
}

interface ServiceInfo {
  port: number;
  capabilities: string[];
  endpoints: string[];
}

interface BenchmarkResult {
  service: string;
  responseTime: number;
  status: string;
  error?: string;
}

export function PolyglotBackend() {
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['polyglot-health'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/polyglot/health');
      if (!res.ok) throw new Error('Failed to fetch health status');
      return res.json();
    },
    refetchInterval: 30000
  });

  const { data: capabilitiesData } = useQuery({
    queryKey: ['polyglot-capabilities'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/polyglot/capabilities');
      if (!res.ok) throw new Error('Failed to fetch capabilities');
      return res.json() as ServiceCapabilities;
    }
  });

  const benchmarkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('GET', '/api/polyglot/benchmark');
      if (!res.ok) throw new Error('Benchmark failed');
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Benchmark Complete",
        description: `Fastest service: ${data.fastest.service} (${data.fastest.responseTime}ms)`,
      });
    }
  });

  const getServiceIcon = (serviceName: string) => {
    switch (serviceName) {
      case 'typescript': return <Code className="h-5 w-5" />;
      case 'python-ml': return <Brain className="h-5 w-5" />;
      default: return <Server className="h-5 w-5" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'unhealthy': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6" data-testid="page-polyglot">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-polyglot-title">Polyglot Backend Architecture</h1>
          <p className="text-muted-foreground" data-testid="text-polyglot-subtitle">Multi-language backend services (TypeScript, Python)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => benchmarkMutation.mutate()}
            disabled={benchmarkMutation.isPending}
            variant="outline"
            size="sm"
            data-testid="button-run-benchmark"
          >
            <Gauge className="h-4 w-4 mr-2" />
            {benchmarkMutation.isPending ? 'Benchmarking...' : 'Run Benchmark'}
          </Button>
        </div>
      </div>

      {healthData && (
        <Alert>
          <div className="flex items-center gap-2">
            {getStatusIcon(healthData.status)}
            <AlertTitle>System Status: {healthData.status.toUpperCase()}</AlertTitle>
          </div>
          <AlertDescription>
            {healthData.services.filter((s: ServiceHealth) => s.status === 'healthy').length} of{' '}
            {healthData.services.length} services are healthy
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="overview" data-testid="tab-polyglot-overview">Overview</TabsTrigger>
          <TabsTrigger value="services" data-testid="tab-polyglot-services">Services</TabsTrigger>
          <TabsTrigger value="capabilities" data-testid="tab-polyglot-capabilities">Capabilities</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-polyglot-performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {healthData?.services.map((service: ServiceHealth, index: number) => (
              <Card key={service.service} data-testid={`card-service-${service.service}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-[13px] font-medium flex items-center gap-2" data-testid={`text-service-name-${index}`}>
                    {getServiceIcon(service.service)}
                    {service.service.replace('-', ' ').toUpperCase()}
                  </CardTitle>
                  {getStatusIcon(service.status)}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold capitalize" data-testid={`text-service-status-${index}`}>{service.status}</div>
                  {service.responseTime && (
                    <p className="text-[11px] text-muted-foreground" data-testid={`text-service-response-time-${index}`}>
                      Response time: {service.responseTime}ms
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground" data-testid={`text-service-last-check-${index}`}>
                    Last check: {new Date(service.lastCheck).toLocaleTimeString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Architecture Benefits</CardTitle>
              <CardDescription>Why we use a polyglot backend approach</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Code className="h-5 w-5 text-blue-600 mt-1" />
                  <div>
                    <h4 className="font-semibold">TypeScript</h4>
                    <p className="text-[13px] text-muted-foreground">
                      Web APIs, user management, database operations, container orchestration, file operations, builds
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Brain className="h-5 w-5 text-purple-600 mt-1" />
                  <div>
                    <h4 className="font-semibold">Python</h4>
                    <p className="text-[13px] text-muted-foreground">
                      AI/ML processing, data analysis, code analysis
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          {capabilitiesData && Object.entries(capabilitiesData.services).map(([serviceName, serviceInfo]) => (
            <Card key={serviceName}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {getServiceIcon(serviceName)}
                    {serviceName.replace('-', ' ').toUpperCase()}
                  </CardTitle>
                  <Badge variant="outline">Port {serviceInfo.port}</Badge>
                </div>
                <CardDescription>
                  {serviceInfo.capabilities.length} capabilities, {serviceInfo.endpoints.length} endpoints
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-[13px] font-semibold mb-2">Capabilities</h4>
                    <div className="space-y-1">
                      {serviceInfo.capabilities.map((capability, index) => (
                        <div key={index} className="text-[13px] text-muted-foreground flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          {capability}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[13px] font-semibold mb-2">API Endpoints</h4>
                    <div className="flex flex-wrap gap-2">
                      {serviceInfo.endpoints.map((endpoint, index) => (
                        <Badge key={index} variant="secondary" className="text-[11px]">
                          {endpoint}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="capabilities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Routing Matrix</CardTitle>
              <CardDescription>How requests are automatically routed to optimal services</CardDescription>
            </CardHeader>
            <CardContent>
              {capabilitiesData && (
                <div className="space-y-3">
                  {Object.entries(capabilitiesData.routing).map(([capability, service]) => (
                    <div key={capability} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{capability.replace('-', ' ')}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {getServiceIcon(service)}
                        <span className="text-[13px] font-medium">{service}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Benchmarks</CardTitle>
              <CardDescription>Service response times and performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {benchmarkMutation.data ? (
                <div className="space-y-4">
                  {benchmarkMutation.data.benchmarks.map((benchmark: BenchmarkResult) => (
                    <div key={benchmark.service} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getServiceIcon(benchmark.service)}
                        <div>
                          <div className="font-medium">{benchmark.service}</div>
                          <div className="text-[13px] text-muted-foreground">
                            Status: {benchmark.status}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {benchmark.responseTime > 0 ? (
                          <>
                            <div className="font-semibold">{benchmark.responseTime}ms</div>
                            <Progress 
                              value={Math.max(0, 100 - benchmark.responseTime / 10)} 
                              className="w-20 h-2" 
                            />
                          </>
                        ) : (
                          <Badge variant="destructive">Unavailable</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <div className="text-[13px]">
                      <strong>Fastest Service:</strong> {benchmarkMutation.data.fastest.service} 
                      ({benchmarkMutation.data.fastest.responseTime}ms)
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Run a benchmark to see performance metrics</p>
                  <Button
                    onClick={() => benchmarkMutation.mutate()}
                    disabled={benchmarkMutation.isPending}
                    className="mt-4"
                  >
                    {benchmarkMutation.isPending ? 'Running...' : 'Start Benchmark'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
