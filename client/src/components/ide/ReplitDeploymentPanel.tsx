// @ts-nocheck
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import {
  Rocket,
  Globe,
  Server,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Loader2,
  Zap,
  Copy,
  Play,
  Square,
  RotateCcw,
  Pause,
  Trash2,
  Filter,
  ArrowDown,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Timer,
  DollarSign,
  Wifi,
  WifiOff,
  FileText,
  Terminal,
  Info,
  History,
  ArrowLeft,
  Shield,
  Link2,
  CheckCircle2,
} from 'lucide-react';

interface ReplitDeploymentPanelProps {
  projectId: string;
  className?: string;
  defaultTab?: 'deploy' | 'logs' | 'analytics';
}

type InternalStatus = 'pending' | 'building' | 'deploying' | 'deployed' | 'active' | 'failed' | 'stopped';
type UIStatus = 'idle' | 'publishing' | 'live' | 'failed' | 'needs-republish';

interface Deployment {
  id: string;
  deploymentId?: string;
  projectId: string;
  status: InternalStatus;
  uiStatus?: UIStatus;
  url?: string;
  domain?: string;
  customDomain?: string;
  environment: string;
  region?: string;
  type?: string;
  createdAt: string;
  updatedAt?: string;
  deployedAt?: string;
  lastCodeChange?: string;
  buildLogs?: string[];
  deploymentLogs?: string[];
}

function translateStatusToUI(internalStatus: string, lastCodeChange?: string, deployedAt?: string): UIStatus {
  switch (internalStatus) {
    case 'pending':
    case 'building':
    case 'deploying':
      return 'publishing';
    case 'active':
    case 'deployed':
      if (lastCodeChange && deployedAt) {
        const codeChangeTime = new Date(lastCodeChange).getTime();
        const deployedTime = new Date(deployedAt).getTime();
        if (codeChangeTime > deployedTime) {
          return 'needs-republish';
        }
      }
      return 'live';
    case 'failed':
      return 'failed';
    case 'stopped':
      return 'idle';
    default:
      return 'idle';
  }
}

interface LogEntry {
  id: string;
  type: 'build' | 'deploy';
  message: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
}

interface DeploymentAnalytics {
  summary: {
    totalRequests: number;
    totalErrors: number;
    errorRate: number;
    avgResponseTime: number;
    uptime: number;
    bandwidth: {
      incoming: number;
      outgoing: number;
      total: number;
    };
  };
  latency: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
    min: number;
  };
  costs: {
    period: string;
    compute: number;
    bandwidth: number;
    storage: number;
    total: number;
    currency: string;
    projectedMonthly: number;
  };
  timeSeries: Array<{
    timestamp: string;
    requests: number;
    errors: number;
    latencyP50: number;
    latencyP99: number;
  }>;
}

type TimePeriod = '1h' | '6h' | '24h' | '7d' | '30d';

