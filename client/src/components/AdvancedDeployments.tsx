import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Globe, 
  Shield, 
  Zap, 
  Clock, 
  Server,
  Activity,
  AlertCircle,
  CheckCircle,
  Settings,
  TrendingUp,
  Calendar,
  DollarSign,
  Database,
  Lock
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

interface AdvancedDeployment {
  id: number;
  projectId: number;
  environment: 'production' | 'staging' | 'preview';
  region: 'us-east' | 'us-west' | 'eu-west' | 'ap-southeast';
  customDomain?: string;
  sslCertificate?: {
    status: 'active' | 'pending' | 'expired';
    expiresAt: Date;
  };
  envVariables: Record<string, string>;
  buildConfig: {
    command: string;
    outputDirectory: string;
    nodeVersion?: string;
  };
  scaling: {
    min: number;
    max: number;
    cpuThreshold: number;
    memoryThreshold: number;
  };
  healthCheck?: {
    path: string;
    interval: number;
    timeout: number;
  };
  logs: DeploymentLog[];
  metrics: DeploymentMetrics;
  status: 'active' | 'building' | 'failed' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

interface DeploymentLog {
  id: number;
  deploymentId: number;
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: Date;
}

interface DeploymentMetrics {
  requests: number;
  errors: number;
  avgResponseTime: number;
  uptime: number;
  bandwidth: number;
  cost: number;
}

interface CronJob {
  id: number;
  deploymentId: number;
  name: string;
  schedule: string;
  command: string;
  lastRun?: Date;
  nextRun: Date;
  status: 'active' | 'paused' | 'failed';
}

interface AdvancedDeploymentsProps {
  projectId: number;
}

export function AdvancedDeployments({ projectId }: AdvancedDeploymentsProps) {
  const queryClient = useQueryClient();
  const [selectedDeployment, setSelectedDeployment] = useState<AdvancedDeployment | null>(null);
  const [showNewDeployment, setShowNewDeployment] = useState(false);
  const [deploymentConfig, setDeploymentConfig] = useState({
    environment: 'production',
    region: 'us-east',
    customDomain: '',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    scaleMin: 1,
    scaleMax: 10,
    cpuThreshold: 80,
    memoryThreshold: 80
  });

  // Fetch deployments
  const { data: deployments = [] } = useQuery<AdvancedDeployment[]>({
    queryKey: ['/api/deployment', projectId, 'advanced'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/deployment/${projectId}/advanced`);
      return res.json();
    }
  });

  // Fetch cron jobs
  const { data: cronJobs = [] } = useQuery<CronJob[]>({
    queryKey: ['/api/deployment', projectId, 'cron-jobs'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/deployment/${projectId}/cron-jobs`);
      return res.json();
    },
    enabled: deployments.length > 0
  });

