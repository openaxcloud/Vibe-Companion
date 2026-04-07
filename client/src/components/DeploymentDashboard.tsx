import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Globe, Server, Activity, Clock, Lock, RefreshCw, 
  ExternalLink, Settings, AlertCircle, CheckCircle,
  TrendingUp, Users, Zap, HardDrive, Cpu, MemoryStick,
  MapPin, Shield, Calendar, Play, Square, Monitor
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { DeploymentTypes } from './DeploymentTypes';

interface DeploymentDashboardProps {
  projectId: number;
}

interface DeploymentStatus {
  id: string;
  status: 'pending' | 'building' | 'deploying' | 'active' | 'failed' | 'stopped';
  url?: string;
  customUrl?: string;
  sslCertificate?: {
    issued: Date;
    expires: Date;
    provider: 'letsencrypt' | 'custom';
    status: 'valid' | 'pending' | 'expired';
  };
  buildLog: string[];
  deploymentLog: string[];
  metrics?: {
    requests: number;
    errors: number;
    responseTime: number;
    uptime: number;
  };
  createdAt: Date;
  lastDeployedAt?: Date;
  type: 'static' | 'autoscale' | 'reserved-vm' | 'scheduled' | 'serverless';
  regions: string[];
  environment: 'development' | 'staging' | 'production';
}

