import React, { useState, useEffect } from 'react';
import { 
  Rocket, Globe, Server, Activity, Clock, AlertCircle,
  CheckCircle, XCircle, RefreshCw, Settings, ExternalLink,
  Shield, Zap, Cpu, HardDrive, Network, BarChart,
  GitBranch, Copy, Terminal, Play, Pause, RotateCcw,
  ArrowUpRight, Info, Loader2, Plus, Key, History, TrendingUp
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
import { cn } from '@/lib/utils';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import { Skeleton } from '@/components/ui/skeleton';
import { DeploymentMetrics } from './deployment/DeploymentMetrics';
import { AutoScalingConfig } from './deployment/AutoScalingConfig';
import { RollbackManager } from './deployment/RollbackManager';
import { apiRequest } from '@/lib/queryClient';

interface DeploymentManagerProps {
  projectId?: number;
  project?: any;
  isOpen?: boolean;
  onClose?: () => void;
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

export function DeploymentManager({ projectId, project, isOpen = true, onClose, className }: DeploymentManagerProps) {
  // Extract projectId from project if provided
  const actualProjectId = projectId || project?.id;
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
  const [containerStatus, setContainerStatus] = useState<any>(null);
  const [containerLogs, setContainerLogs] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // Only start polling if we have a valid projectId
    if (!actualProjectId) {
      return;
    }
    
    loadDeployments();
    loadStats();
    // Start container status monitoring
    const interval = setInterval(() => {
      checkContainerStatus();
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, [actualProjectId]);

  useEffect(() => {
    if (selectedDeployment) {
      loadBuildLogs(selectedDeployment.id);
      loadEnvVars(selectedDeployment.id);
    }
  }, [selectedDeployment]);

  const loadDeployments = async () => {
    if (!actualProjectId) return;
    
    try {
      const response = await fetch(`/api/projects/${actualProjectId}/deployments`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setDeployments(data.deployments || []);
        if (data.deployments && data.deployments.length > 0 && !selectedDeployment) {
          setSelectedDeployment(data.deployments[0]);
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
    if (!actualProjectId) return;
    
    try {
      const response = await fetch(`/api/projects/${actualProjectId}/deployments/stats`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.stats) {
          setStats(data.stats);
        } else {
          setStats({
            totalDeployments: 0,
            activeDeployments: 0,
            totalRequests: 0,
            averageResponseTime: 0,
            errorRate: 0,
            bandwidth: '0 MB',
            uptime: 0
          });
        }
      } else {
        console.error('Failed to load stats:', response.status);
        setStats({
          totalDeployments: 0,
          activeDeployments: 0,
          totalRequests: 0,
          averageResponseTime: 0,
          errorRate: 0,
          bandwidth: '0 MB',
          uptime: 0
        });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
      setStats(null);
    }
  };

  const checkContainerStatus = async () => {
    if (!actualProjectId) return;
    
    try {
      const response = await fetch(`/api/projects/${actualProjectId}/container/status`, {
        credentials: 'include'
      });
      if (response.ok) {
        const status = await response.json();
        setContainerStatus(status);
        
        // Update deployment status based on container status
        if (status.pods && status.pods.length > 0) {
          const running = status.pods.filter((p: any) => p.status === 'Running').length;
          const total = status.pods.length;
        }
      }
    } catch (error) {
      console.error('Failed to check container status:', error);
    }
  };

  const loadContainerLogs = async () => {
    if (!actualProjectId) return;
    
    try {
      const response = await fetch(`/api/projects/${actualProjectId}/container/logs`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setContainerLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to load container logs:', error);
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
    if (!actualProjectId) return;
    
    try {
      // Load environment variables from project - REAL BACKEND
      const response = await fetch(`/api/environment/${actualProjectId}`, {
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
    if (!actualProjectId) {
      toast({
        title: "Error",
        description: "No project selected",
        variant: "destructive"
      });
      return;
    }
    
    setIsDeploying(true);
    try {
      // Start container creation in background (truly fire-and-forget)
      // This runs async and doesn't block deployment
      setTimeout(() => {
        apiRequest('POST', `/api/projects/${actualProjectId}/container`, {})
          .then(response => {
            // Container environment created successfully
          })
          .catch(err => {
            // Silently handle errors - deployment handles container creation if needed
          });
      }, 0);

      // Trigger deployment directly with manual timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      try {
        const response = await apiRequest('POST', `/api/projects/${actualProjectId}/deploy`, {
          type: 'autoscale',
          regions: ['us-east-1'],
          environment: 'production',
          sslEnabled: true,
          customDomain: customDomain || undefined,
          scaling: {
            minInstances: 1,
            maxInstances: 3,
            targetCPU: 70,
            targetMemory: 70
          }
        });

        clearTimeout(timeoutId);

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
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error: any) {
      console.error('Deployment error:', error);
      const isTimeout = error.name === 'AbortError' || error.name === 'TimeoutError';
      toast({
        title: "Deployment Failed",
        description: isTimeout ? "Deployment request timed out. Please try again." : "Failed to start deployment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleRedeploy = async (deployment: Deployment) => {
    try {
      // Redeploy by calling the deploy endpoint again - REAL BACKEND
      const response = await apiRequest('POST', `/api/deployment/${actualProjectId}/redeploy`, {});

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
      // First stop the container
      const containerResponse = await apiRequest('POST', `/api/projects/${actualProjectId}/container/stop`, {});

      // Then update deployment status
      const response = await apiRequest('POST', `/api/deployments/${deployment.id}/stop`, {});

      if (response.ok && containerResponse.ok) {
        await loadDeployments();
        setContainerStatus(null);
        toast({
          title: "Deployment Stopped",
          description: `Deployment ${deployment.version} and container have been stopped`,
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
      const response = await apiRequest('POST', `/api/environment/${actualProjectId}`, {
        key: newEnvKey,
        value: newEnvValue,
        isSecret: newEnvSecret
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
      case 'deploying': return <Loader2 className="h-4 w-4 animate-spin text-orange-500" />;
      case 'stopped': return <Pause className="h-4 w-4 text-gray-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'deploying': return 'bg-orange-500';
      case 'stopped': return 'bg-gray-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-yellow-500';
    }
  };

  return (
    <LazyMotionDiv 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn("flex flex-col h-full", className)}
    >
      <Tabs defaultValue="overview" className="w-full flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-6 h-12 sm:h-10 rounded-none border-b glassmorphism overflow-x-auto">
          <TabsTrigger 
            value="overview" 
            className="text-[11px] sm:text-[13px] font-medium min-h-[48px] sm:min-h-0 data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-3 sm:px-4"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="metrics" 
            className="text-[11px] sm:text-[13px] font-medium min-h-[48px] sm:min-h-0 data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-3 sm:px-4"
          >
            <Activity className="h-3 w-3 mr-1" />
            Metrics
          </TabsTrigger>
          <TabsTrigger 
            value="autoscaling" 
            className="text-[11px] sm:text-[13px] font-medium min-h-[48px] sm:min-h-0 data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-3 sm:px-4"
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            Auto-Scaling
          </TabsTrigger>
          <TabsTrigger 
            value="rollback" 
            className="text-[11px] sm:text-[13px] font-medium min-h-[48px] sm:min-h-0 data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-3 sm:px-4"
          >
            <History className="h-3 w-3 mr-1" />
            Rollback
          </TabsTrigger>
          <TabsTrigger 
            value="logs" 
            className="text-[11px] sm:text-[13px] font-medium min-h-[48px] sm:min-h-0 data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-3 sm:px-4"
          >
            Logs
          </TabsTrigger>
          <TabsTrigger 
            value="settings" 
            className="text-[11px] sm:text-[13px] font-medium min-h-[48px] sm:min-h-0 data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-3 sm:px-4"
          >
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 flex-1 overflow-auto animate-fadeIn">
          {/* Enhanced Deploy Button Section with Glassmorphism */}
          <LazyMotionDiv 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="p-4 sm:p-5 border-b glassmorphism"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div>
                <h4 className="text-[13px] font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Deploy Application
                </h4>
                <p className="text-[11px] text-muted-foreground mt-1">Deploy your application to production environment</p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowDeployDialog(true)}
                className="min-h-[48px] sm:min-h-[40px] px-4 sm:px-6 bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 btn-premium focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
                disabled={isDeploying}
              >
                {isDeploying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    <span>Deploying...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="h-3.5 w-3.5 mr-1" />
                    <span>Deploy</span>
                  </>
                )}
              </Button>
            </div>
          </LazyMotionDiv>

          {/* Container Status */}
          {containerStatus && (
            <div className="px-2.5 py-2 border-b border-[var(--ecode-border)]">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-[var(--ecode-text-muted)]">Container Status</Label>
                <Badge variant={containerStatus?.deployment?.ready ? "default" : "secondary"} className="text-[10px] h-5">
                  {containerStatus?.deployment?.ready ? "Running" : "Stopped"}
                </Badge>
              </div>
              {containerStatus?.deployment?.availableReplicas !== undefined && (
                <div className="mt-1.5 text-[10px] text-[var(--ecode-text-muted)]">
                  {containerStatus.deployment.availableReplicas}/{containerStatus.deployment.replicas} replicas active
                </div>
              )}
            </div>
          )}
          
          {/* Enhanced Deployment List with Skeleton Loaders */}
          <LazyMotionDiv 
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="px-2.5 py-2 border-b border-[var(--ecode-border)]"
          >
            <Label className="text-xs font-medium mb-2 text-[var(--ecode-text)]">Active Deployments</Label>
            <div className="space-y-3">
              {deployments.length === 0 && !stats ? (
                // Skeleton Loaders for Deployments
                <LazyAnimatePresence>
                  {[1, 2, 3].map((n) => (
                    <LazyMotionDiv
                      key={n}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: n * 0.1 }}
                      className="p-4 rounded-xl glassmorphism animate-pulse"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center space-x-2">
                            <Skeleton className="h-4 w-4 rounded-full" />
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-5 w-12 rounded-full" />
                          </div>
                          <div className="flex items-center space-x-4">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-3 w-28" />
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Skeleton className="h-7 w-7 rounded" />
                          <Skeleton className="h-7 w-7 rounded" />
                        </div>
                      </div>
                    </LazyMotionDiv>
                  ))}
                </LazyAnimatePresence>
              ) : deployments.length === 0 ? (
                <Card className="p-8 text-center border-dashed glassmorphism">
                  <Rocket className="h-12 w-12 mx-auto mb-3 text-primary" />
                  <p className="text-[13px] text-muted-foreground">No deployments yet. Click deploy to get started!</p>
                </Card>
              ) : (
                <LazyAnimatePresence>
                  {deployments.map((deployment, idx) => (
                    <LazyMotionDiv
                      key={deployment.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: idx * 0.05 }}
                      whileHover={{ scale: 1.01 }}
                      className={cn(
                        "p-4 rounded-xl cursor-pointer transition-all duration-300 glassmorphism shadow-lg hover:shadow-xl",
                        selectedDeployment?.id === deployment.id 
                          ? 'bg-gradient-to-r from-primary/10 to-secondary/10 border-primary' 
                          : 'hover:bg-muted'
                      )}
                      onClick={() => setSelectedDeployment(deployment)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <LazyMotionDiv
                              animate={deployment.status === 'deploying' ? { rotate: 360 } : {}}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                              {getStatusIcon(deployment.status)}
                            </LazyMotionDiv>
                            <span className="font-semibold text-[13px]">Deployment #{deployment.id}</span>
                            <Badge 
                              variant="outline" 
                              className="text-[11px] bg-gradient-to-r from-primary/10 to-secondary/10"
                            >
                              v{deployment.version}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 mt-2 text-[11px] text-muted-foreground">
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
                              className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
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
                            className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </LazyMotionDiv>
                  ))}
                </LazyAnimatePresence>
              )}
            </div>
          </LazyMotionDiv>

              {/* Deployment Details */}
              {selectedDeployment && (
                <div className="p-4 space-y-4">
                  <div>
                    <h4 className="text-[13px] font-medium mb-2">Deployment URL</h4>
                    <div className="flex items-center space-x-2">
                      <Input
                        value={selectedDeployment.url || 'Not yet available'}
                        readOnly
                        className="font-mono text-[11px]"
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
                      <Label className="text-[11px] text-muted-foreground">Status</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(selectedDeployment.status)}`} />
                        <span className="text-[13px] capitalize">{selectedDeployment.status}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Uptime</Label>
                      <p className="text-[13px] font-medium mt-1">{stats?.uptime}%</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Response Time</Label>
                      <p className="text-[13px] font-medium mt-1">{stats?.averageResponseTime}ms</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Error Rate</Label>
                      <p className="text-[13px] font-medium mt-1">{stats?.errorRate}%</p>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="logs" className="mt-0">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label>Container Logs</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={loadContainerLogs}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Refresh
                  </Button>
                </div>
                <ScrollArea className="h-[350px] border rounded-lg">
                  <div className="p-3 space-y-1">
                    {containerLogs.length > 0 ? (
                      containerLogs.map((log, index) => (
                        <div key={index} className="font-mono text-[11px] text-foreground">
                          {log}
                        </div>
                      ))
                    ) : buildLogs.length > 0 ? (
                      buildLogs.map((log, index) => (
                        <div key={index} className="flex items-start space-x-2 font-mono text-[11px]">
                          <span className="text-muted-foreground">{log.timestamp}</span>
                          <span className={
                            log.level === 'error' ? 'text-red-500' :
                            log.level === 'warning' ? 'text-yellow-500' :
                            'text-foreground'
                          }>
                            {log.message}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-[11px] text-muted-foreground">No logs available</div>
                    )}
                  </div>
                </ScrollArea>
              </div>
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
                          <code className="text-[11px]">{envVar.key}</code>
                        </div>
                        <code className="text-[11px] text-muted-foreground">
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
                    <p className="text-[11px] text-muted-foreground">Automatically scale based on traffic</p>
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

            {/* Enhanced Metrics Tab with Advanced Features */}
            <TabsContent value="metrics" className="mt-0">
              {selectedDeployment ? (
                <DeploymentMetrics 
                  deploymentId={selectedDeployment.id.toString()} 
                  className="h-full"
                />
              ) : (
                <div className="p-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Deployment Selected</AlertTitle>
                    <AlertDescription>
                      Please select a deployment from the Overview tab to view metrics.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </TabsContent>

            {/* Auto-Scaling Configuration Tab */}
            <TabsContent value="autoscaling" className="mt-0">
              {selectedDeployment ? (
                <AutoScalingConfig 
                  deploymentId={selectedDeployment.id.toString()} 
                  className="h-full"
                />
              ) : (
                <div className="p-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Deployment Selected</AlertTitle>
                    <AlertDescription>
                      Please select a deployment from the Overview tab to configure auto-scaling.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </TabsContent>

            {/* Rollback Management Tab */}
            <TabsContent value="rollback" className="mt-0">
              {selectedDeployment ? (
                <RollbackManager 
                  deploymentId={selectedDeployment.id.toString()} 
                  className="h-full"
                />
              ) : (
                <div className="p-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Deployment Selected</AlertTitle>
                    <AlertDescription>
                      Please select a deployment from the Overview tab to manage versions and rollbacks.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </TabsContent>
          </Tabs>
      
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
                <p className="text-[11px] text-muted-foreground">Enable automatic scaling</p>
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
                className="font-mono text-[13px]"
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
    </LazyMotionDiv>
  );
}