const WEBSOCKET_RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function ReplitDeploymentPanel({ 
  projectId, 
  className, 
  defaultTab = 'deploy' 
}: ReplitDeploymentPanelProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [deployType, setDeployType] = useState<'static' | 'autoscale' | 'reserved-vm'>('autoscale');
  const [customDomain, setCustomDomain] = useState('');
  const [environment, setEnvironment] = useState<'production' | 'staging'>('production');
  const [region, setRegion] = useState('us-east-1');
  const [isDeploying, setIsDeploying] = useState(false);
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('24h');
  
  const [showHistory, setShowHistory] = useState(false);
  const [dnsVerificationStatus, setDnsVerificationStatus] = useState<'idle' | 'verifying' | 'verified' | 'failed'>('idle');
  const [dnsRecords, setDnsRecords] = useState<{ type: string; name: string; value: string; verified: boolean }[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const { data: latestDeployment, isLoading: isLoadingDeployment, refetch: refetchDeployment } = useQuery<{ 
    success: boolean; 
    deployment: Deployment 
  }>({
    queryKey: ['/api/projects', projectId, 'deployment', 'latest'],
    refetchInterval: isDeploying ? 3000 : false,
    enabled: !!projectId,
  });

  const { data: deploymentHistory, isLoading: isLoadingHistory } = useQuery<{ 
    success: boolean; 
    deployments: Deployment[] 
  }>({
    queryKey: ['/api/projects', projectId, 'deployments'],
    enabled: !!projectId,
  });

  const { data: analyticsData, isLoading: isLoadingAnalytics, refetch: refetchAnalytics } = useQuery<{
    success: boolean;
    analytics: DeploymentAnalytics;
    period: string;
  }>({
    queryKey: ['/api/projects', projectId, 'deployments', 'analytics', { period: timePeriod }],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/deployments/analytics?period=${timePeriod}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      return response.json();
    },
    enabled: !!projectId && activeTab === 'analytics',
  });

  const detectLogLevel = (message: string): 'info' | 'warn' | 'error' | 'success' => {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('error') || lowerMessage.includes('failed') || lowerMessage.includes('❌')) {
      return 'error';
    }
    if (lowerMessage.includes('warning') || lowerMessage.includes('warn') || lowerMessage.includes('⚠️')) {
      return 'warn';
    }
    if (lowerMessage.includes('success') || lowerMessage.includes('complete') || lowerMessage.includes('✓') || lowerMessage.includes('✅')) {
      return 'success';
    }
    return 'info';
  };

  const fetchLogsViaHTTP = useCallback(async (deploymentId: string) => {
    try {
      const response = await fetch(`/api/deployments/${deploymentId}/logs`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.logs && Array.isArray(data.logs)) {
          setLogs(data.logs.map((log: any) => ({
            ...log,
            level: log.level || detectLogLevel(log.message),
          })));
        }
      }
    } catch (error) {
      console.error('Failed to fetch logs via HTTP:', error);
    }
  }, []);

  const connectWebSocket = useCallback((deploymentId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'subscribe', deploymentId }));
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/deployments`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        reconnectAttempts.current = 0;
        ws.send(JSON.stringify({ action: 'subscribe', deploymentId }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'build_log' || message.type === 'deploy_log') {
            const newLog: LogEntry = {
              id: `${message.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: message.type === 'build_log' ? 'build' : 'deploy',
              message: message.data?.log || '',
              timestamp: message.data?.timestamp || new Date().toISOString(),
              level: detectLogLevel(message.data?.log || ''),
            };
            setLogs(prev => [...prev, newLog]);
          } else if (message.type === 'status_change') {
            refetchDeployment();
            const uiStatus = message.data?.uiStatus || translateStatusToUI(message.data?.status || '');
            const internalStatus = message.data?.status;
            
            if (uiStatus === 'live' || internalStatus === 'deployed' || internalStatus === 'active') {
              setIsDeploying(false);
              toast({ title: 'Deployment successful', description: 'Your app is now live!' });
            } else if (uiStatus === 'failed' || internalStatus === 'failed') {
              setIsDeploying(false);
              toast({ 
                title: 'Deployment failed', 
                description: 'Check the logs for more details',
                variant: 'destructive'
              });
            }
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current++;
          setTimeout(() => connectWebSocket(deploymentId), WEBSOCKET_RECONNECT_DELAY);
        }
      };

      ws.onerror = () => {
        setWsConnected(false);
        fetchLogsViaHTTP(deploymentId);
      };
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      fetchLogsViaHTTP(deploymentId);
    }
  }, [refetchDeployment, fetchLogsViaHTTP]);

  useEffect(() => {
    const deploymentId = latestDeployment?.deployment?.deploymentId || latestDeployment?.deployment?.id;
    if (deploymentId && activeTab === 'logs') {
      connectWebSocket(deploymentId);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [latestDeployment?.deployment?.deploymentId, latestDeployment?.deployment?.id, activeTab, connectWebSocket]);

  useEffect(() => {
    if (isAutoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isAutoScroll]);

  const publishMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/projects/${projectId}/publish`, {
        customDomain: customDomain || undefined,
      });
    },
    onSuccess: () => {
      setIsDeploying(true);
      setLogs([]);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      toast({ title: 'Publishing started', description: 'Your app is being deployed...' });
    },
    onError: (error: Error) => {
      if (error.message.includes('ALREADY_PUBLISHED')) {
        republishMutation.mutate(undefined);
      } else {
        toast({ title: 'Publish failed', description: error.message, variant: 'destructive' });
      }
    },
  });

  const republishMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/projects/${projectId}/republish`, {
        forceRebuild: false,
      });
    },
    onSuccess: () => {
      setIsDeploying(true);
      setLogs([]);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      toast({ title: 'Republishing started', description: 'Updating your deployment...' });
    },
    onError: (error: Error) => {
      toast({ title: 'Republish failed', description: error.message, variant: 'destructive' });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async (deploymentId: string) => {
      return apiRequest('POST', `/api/deployments/${deploymentId}/stop`);
    },
    onSuccess: () => {
      setIsDeploying(false);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      toast({ title: 'Deployment stopped' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to stop deployment', description: error.message, variant: 'destructive' });
    },
  });

  const restartMutation = useMutation({
    mutationFn: async (deploymentId: string) => {
      return apiRequest('POST', `/api/deployments/${deploymentId}/restart`);
    },
    onSuccess: () => {
      setIsDeploying(true);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      toast({ title: 'Deployment restarting' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to restart deployment', description: error.message, variant: 'destructive' });
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: async ({ deploymentId, version }: { deploymentId: string; version: string }) => {
      return apiRequest('POST', `/api/deployments/${deploymentId}/rollback`, {
        version,
        reason: `Rollback initiated from deployment panel`,
      });
    },
    onSuccess: () => {
      setIsDeploying(true);
      setLogs([]);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      toast({ title: 'Rollback initiated', description: 'Rolling back to previous version...' });
    },
    onError: (error: Error) => {
      toast({ title: 'Rollback failed', description: error.message, variant: 'destructive' });
    },
  });

  const verifyDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      return apiRequest('POST', `/api/projects/${projectId}/domains/verify`, { domain });
    },
    onMutate: () => {
      setDnsVerificationStatus('verifying');
    },
    onSuccess: (data: any) => {
      if (data.verified) {
        setDnsVerificationStatus('verified');
        setDnsRecords(data.records || []);
        toast({ title: 'Domain verified', description: 'Your custom domain is configured correctly!' });
      } else {
        setDnsVerificationStatus('failed');
        setDnsRecords(data.records || []);
        toast({ title: 'Domain verification failed', description: 'Please check your DNS settings', variant: 'destructive' });
      }
    },
    onError: (error: Error) => {
      setDnsVerificationStatus('failed');
      toast({ title: 'Verification failed', description: error.message, variant: 'destructive' });
    },
  });

  const updateDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      return apiRequest('POST', `/api/projects/${projectId}/domains`, { customDomain: domain });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      toast({ title: 'Domain updated', description: 'Custom domain configuration saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update domain', description: error.message, variant: 'destructive' });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'deployed':
      case 'active':
      case 'live':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'building':
      case 'deploying':
      case 'pending':
      case 'publishing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'stopped':
      case 'idle':
        return <Square className="h-4 w-4 text-gray-500" />;
      case 'needs-republish':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const variants: Record<string, string> = {
      deployed: 'bg-green-500/10 text-green-500 border-green-500/20',
      active: 'bg-green-500/10 text-green-500 border-green-500/20',
      live: 'bg-green-500/10 text-green-500 border-green-500/20',
      building: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      deploying: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      publishing: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      failed: 'bg-red-500/10 text-red-500 border-red-500/20',
      stopped: 'bg-gray-50 dark:bg-gray-8000/10 text-gray-500 border-gray-500/20',
      idle: 'bg-gray-50 dark:bg-gray-8000/10 text-gray-500 border-gray-500/20',
      'needs-republish': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    };
    return variants[status] || variants.pending;
  };
  
  const getDisplayStatus = (deployment: Deployment): string => {
    if (deployment.uiStatus) {
      return deployment.uiStatus;
    }
    return translateStatusToUI(deployment.status, deployment.lastCodeChange, deployment.deployedAt);
  };

  const getLogLevelClass = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400 bg-red-500/10';
      case 'warn':
        return 'text-yellow-400 bg-yellow-500/10';
      case 'success':
        return 'text-green-400 bg-green-500/10';
      default:
        return 'text-blue-400 bg-blue-500/10';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return logs;
    return logs.filter(log => log.level === logFilter);
  }, [logs, logFilter]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const chartConfig: ChartConfig = {
    requests: {
      label: 'Requests',
      color: 'hsl(var(--chart-1))',
    },
    errors: {
      label: 'Errors',
      color: 'hsl(var(--chart-2))',
    },
    latencyP50: {
      label: 'P50 Latency',
      color: 'hsl(var(--chart-3))',
    },
    latencyP99: {
      label: 'P99 Latency',
      color: 'hsl(var(--chart-4))',
    },
  };

  const latencyChartData = useMemo(() => {
    if (!analyticsData?.analytics?.latency) return [];
    const { p50, p75, p90, p95, p99 } = analyticsData.analytics.latency;
    return [
      { percentile: 'P50', value: Math.round(p50), fill: 'hsl(var(--chart-1))' },
      { percentile: 'P75', value: Math.round(p75), fill: 'hsl(var(--chart-2))' },
      { percentile: 'P90', value: Math.round(p90), fill: 'hsl(var(--chart-3))' },
      { percentile: 'P95', value: Math.round(p95), fill: 'hsl(var(--chart-4))' },
      { percentile: 'P99', value: Math.round(p99), fill: 'hsl(var(--chart-5))' },
    ];
  }, [analyticsData]);

  const timeSeriesData = useMemo(() => {
    if (!analyticsData?.analytics?.timeSeries) return [];
    return analyticsData.analytics.timeSeries.map(item => ({
      ...item,
      time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));
  }, [analyticsData]);

  const deployment = latestDeployment?.deployment;
  const deploymentId = deployment?.deploymentId || deployment?.id;
  const displayStatus = deployment ? getDisplayStatus(deployment) : 'idle';
  const isActive = displayStatus === 'live' || displayStatus === 'needs-republish' || 
    deployment?.status === 'deployed' || deployment?.status === 'active';
  const isInProgress = displayStatus === 'publishing' || 
    deployment?.status === 'building' || deployment?.status === 'deploying' || deployment?.status === 'pending';

  return (
    <Card className={cn('h-full flex flex-col overflow-hidden', className)} data-testid="replit-deployment-panel">
      {/* 1) Status & Publish Section at the TOP (Prominent) */}
      <div className="px-4 pt-4 pb-4 shrink-0 border-b">
        <CardTitle className="text-base font-medium flex items-center gap-2 mb-4">
          <Rocket className="h-4 w-4" />
          Deployment Status
          {wsConnected && activeTab === 'logs' && (
            <Badge variant="outline" className="ml-auto text-[11px] bg-green-500/10 text-green-500">
              <Wifi className="h-3 w-3 mr-1" />
              Live
            </Badge>
          )}
        </CardTitle>
        <Card className={cn("border-2", 
          displayStatus === 'live' ? "border-green-500/20 bg-green-500/5" : 
          displayStatus === 'failed' ? "border-red-500/20 bg-red-500/5" : 
          displayStatus === 'needs-republish' ? "border-yellow-500/20 bg-yellow-500/5" :
          displayStatus === 'publishing' ? "border-blue-500/20 bg-blue-500/5" :
          "bg-muted/30"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-full", 
                  displayStatus === 'live' ? "bg-green-500/20 text-green-500" : 
                  displayStatus === 'failed' ? "bg-red-500/20 text-red-500" : 
                  displayStatus === 'needs-republish' ? "bg-yellow-500/20 text-yellow-500" :
                  displayStatus === 'publishing' ? "bg-blue-500/20 text-blue-500" :
                  "bg-muted text-muted-foreground"
                )}>
                  {getStatusIcon(displayStatus)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg capitalize">{displayStatus.replace('-', ' ')}</span>
                    <Badge className={cn("text-[10px] uppercase font-bold", getStatusBadgeClass(displayStatus))}>
                      {displayStatus}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {displayStatus === 'live' ? 'Your application is live and accessible' :
                     displayStatus === 'needs-republish' ? 'Changes detected since last deployment' :
                     displayStatus === 'publishing' ? 'Deployment in progress...' :
                     displayStatus === 'failed' ? 'Last deployment failed' :
                     'Application is not currently deployed'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isActive && !isInProgress && (
                  <Button 
                    onClick={() => publishMutation.mutate()} 
                    disabled={publishMutation.isPending || isInProgress}
                    className="bg-primary hover:bg-primary/90 text-white gap-2 h-10 px-6"
                    data-testid="button-publish-primary"
                  >
                    {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                    Publish App
                  </Button>
                )}
                
                {displayStatus === 'needs-republish' && (
                  <Button 
                    onClick={() => republishMutation.mutate()} 
                    disabled={republishMutation.isPending || isInProgress}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white gap-2 h-10 px-6"
                    data-testid="button-republish-primary"
                  >
                    {republishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Update App
                  </Button>
                )}

                {isActive && displayStatus !== 'needs-republish' && (
                  <Button 
                    onClick={() => republishMutation.mutate()} 
                    disabled={republishMutation.isPending || isInProgress}
                    variant="outline"
                    className="gap-2 h-10 px-6"
                    data-testid="button-redeploy-primary"
                  >
                    {republishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Redeploy
                  </Button>
                )}
              </div>
            </div>

            {isActive && deployment?.url && (
              <div className="flex flex-col gap-2 p-3 bg-muted/50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Public URL</span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(deployment.url!)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <a href={deployment.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm font-mono truncate bg-background p-2 rounded border">
                  <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{deployment.url}</span>
                </div>
              </div>
            )}
            
            {isInProgress && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span>Deploying...</span>
                  <span>45%</span>
                </div>
                <Progress value={45} className="h-2" />
                <p className="text-[10px] text-muted-foreground animate-pulse text-center">
                  Provisioning infrastructure and building container image...
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="px-4 shrink-0 border-b">
          <TabsList className="h-10 bg-transparent p-0 gap-4">
            <TabsTrigger 
              value="deploy" 
              className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2"
              data-testid="tab-deploy"
            >
              Configuration
            </TabsTrigger>
            <TabsTrigger 
              value="logs" 
              className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2"
              data-testid="tab-logs"
            >
              Logs
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2"
              data-testid="tab-analytics"
            >
              Analytics
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="deploy" className="flex-1 overflow-auto px-4 pt-4 pb-16 space-y-4 m-0 data-[state=inactive]:hidden" data-testid="deploy-tab-content">
          {isLoadingDeployment ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* 2) Config Sections */}
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deployment Type</Label>
                  <div className="grid grid-cols-1 gap-2">
                    <div 
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50",
                        deployType === 'autoscale' ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-muted/30"
                      )}
                      onClick={() => setDeployType('autoscale')}
                      data-testid="deploy-type-autoscale"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">Autoscale</span>
                        <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Serverless execution that scales based on traffic. Perfect for most apps.</p>
                    </div>
                    
                    <div 
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50",
                        deployType === 'static' ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-muted/30"
                      )}
                      onClick={() => setDeployType('static')}
                      data-testid="deploy-type-static"
                    >
                      <span className="font-medium text-sm block mb-1">Static Site</span>
                      <p className="text-[11px] text-muted-foreground">For frontend-only applications. Free global CDN hosting.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="environment" className="text-[11px] font-medium">Environment</Label>
                    <Select value={environment} onValueChange={(v: any) => setEnvironment(v)}>
                      <SelectTrigger id="environment" className="h-8 text-xs bg-muted/30" data-testid="select-environment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="region" className="text-[11px] font-medium">Region</Label>
                    <Select value={region} onValueChange={setRegion}>
                      <SelectTrigger id="region" className="h-8 text-xs bg-muted/30" data-testid="select-region">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                        <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                        <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                        <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custom-domain" className="text-[11px] font-medium">Custom Domain (Optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="custom-domain"
                      placeholder="myapp.com"
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      className="h-8 text-xs bg-muted/30"
                      data-testid="input-custom-domain"
                    />
                    <Button
                      size="sm"
                      className="h-8 text-[11px]"
                      variant="outline"
                      onClick={() => {
                        if (customDomain) {
                          verifyDomainMutation.mutate(customDomain);
                        }
                      }}
                      disabled={!customDomain || verifyDomainMutation.isPending}
                      data-testid="button-verify-domain"
                    >
                      {verifyDomainMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Shield className="h-3 w-3 mr-1" />
                          Verify
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {dnsVerificationStatus !== 'idle' && (
                    <div className={cn(
                      'p-3 rounded-md border text-[12px]',
                      dnsVerificationStatus === 'verified' && 'bg-green-500/10 border-green-500/20 text-green-600',
                      dnsVerificationStatus === 'verifying' && 'bg-blue-500/10 border-blue-500/20 text-blue-600',
                      dnsVerificationStatus === 'failed' && 'bg-red-500/10 border-red-500/20 text-red-600'
                    )}>
                      <div className="flex items-center gap-2 mb-2 font-medium">
                        {dnsVerificationStatus === 'verified' && <CheckCircle2 className="h-4 w-4" />}
                        {dnsVerificationStatus === 'verifying' && <Loader2 className="h-4 w-4 animate-spin" />}
                        {dnsVerificationStatus === 'failed' && <XCircle className="h-4 w-4" />}
                        {dnsVerificationStatus === 'verified' && 'Domain Verified'}
                        {dnsVerificationStatus === 'verifying' && 'Verifying DNS...'}
                        {dnsVerificationStatus === 'failed' && 'Verification Failed'}
                      </div>
                      
                      {dnsRecords.length > 0 && (
                        <div className="space-y-2 mt-2">
                          <div className="text-[10px] uppercase font-bold text-muted-foreground/70">DNS Configuration</div>
                          {dnsRecords.map((record, idx) => (
                            <div key={idx} className="p-2 bg-background/50 rounded text-[10px] font-mono border">
                              <div className="flex items-center gap-2">
                                {record.verified ? <CheckCircle className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                                <span className="font-bold">{record.type}</span>
                                <span className="text-muted-foreground">{record.name}</span>
                                <span className="text-primary truncate">{record.value}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {dnsVerificationStatus === 'verified' && customDomain && (
                        <Button
                          size="sm"
                          className="mt-2 w-full h-8 text-xs"
                          onClick={() => updateDomainMutation.mutate(customDomain)}
                          disabled={updateDomainMutation.isPending}
                        >
                          {updateDomainMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                          Save Configuration
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* 3) Deployment History at the bottom */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <History className="h-3 w-3" />
                    History
                  </Label>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-6 text-[10px]"
                    onClick={() => setShowHistory(!showHistory)}
                    data-testid="button-toggle-history"
                  >
                    {showHistory ? 'Hide' : 'Show All'}
                  </Button>
                </div>
                
                {showHistory && (
                  <div className="space-y-2" data-testid="deployment-history">
                    {isLoadingHistory ? (
                      <div className="space-y-2">
                        {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                      </div>
                    ) : deploymentHistory?.deployments && deploymentHistory.deployments.length > 0 ? (
                      <ScrollArea className="max-h-[150px]">
                        <div className="space-y-2 pr-3">
                          {deploymentHistory.deployments.map((dep) => {
                            const depStatus = getDisplayStatus(dep);
                            const depId = dep.deploymentId || dep.id;
                            const isCurrent = depId === deploymentId;
                            
                            return (
                              <div
                                key={dep.id}
                                className={cn(
                                  'p-2 rounded-md border flex items-center justify-between gap-2',
                                  isCurrent && 'border-primary/40 bg-primary/5 shadow-sm'
                                )}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    {getStatusIcon(depStatus)}
                                    <span className="text-[10px] font-mono truncate">{depId?.substring(0, 8)}</span>
                                    {isCurrent && <Badge variant="secondary" className="text-[8px] h-3.5 px-1 py-0 uppercase">Current</Badge>}
                                  </div>
                                  <div className="text-[9px] text-muted-foreground">
                                    {dep.createdAt ? new Date(dep.createdAt).toLocaleString() : 'Unknown'}
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-1">
                                  {dep.url && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                      <a href={dep.url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    </Button>
                                  )}
                                  {!isCurrent && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-[9px]"
                                      onClick={() => {
                                        if (confirm(`Rollback to ${depId.substring(0, 8)}?`)) {
                                          rollbackMutation.mutate({ deploymentId: depId, version: depId });
                                        }
                                      }}
                                    >
                                      Rollback
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="text-center py-2 text-muted-foreground text-[11px]">No previous deployments</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="flex-1 flex flex-col overflow-hidden px-4 pt-4 pb-16 m-0 gap-3 data-[state=inactive]:hidden" data-testid="logs-tab-content">
          <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <Select value={logFilter} onValueChange={(v) => setLogFilter(v as typeof logFilter)}>
                <SelectTrigger className="w-[120px] h-8" data-testid="select-log-filter">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Logs</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              
              {!wsConnected && (
                <Badge variant="outline" className="text-[11px] bg-yellow-500/10 text-yellow-500">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Offline
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAutoScroll(!isAutoScroll)}
                className={cn(isAutoScroll && 'bg-accent')}
                data-testid="button-toggle-autoscroll"
              >
                {isAutoScroll ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearLogs}
                data-testid="button-clear-logs"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              {deploymentId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchLogsViaHTTP(deploymentId)}
                  data-testid="button-refresh-logs"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <Badge variant="outline" className="text-[11px]">
              <FileText className="h-3 w-3 mr-1" />
              {filteredLogs.length} Entries
            </Badge>
            {isDeploying && (
              <Badge variant="outline" className="text-[11px] bg-blue-500/10 text-blue-500 animate-pulse border-blue-500/20">
                Streaming...
              </Badge>
            )}
          </div>

          <ScrollArea 
            ref={logsContainerRef}
            className="flex-1 rounded-md border bg-black/95 font-mono text-[11px] text-zinc-300"
            data-testid="logs-scroll-area"
          >
            <div className="p-3 space-y-1 min-h-full">
              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-2">
                  <Terminal className="h-8 w-8 opacity-20" />
                  <p>No logs to display</p>
                  {isDeploying && <p className="text-[9px] animate-pulse">Waiting for build output...</p>}
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      'flex items-start gap-2 p-1.5 rounded text-[11px]',
                      getLogLevelClass(log.level)
                    )}
                    data-testid={`log-entry-${log.id}`}
                  >
                    <span className="text-muted-foreground shrink-0 w-16">
                      {new Date(log.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit' 
                      })}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        'text-[10px] px-1 py-0 shrink-0',
                        log.type === 'build' ? 'bg-purple-500/10 text-purple-400' : 'bg-cyan-500/10 text-cyan-400'
                      )}
                    >
                      {log.type}
                    </Badge>
                    <span className="break-all">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="analytics" className="flex-1 overflow-auto px-4 pt-4 pb-16 space-y-4 m-0 data-[state=inactive]:hidden" data-testid="analytics-tab-content">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-medium text-[13px]">Deployment Analytics</h3>
            <div className="flex items-center gap-2">
              <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
                <SelectTrigger className="w-[100px] h-8" data-testid="select-time-period">
                  <Clock className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="6h">6 hours</SelectItem>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchAnalytics()}
                data-testid="button-refresh-analytics"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isLoadingAnalytics ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          ) : analyticsData?.analytics ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card data-testid="metric-requests">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <span className="text-[11px] text-muted-foreground">Requests</span>
                    </div>
                    <p className="text-[15px] font-bold mt-1">
                      {formatNumber(analyticsData.analytics.summary.totalRequests)}
                    </p>
                  </CardContent>
                </Card>
                
                <Card data-testid="metric-error-rate">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-[11px] text-muted-foreground">Error Rate</span>
                    </div>
                    <p className="text-[15px] font-bold mt-1">
                      {analyticsData.analytics.summary.errorRate.toFixed(2)}%
                    </p>
                  </CardContent>
                </Card>
                
                <Card data-testid="metric-response-time">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <Timer className="h-4 w-4 text-green-500" />
                      <span className="text-[11px] text-muted-foreground">Avg Response</span>
                    </div>
                    <p className="text-[15px] font-bold mt-1">
                      {Math.round(analyticsData.analytics.summary.avgResponseTime)}ms
                    </p>
                  </CardContent>
                </Card>
                
                <Card data-testid="metric-uptime">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <Activity className="h-4 w-4 text-purple-500" />
                      <span className="text-[11px] text-muted-foreground">Uptime</span>
                    </div>
                    <p className="text-[15px] font-bold mt-1">
                      {analyticsData.analytics.summary.uptime.toFixed(2)}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="chart-latency">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13px] font-medium">Latency Percentiles (ms)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[180px] w-full">
                    <BarChart data={latencyChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis dataKey="percentile" type="category" width={40} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar 
                        dataKey="value" 
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card data-testid="chart-requests">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13px] font-medium">Requests & Errors Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[180px] w-full">
                    <AreaChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="requests"
                        stroke="hsl(var(--chart-1))"
                        fill="hsl(var(--chart-1))"
                        fillOpacity={0.3}
                        name="Requests"
                      />
                      <Area
                        type="monotone"
                        dataKey="errors"
                        stroke="hsl(var(--chart-2))"
                        fill="hsl(var(--chart-2))"
                        fillOpacity={0.3}
                        name="Errors"
                      />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card data-testid="cost-breakdown">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13px] font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Cost Breakdown ({analyticsData.analytics.costs.period})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[13px]">
                      <span className="text-muted-foreground">Compute</span>
                      <span className="font-medium">${analyticsData.analytics.costs.compute.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[13px]">
                      <span className="text-muted-foreground">Bandwidth</span>
                      <span className="font-medium">${analyticsData.analytics.costs.bandwidth.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[13px]">
                      <span className="text-muted-foreground">Storage</span>
                      <span className="font-medium">${analyticsData.analytics.costs.storage.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total</span>
                      <span className="font-bold text-[15px]">${analyticsData.analytics.costs.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                      <span>Projected Monthly</span>
                      <span className="font-medium">${analyticsData.analytics.costs.projectedMonthly.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Activity className="h-8 w-8 mb-2 opacity-50" />
              <p>No analytics data available</p>
              <p className="text-[11px] mt-1">Analytics will appear after your app receives traffic</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="mt-auto p-4 border-t bg-muted/20 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Server className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
              {isActive ? 'System Healthy' : 'System Ready'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {deployment && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-[10px] gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-500/10 font-bold uppercase"
                  onClick={() => stopMutation.mutate(deploymentId!)}
                  disabled={deployment.status === 'stopped' || isInProgress}
                >
                  <Square className="h-3 w-3 fill-current" />
                  Stop App
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-[10px] gap-1.5 font-bold uppercase"
                  onClick={() => restartMutation.mutate(deploymentId!)}
                  disabled={isInProgress}
                >
                  <RotateCcw className="h-3 w-3" />
                  Restart
                </Button>
              </>
            )}
            {deployment?.url && (
              <Button
                variant="link"
                size="xs"
                className="h-auto p-0 text-[10px] font-mono ml-2"
                onClick={() => copyToClipboard(deployment.url!)}
              >
                {deployment.url.replace(/^https?:\/\//, '').substring(0, 20)}...
                <Copy className="h-2.5 w-2.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default ReplitDeploymentPanel;