  // Create deployment
  const createDeploymentMutation = useMutation({
    mutationFn: async (data: typeof deploymentConfig) => {
      const res = await apiRequest('POST', `/api/deployment/${projectId}/advanced`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/deployment', projectId, 'advanced'] 
      });
      setShowNewDeployment(false);
      toast({
        title: "Deployment created",
        description: "Your deployment is being set up"
      });
    }
  });

  // Update deployment
  const updateDeploymentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PATCH', `/api/deployment/${projectId}/advanced/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/deployment', projectId, 'advanced'] 
      });
      toast({
        title: "Deployment updated",
        description: "Your changes have been applied"
      });
    }
  });

  // Create cron job
  const createCronJobMutation = useMutation({
    mutationFn: async (data: { deploymentId: number; name: string; schedule: string; command: string }) => {
      const res = await apiRequest('POST', `/api/deployment/${projectId}/cron-jobs`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deployment', projectId, 'cron-jobs'] });
      toast({
        title: "Cron job created",
        description: "Your scheduled task has been set up"
      });
    }
  });

  const getStatusColor = (status: AdvancedDeployment['status']) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'building': return 'text-blue-600';
      case 'failed': return 'text-red-600';
      case 'suspended': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: AdvancedDeployment['status']) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'building': return <Activity className="h-4 w-4 animate-pulse" />;
      case 'failed': return <AlertCircle className="h-4 w-4" />;
      case 'suspended': return <Clock className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Advanced Deployments</h2>
          <p className="text-muted-foreground">
            Manage production deployments with custom domains, scaling, and monitoring
          </p>
        </div>
        <Button onClick={() => setShowNewDeployment(true)}>
          New Deployment
        </Button>
      </div>

      {/* Deployment List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {deployments.map(deployment => (
          <Card 
            key={deployment.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setSelectedDeployment(deployment)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-[15px] flex items-center gap-2">
                    <span className={getStatusColor(deployment.status)}>
                      {getStatusIcon(deployment.status)}
                    </span>
                    {deployment.environment}
                  </CardTitle>
                  <CardDescription>
                    {deployment.customDomain || `${projectId}.e-code.ai`}
                  </CardDescription>
                </div>
                <Badge variant="outline">{deployment.region}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-[13px]">
                  <div>
                    <p className="text-muted-foreground">Requests</p>
                    <p className="font-medium">{deployment.metrics.requests.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Uptime</p>
                    <p className="font-medium">{deployment.metrics.uptime.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Response</p>
                    <p className="font-medium">{deployment.metrics.avgResponseTime}ms</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cost</p>
                    <p className="font-medium">${deployment.metrics.cost.toFixed(2)}</p>
                  </div>
                </div>

                {deployment.sslCertificate && (
                  <div className="flex items-center gap-2 text-[13px]">
                    <Lock className="h-3 w-3 text-green-600" />
                    <span>SSL Active</span>
                    {deployment.sslCertificate.status === 'pending' && (
                      <Badge variant="secondary" className="text-[11px]">Pending</Badge>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New Deployment Dialog */}
      {showNewDeployment && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Create New Deployment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select
                  value={deploymentConfig.environment}
                  onValueChange={(value: any) => 
                    setDeploymentConfig({ ...deploymentConfig, environment: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="preview">Preview</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Region</Label>
                <Select
                  value={deploymentConfig.region}
                  onValueChange={(value: any) => 
                    setDeploymentConfig({ ...deploymentConfig, region: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us-east">US East</SelectItem>
                    <SelectItem value="us-west">US West</SelectItem>
                    <SelectItem value="eu-west">EU West</SelectItem>
                    <SelectItem value="ap-southeast">Asia Pacific</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Custom Domain (optional)</Label>
              <Input
                placeholder="example.com"
                value={deploymentConfig.customDomain}
                onChange={(e) => 
                  setDeploymentConfig({ ...deploymentConfig, customDomain: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Build Command</Label>
                <Input
                  value={deploymentConfig.buildCommand}
                  onChange={(e) => 
                    setDeploymentConfig({ ...deploymentConfig, buildCommand: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Output Directory</Label>
                <Input
                  value={deploymentConfig.outputDirectory}
                  onChange={(e) => 
                    setDeploymentConfig({ ...deploymentConfig, outputDirectory: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Auto-Scaling</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[13px]">Min Instances</Label>
                  <Input
                    type="number"
                    value={deploymentConfig.scaleMin}
                    onChange={(e) => 
                      setDeploymentConfig({ 
                        ...deploymentConfig, 
                        scaleMin: parseInt(e.target.value) 
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px]">Max Instances</Label>
                  <Input
                    type="number"
                    value={deploymentConfig.scaleMax}
                    onChange={(e) => 
                      setDeploymentConfig({ 
                        ...deploymentConfig, 
                        scaleMax: parseInt(e.target.value) 
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={() => createDeploymentMutation.mutate(deploymentConfig)}
                disabled={createDeploymentMutation.isPending}
              >
                {createDeploymentMutation.isPending ? 'Creating...' : 'Create Deployment'}
              </Button>
              <Button variant="outline" onClick={() => setShowNewDeployment(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Deployment Details */}
      {selectedDeployment && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Deployment Details</CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedDeployment(null)}
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
                <TabsTrigger value="metrics">Metrics</TabsTrigger>
                <TabsTrigger value="cron">Cron Jobs</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <span className={getStatusColor(selectedDeployment.status)}>
                          {getStatusIcon(selectedDeployment.status)}
                        </span>
                        <span className="font-medium capitalize">
                          {selectedDeployment.status}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Domain</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        <p className="font-medium">
                          {selectedDeployment.customDomain || 'Default Domain'}
                        </p>
                        {selectedDeployment.sslCertificate && (
                          <p className="text-[13px] text-muted-foreground flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            SSL {selectedDeployment.sslCertificate.status}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Region</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span className="font-medium uppercase">
                          {selectedDeployment.region}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Scaling</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">
                        {selectedDeployment.scaling.min} - {selectedDeployment.scaling.max} instances
                      </p>
                      <p className="text-[13px] text-muted-foreground">
                        CPU: {selectedDeployment.scaling.cpuThreshold}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-[13px] text-muted-foreground">Total Requests</p>
                    <p className="text-2xl font-bold">
                      {selectedDeployment.metrics.requests.toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[13px] text-muted-foreground">Error Rate</p>
                    <p className="text-2xl font-bold">
                      {((selectedDeployment.metrics.errors / selectedDeployment.metrics.requests) * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[13px] text-muted-foreground">Response Time</p>
                    <p className="text-2xl font-bold">
                      {selectedDeployment.metrics.avgResponseTime}ms
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[13px] text-muted-foreground">Monthly Cost</p>
                    <p className="text-2xl font-bold">
                      ${selectedDeployment.metrics.cost.toFixed(2)}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Environment Variables</Label>
                    <div className="space-y-2">
                      {Object.entries(selectedDeployment.envVariables).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <Input value={key} disabled className="font-mono" />
                          <Input value={value} type="password" disabled className="font-mono" />
                        </div>
                      ))}
                      <Button variant="outline" size="sm">
                        Add Variable
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Build Configuration</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[13px]">Build Command</Label>
                        <Input 
                          value={selectedDeployment.buildConfig.command} 
                          disabled 
                        />
                      </div>
                      <div>
                        <Label className="text-[13px]">Output Directory</Label>
                        <Input 
                          value={selectedDeployment.buildConfig.outputDirectory} 
                          disabled 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Health Check</Label>
                    <div className="flex items-center space-x-2">
                      <Switch 
                        checked={!!selectedDeployment.healthCheck}
                        onCheckedChange={() => {}}
                      />
                      <Label>Enable health checks</Label>
                    </div>
                    {selectedDeployment.healthCheck && (
                      <div className="grid grid-cols-3 gap-4 mt-2">
                        <div>
                          <Label className="text-[13px]">Path</Label>
                          <Input 
                            value={selectedDeployment.healthCheck.path} 
                            disabled 
                          />
                        </div>
                        <div>
                          <Label className="text-[13px]">Interval (s)</Label>
                          <Input 
                            type="number"
                            value={selectedDeployment.healthCheck.interval} 
                            disabled 
                          />
                        </div>
                        <div>
                          <Label className="text-[13px]">Timeout (s)</Label>
                          <Input 
                            type="number"
                            value={selectedDeployment.healthCheck.timeout} 
                            disabled 
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <Button>Save Changes</Button>
                </div>
              </TabsContent>

              <TabsContent value="logs" className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Select defaultValue="all">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Logs</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm">
                    <Activity className="h-3 w-3 mr-1" />
                    Live
                  </Button>
                </div>

                <ScrollArea className="h-96 w-full rounded-md border p-4">
                  <div className="space-y-2 font-mono text-[13px]">
                    {selectedDeployment.logs.map(log => (
                      <div 
                        key={log.id}
                        className={`flex items-start gap-2 ${
                          log.level === 'error' ? 'text-red-600' :
                          log.level === 'warning' ? 'text-yellow-600' :
                          'text-muted-foreground'
                        }`}
                      >
                        <span className="text-[11px] opacity-60">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="uppercase text-[11px] font-bold">
                          [{log.level}]
                        </span>
                        <span className="flex-1">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="metrics" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Request Volume</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-32 flex items-center justify-center text-muted-foreground">
                        <TrendingUp className="h-8 w-8" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Response Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-32 flex items-center justify-center text-muted-foreground">
                        <Activity className="h-8 w-8" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Error Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-32 flex items-center justify-center text-muted-foreground">
                        <AlertCircle className="h-8 w-8" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Bandwidth Usage</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[13px]">
                          <span>Used</span>
                          <span>{(selectedDeployment.metrics.bandwidth / 1024).toFixed(2)} GB</span>
                        </div>
                        <Progress value={75} />
                        <p className="text-[11px] text-muted-foreground">
                          75% of 100 GB limit
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="cron" className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[15px] font-semibold">Scheduled Jobs</h3>
                  <Button size="sm">Add Cron Job</Button>
                </div>

                <div className="space-y-3">
                  {cronJobs
                    .filter(job => job.deploymentId === selectedDeployment.id)
                    .map(job => (
                      <Card key={job.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{job.name}</h4>
                              <p className="text-[13px] text-muted-foreground font-mono">
                                {job.schedule}
                              </p>
                              <p className="text-[13px] text-muted-foreground mt-1">
                                {job.command}
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge variant={job.status === 'active' ? 'default' : 'secondary'}>
                                {job.status}
                              </Badge>
                              {job.lastRun && (
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  Last: {new Date(job.lastRun).toLocaleString()}
                                </p>
                              )}
                              <p className="text-[11px] text-muted-foreground">
                                Next: {new Date(job.nextRun).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}