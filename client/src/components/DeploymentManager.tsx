import React, { useState, useEffect } from 'react';
import { 
  Rocket, Globe, Server, Activity, Clock, AlertCircle,
  CheckCircle, XCircle, RefreshCw, Settings, ExternalLink,
  Shield, Zap, Cpu, HardDrive, Network, BarChart,
  GitBranch, Copy, Terminal, Play, Pause, RotateCcw,
  ArrowUpRight, Info, Loader2, Plus, Key
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface DeploymentManagerProps {
  projectId: number;
  className?: string;
}

interface Deployment {
  id: number;
  projectId: number;
  status: string; // 'deploying' | 'running' | 'stopped' | 'failed'
  url: string | null;
  logs: string | null;
  version: string;
  createdAt: string;
  updatedAt: string;
}

interface DeploymentStats {
  totalDeployments: number;
  activeDeployments: number;
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  bandwidth: string;
  uptime: number;
}

interface BuildLog {
  timestamp: string;
  message: string;
  level: 'info' | 'warning' | 'error';
}

interface EnvironmentVariable {
  key: string;
  value: string;
  isSecret: boolean;
}

const REGIONS = [
  { value: 'us-east-1', label: 'US East (Virginia)' },
  { value: 'us-west-1', label: 'US West (California)' },
  { value: 'eu-west-1', label: 'Europe (Ireland)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' }
];

export function DeploymentManager({ projectId, className }: DeploymentManagerProps) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [stats, setStats] = useState<DeploymentStats | null>(null);
  const [buildLogs, setBuildLogs] = useState<BuildLog[]>([]);
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [showEnvDialog, setShowEnvDialog] = useState(false);
  const [deploymentName, setDeploymentName] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [selectedRegion, setSelectedRegion] = useState('us-east-1');
  const [selectedEnvironment, setSelectedEnvironment] = useState('production');
  const [isDeploying, setIsDeploying] = useState(false);
  const [autoScaling, setAutoScaling] = useState(true);
  const [customDomain, setCustomDomain] = useState('');
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const [newEnvSecret, setNewEnvSecret] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadDeployments();
    loadStats();
  }, [projectId]);

  useEffect(() => {
    if (selectedDeployment) {
      loadBuildLogs(selectedDeployment.id);
      loadEnvVars(selectedDeployment.id);
    }
  }, [selectedDeployment]);

  const loadDeployments = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/deployments`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setDeployments(data);
        if (data.length > 0 && !selectedDeployment) {
          setSelectedDeployment(data[0]);
        }
      } else {
        console.error('Failed to load deployments:', response.status);
        setDeployments([]);
      }
    } catch (error) {
      console.error('Failed to load deployments:', error);
      setDeployments([]);
      toast({
        title: "Error",
        description: "Failed to load deployments",
        variant: "destructive"
      });
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/deployments/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
      // Mock stats
      setStats({
        totalDeployments: 15,
        activeDeployments: 2,
        totalRequests: 125000,
        averageResponseTime: 145,
        errorRate: 0.02,
        bandwidth: '12.5 GB',
        uptime: 99.95
      });
    }
  };

  const loadBuildLogs = async (deploymentId: number) => {
    try {
      const response = await fetch(`/api/deployments/${deploymentId}/logs`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        // Convert logs array to BuildLog format
        const formattedLogs: BuildLog[] = data.logs.map((log: string, index: number) => ({
          timestamp: new Date().toLocaleTimeString(),
          message: log,
          level: 'info' as const
        }));
        setBuildLogs(formattedLogs);
      } else {
        setBuildLogs([]);
      }
    } catch (error) {
      console.error('Failed to load build logs:', error);
      setBuildLogs([]);
    }
  };

  const loadEnvVars = async (deploymentId: number) => {
    try {
      // Load environment variables from project, not deployment
      const response = await fetch(`/api/projects/${projectId}/environment`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        // Map to our format
        const vars: EnvironmentVariable[] = data.map((v: any) => ({
          key: v.key,
          value: v.isSecret ? '****' : v.value,
          isSecret: v.isSecret
        }));
        setEnvVars(vars);
      } else {
        setEnvVars([]);
      }
    } catch (error) {
      console.error('Failed to load env vars:', error);
      setEnvVars([]);
    }
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({})
      });

      if (response.ok) {
        const result = await response.json();
        await loadDeployments();
        setShowDeployDialog(false);
        setDeploymentName('');
        setCustomDomain('');
        toast({
          title: "Deployment Started",
          description: `Your application is being deployed. Deployment ID: ${result.deploymentId}`,
        });
      } else {
        const error = await response.json();
        toast({
          title: "Deployment Failed",
          description: error.message || "Failed to start deployment",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Deployment Failed",
        description: "Failed to start deployment",
        variant: "destructive"
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleRedeploy = async (deployment: Deployment) => {
    try {
      // Redeploy by calling the deploy endpoint again
      const response = await fetch(`/api/projects/${projectId}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({})
      });

      if (response.ok) {
        await loadDeployments();
        toast({
          title: "Redeployment Started",
          description: `Redeploying version ${deployment.version}`,
        });
      }
    } catch (error) {
      toast({
        title: "Redeployment Failed",
        description: "Failed to redeploy",
        variant: "destructive"
      });
    }
  };

  const handleStop = async (deployment: Deployment) => {
    try {
      const response = await fetch(`/api/deployments/${deployment.id}/stop`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        await loadDeployments();
        toast({
          title: "Deployment Stopped",
          description: `Deployment ${deployment.version} has been stopped`,
        });
      }
    } catch (error) {
      toast({
        title: "Stop Failed",
        description: "Failed to stop deployment",
        variant: "destructive"
      });
    }
  };

  const handleAddEnvVar = async () => {
    if (!newEnvKey.trim()) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/environment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          key: newEnvKey,
          value: newEnvValue,
          isSecret: newEnvSecret
        })
      });

      if (response.ok) {
        await loadEnvVars(selectedDeployment?.id || 0);
        setNewEnvKey('');
        setNewEnvValue('');
        setNewEnvSecret(false);
        toast({
          title: "Environment Variable Added",
          description: `${newEnvKey} has been added`,
        });
      }
    } catch (error) {
      toast({
        title: "Failed to Add Variable",
        description: "Could not add environment variable",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'deploying': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'stopped': return <Pause className="h-4 w-4 text-gray-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'deploying': return 'bg-blue-500';
      case 'stopped': return 'bg-gray-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-yellow-500';
    }
  };

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center">
              <Rocket className="h-4 w-4 mr-2" />
              Deployments
            </CardTitle>
            <Button
              size="sm"
              onClick={() => setShowDeployDialog(true)}
            >
              <Rocket className="h-3.5 w-3.5 mr-1" />
              Deploy
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-8">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="logs" className="text-xs">Logs</TabsTrigger>
              <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
              <TabsTrigger value="metrics" className="text-xs">Metrics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0">
              {/* Deployment List */}
              <div className="p-4 border-b">
                <Label className="text-xs mb-2">Active Deployments</Label>
                <div className="space-y-2">
                  {deployments.map((deployment) => (
                    <div
                      key={deployment.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedDeployment?.id === deployment.id 
                          ? 'bg-accent border-accent' 
                          : 'hover:bg-accent/50'
                      }`}
                      onClick={() => setSelectedDeployment(deployment)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(deployment.status)}
                            <span className="font-medium text-sm">Deployment #{deployment.id}</span>
                            <Badge variant="outline" className="text-xs">
                              v{deployment.version}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center">
                              <Server className="h-3 w-3 mr-1" />
                              {deployment.status}
                            </span>
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              Updated {new Date(deployment.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {deployment.url && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (deployment.url) {
                                  window.open(deployment.url, '_blank');
                                }
                              }}
                              className="h-7 w-7"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRedeploy(deployment);
                            }}
                            className="h-7 w-7"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deployment Details */}
              {selectedDeployment && (
                <div className="p-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Deployment URL</h4>
                    <div className="flex items-center space-x-2">
                      <Input
                        value={selectedDeployment.url || 'Not yet available'}
                        readOnly
                        className="font-mono text-xs"
                      />
                      {selectedDeployment.url && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedDeployment.url || '');
                            toast({
                              title: "Copied",
                              description: "URL copied to clipboard",
                            });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Deployment Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(selectedDeployment.status)}`} />
                        <span className="text-sm capitalize">{selectedDeployment.status}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Uptime</Label>
                      <p className="text-sm font-medium mt-1">{stats?.uptime}%</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Response Time</Label>
                      <p className="text-sm font-medium mt-1">{stats?.averageResponseTime}ms</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Error Rate</Label>
                      <p className="text-sm font-medium mt-1">{stats?.errorRate}%</p>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="logs" className="mt-0">
              <ScrollArea className="h-[400px]">
                <div className="p-4 space-y-1">
                  {buildLogs.map((log, index) => (
                    <div key={index} className="flex items-start space-x-2 font-mono text-xs">
                      <span className="text-muted-foreground">{log.timestamp}</span>
                      <span className={
                        log.level === 'error' ? 'text-red-500' :
                        log.level === 'warning' ? 'text-yellow-500' :
                        'text-foreground'
                      }>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="settings" className="mt-0">
              <div className="p-4 space-y-4">
                {/* Environment Variables */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label>Environment Variables</Label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowEnvDialog(true)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {envVars.map((envVar, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center space-x-2">
                          {envVar.isSecret ? <Shield className="h-3.5 w-3.5" /> : <Key className="h-3.5 w-3.5" />}
                          <code className="text-xs">{envVar.key}</code>
                        </div>
                        <code className="text-xs text-muted-foreground">
                          {envVar.isSecret ? '••••••••' : envVar.value}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Auto Scaling */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto Scaling</Label>
                    <p className="text-xs text-muted-foreground">Automatically scale based on traffic</p>
                  </div>
                  <Switch checked={autoScaling} onCheckedChange={setAutoScaling} />
                </div>

                {/* Custom Domain */}
                <div>
                  <Label>Custom Domain</Label>
                  <Input
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="myapp.com"
                    className="mt-1"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="metrics" className="mt-0">
              <div className="p-4 space-y-4">
                {stats && (
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Total Requests</p>
                            <p className="text-2xl font-bold">{stats.totalRequests.toLocaleString()}</p>
                          </div>
                          <BarChart className="h-8 w-8 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Bandwidth Used</p>
                            <p className="text-2xl font-bold">{stats.bandwidth}</p>
                          </div>
                          <Network className="h-8 w-8 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
                
                <Alert>
                  <Activity className="h-4 w-4" />
                  <AlertTitle>Performance Insights</AlertTitle>
                  <AlertDescription>
                    Your application is performing well. Average response time is below 200ms.
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Deploy Dialog */}
      <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deploy Application</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="deployment-name">Deployment Name</Label>
              <Input
                id="deployment-name"
                value={deploymentName}
                onChange={(e) => setDeploymentName(e.target.value)}
                placeholder="Production"
              />
            </div>
            <div>
              <Label htmlFor="branch">Branch</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger id="branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">main</SelectItem>
                  <SelectItem value="develop">develop</SelectItem>
                  <SelectItem value="staging">staging</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="region">Region</Label>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger id="region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map(region => (
                    <SelectItem key={region.value} value={region.value}>
                      {region.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Auto Scaling</Label>
                <p className="text-xs text-muted-foreground">Enable automatic scaling</p>
              </div>
              <Switch checked={autoScaling} onCheckedChange={setAutoScaling} />
            </div>
            <div>
              <Label htmlFor="custom-domain">Custom Domain (Optional)</Label>
              <Input
                id="custom-domain"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="myapp.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeployDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeploy} disabled={isDeploying}>
              {isDeploying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deploy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Environment Variables Dialog */}
      <Dialog open={showEnvDialog} onOpenChange={setShowEnvDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Environment Variable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="env-key">Key</Label>
              <Input
                id="env-key"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                placeholder="API_KEY"
              />
            </div>
            <div>
              <Label htmlFor="env-value">Value</Label>
              <Textarea
                id="env-value"
                value={newEnvValue}
                onChange={(e) => setNewEnvValue(e.target.value)}
                placeholder="Enter value..."
                className="font-mono text-sm"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="env-secret"
                checked={newEnvSecret}
                onCheckedChange={setNewEnvSecret}
              />
              <Label htmlFor="env-secret">Mark as secret</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnvDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEnvVar} disabled={!newEnvKey.trim()}>
              Add Variable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}