export function DeploymentDashboard({ projectId }: DeploymentDashboardProps) {
  const { toast } = useToast();
  const [deployments, setDeployments] = useState<DeploymentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDeployment, setShowCreateDeployment] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentStatus | null>(null);

  useEffect(() => {
    fetchDeployments();
  }, [projectId]);

  const fetchDeployments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/deployment/${projectId}/enterprise`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setDeployments(data.deployments || []);
      }
    } catch (error) {
      console.error('Error fetching deployments:', error);
      toast({
        title: "Error",
        description: "Failed to fetch deployments",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeployment = async (config: any) => {
    try {
      const response = await apiRequest('POST', `/api/deployment/${projectId}/enterprise`, config);

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Deployment Started",
          description: "Your application is being deployed..."
        });
        
        setShowCreateDeployment(false);
        fetchDeployments();
      } else {
        const error = await response.json();
        toast({
          title: "Deployment Failed",
          description: error.message || "Failed to start deployment",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Deployment error:', error);
      toast({
        title: "Error",
        description: "Failed to create deployment",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50 border-green-200';
      case 'building': case 'deploying': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'failed': return 'text-red-600 bg-red-50 border-red-200';
      case 'stopped': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'building': case 'deploying': return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'failed': return <AlertCircle className="h-4 w-4" />;
      case 'stopped': return <Square className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'static': return <Globe className="h-4 w-4" />;
      case 'autoscale': return <Zap className="h-4 w-4" />;
      case 'reserved-vm': return <Server className="h-4 w-4" />;
      case 'serverless': return <Activity className="h-4 w-4" />;
      case 'scheduled': return <Calendar className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  if (showCreateDeployment) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Create New Deployment</h2>
            <p className="text-muted-foreground">Configure and deploy your application</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowCreateDeployment(false)}
          >
            Back to Dashboard
          </Button>
        </div>
        
        <DeploymentTypes 
          projectId={projectId} 
          onDeploy={handleCreateDeployment}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Deployment Dashboard</h2>
          <p className="text-muted-foreground">
            Manage your application deployments with enterprise-grade infrastructure
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDeployments}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateDeployment(true)}>
            <Play className="h-4 w-4 mr-2" />
            New Deployment
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-[13px] text-muted-foreground">Active Deployments</p>
                <p className="text-2xl font-bold">
                  {deployments.filter(d => d.status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-[13px] text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">
                  {deployments.reduce((acc, d) => acc + (d.metrics?.requests || 0), 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-[13px] text-muted-foreground">Avg Response Time</p>
                <p className="text-2xl font-bold">
                  {Math.round(deployments.reduce((acc, d, _, arr) => 
                    acc + (d.metrics?.responseTime || 0) / arr.length, 0
                  ))}ms
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-[13px] text-muted-foreground">Uptime</p>
                <p className="text-2xl font-bold">
                  {deployments.length > 0 
                    ? (deployments.reduce((acc, d) => acc + (d.metrics?.uptime || 0), 0) / deployments.length).toFixed(1)
                    : '0'
                  }%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deployments List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Deployments</CardTitle>
          <CardDescription>
            Manage all your application deployments in one place
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading deployments...
            </div>
          ) : deployments.length === 0 ? (
            <div className="text-center py-8">
              <Monitor className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-[15px] font-semibold mb-2">No deployments yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first deployment to get started
              </p>
              <Button onClick={() => setShowCreateDeployment(true)}>
                <Play className="h-4 w-4 mr-2" />
                Create Deployment
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {deployments.map((deployment) => (
                <Card key={deployment.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-muted rounded-lg">
                          {getTypeIcon(deployment.type)}
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">
                              {deployment.type.charAt(0).toUpperCase() + deployment.type.slice(1).replace('-', ' ')} Deployment
                            </h3>
                            <Badge className={`${getStatusColor(deployment.status)} border`}>
                              {getStatusIcon(deployment.status)}
                              <span className="ml-1 capitalize">{deployment.status}</span>
                            </Badge>
                            <Badge variant="outline">
                              {deployment.environment}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {deployment.regions.length} region{deployment.regions.length !== 1 ? 's' : ''}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(deployment.createdAt).toLocaleDateString()}
                            </div>
                            {deployment.sslCertificate && (
                              <div className="flex items-center gap-1">
                                <Lock className="h-3 w-3 text-green-600" />
                                SSL Enabled
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {(deployment.url || deployment.customUrl) && deployment.status === 'active' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(deployment.customUrl || deployment.url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Visit
                          </Button>
                        )}
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedDeployment(deployment)}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Manage
                        </Button>
                      </div>
                    </div>

                    {/* Metrics */}
                    {deployment.metrics && deployment.status === 'active' && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-[11px] text-muted-foreground">Requests</p>
                            <p className="text-[15px] font-semibold">{deployment.metrics.requests.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">Errors</p>
                            <p className="text-[15px] font-semibold text-red-600">{deployment.metrics.errors}</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">Response Time</p>
                            <p className="text-[15px] font-semibold">{deployment.metrics.responseTime}ms</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">Uptime</p>
                            <p className="text-[15px] font-semibold text-green-600">{deployment.metrics.uptime.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Progress for building deployments */}
                    {(deployment.status === 'building' || deployment.status === 'deploying') && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center gap-2 mb-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span className="text-[13px]">
                            {deployment.status === 'building' ? 'Building application...' : 'Deploying to regions...'}
                          </span>
                        </div>
                        <Progress value={deployment.status === 'building' ? 45 : 85} className="h-2" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deployment Details Modal/Sidebar */}
      {selectedDeployment && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Deployment Details</CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedDeployment(null)}
              >
                ×
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
                <TabsTrigger value="domains">Domains</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[13px] text-muted-foreground">Deployment ID</p>
                    <p className="font-mono text-[13px]">{selectedDeployment.id}</p>
                  </div>
                  <div>
                    <p className="text-[13px] text-muted-foreground">Type</p>
                    <p className="capitalize">{selectedDeployment.type.replace('-', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-[13px] text-muted-foreground">Environment</p>
                    <p className="capitalize">{selectedDeployment.environment}</p>
                  </div>
                  <div>
                    <p className="text-[13px] text-muted-foreground">Regions</p>
                    <p>{selectedDeployment.regions.join(', ')}</p>
                  </div>
                </div>

                {selectedDeployment.sslCertificate && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Lock className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-800">SSL Certificate Active</span>
                    </div>
                    <div className="text-[13px] text-green-700">
                      <p>Provider: {selectedDeployment.sslCertificate.provider}</p>
                      <p>Expires: {new Date(selectedDeployment.sslCertificate.expires).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="logs" className="space-y-4">
                <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-[13px] max-h-96 overflow-y-auto">
                  {selectedDeployment.buildLog.map((log, index) => (
                    <div key={index}>{log}</div>
                  ))}
                  {selectedDeployment.deploymentLog.map((log, index) => (
                    <div key={index}>{log}</div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="domains" className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Default Domain</h4>
                  <p className="text-[13px] text-muted-foreground">{selectedDeployment.url}</p>
                </div>
                
                {selectedDeployment.customUrl && (
                  <div>
                    <h4 className="font-medium mb-2">Custom Domain</h4>
                    <p className="text-[13px] text-muted-foreground">{selectedDeployment.customUrl}</p>
                  </div>
                )}
                
                <Button variant="outline" size="sm">
                  Add Custom Domain
                </Button>
              </TabsContent>
              
              <TabsContent value="settings" className="space-y-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Update Configuration
                  </Button>
                  <Button variant="outline" size="sm">
                    Redeploy
                  </Button>
                  <Button variant="destructive" size="sm">
                    Delete Deployment
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}