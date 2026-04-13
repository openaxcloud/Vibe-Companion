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
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import {
  Rocket, Globe, Server, Activity, Clock, CheckCircle, XCircle, AlertCircle,
  ExternalLink, RefreshCw, Loader2, Zap, Copy, Play, Square, RotateCcw,
  Pause, Trash2, Filter, ArrowDown, BarChart3, TrendingUp, AlertTriangle,
  Timer, DollarSign, Wifi, WifiOff, FileText, Terminal, Info, History,
  ArrowLeft, Shield, Link2, CheckCircle2, Cloud, HardDrive, Monitor,
  Calendar, Settings, Eye, EyeOff, Plus, Minus, ChevronDown, ChevronRight,
  Database, MapPin, Lock, Unlock, Power, PowerOff, QrCode,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface ReplitDeploymentPanelProps {
  projectId: string;
  className?: string;
  defaultTab?: 'deploy' | 'logs' | 'analytics';
}

type DeploymentType = 'autoscale' | 'static' | 'reserved-vm' | 'scheduled';
type PanelView = 'type-select' | 'configure' | 'deploying' | 'overview';
type OverviewTab = 'overview' | 'logs' | 'analytics' | 'resources' | 'domains' | 'manage';

interface DeploymentSecret {
  key: string;
  value: string;
}

const MACHINE_CONFIGS = [
  { id: 'nano', label: '0.25 vCPU / 512 MiB RAM', cpu: 0.25, ram: 0.5, price: 7, pricePerHour: 0.01 },
  { id: 'micro', label: '0.5 vCPU / 1 GiB RAM', cpu: 0.5, ram: 1, price: 12, pricePerHour: 0.017 },
  { id: 'small', label: '0.5 vCPU / 2 GiB RAM', cpu: 0.5, ram: 2, price: 20, pricePerHour: 0.028 },
  { id: 'medium', label: '1 vCPU / 2 GiB RAM', cpu: 1, ram: 2, price: 28, pricePerHour: 0.039 },
  { id: 'large', label: '2 vCPU / 4 GiB RAM', cpu: 2, ram: 4, price: 50, pricePerHour: 0.069 },
  { id: 'xlarge', label: '4 vCPU / 8 GiB RAM', cpu: 4, ram: 8, price: 96, pricePerHour: 0.133 },
];

const VCPU_OPTIONS = [
  { vcpu: 0.25, units: 4 },
  { vcpu: 0.5, units: 8 },
  { vcpu: 1, units: 18 },
  { vcpu: 2, units: 36 },
  { vcpu: 4, units: 72 },
  { vcpu: 8, units: 144 },
];

const RAM_OPTIONS = [
  { ram: 0.5, units: 1 },
  { ram: 1, units: 2 },
  { ram: 2, units: 4 },
  { ram: 4, units: 8 },
  { ram: 8, units: 16 },
  { ram: 16, units: 32 },
];

const REGIONS = [
  { id: 'us-east-1', name: 'North America', flag: '🇺🇸' },
  { id: 'eu-west-1', name: 'Europe', flag: '🇪🇺' },
  { id: 'ap-southeast-1', name: 'Asia Pacific', flag: '🌏' },
];

function translateStatusToUI(status: string) {
  switch (status) {
    case 'pending': case 'building': case 'deploying': return 'publishing';
    case 'active': case 'deployed': return 'live';
    case 'failed': return 'failed';
    case 'stopped': return 'idle';
    default: return 'idle';
  }
}

export function ReplitDeploymentPanel({
  projectId,
  className,
  defaultTab = 'deploy'
}: ReplitDeploymentPanelProps) {
  const configKey = `deploy-config-${projectId}`;
  const DEPLOY_TYPES: DeploymentType[] = ['autoscale', 'static', 'reserved-vm', 'scheduled'];
  const OVERVIEW_TABS: OverviewTab[] = ['overview', 'logs', 'analytics', 'resources', 'domains', 'manage'];
  const loadConfig = () => {
    try {
      const raw = sessionStorage.getItem(configKey);
      if (raw) {
        const cfg = JSON.parse(raw);
        if (cfg.deployType && !DEPLOY_TYPES.includes(cfg.deployType)) cfg.deployType = 'autoscale';
        if (cfg.overviewTab && !OVERVIEW_TABS.includes(cfg.overviewTab)) cfg.overviewTab = 'overview';
        if (cfg.timeoutUnit && !['minutes', 'hours'].includes(cfg.timeoutUnit)) cfg.timeoutUnit = 'minutes';
        if (cfg.appType && !['web_server', 'background_worker'].includes(cfg.appType)) cfg.appType = 'web_server';
        if (cfg.vcpuIndex != null) cfg.vcpuIndex = Math.max(0, Math.min(cfg.vcpuIndex, 8));
        if (cfg.ramIndex != null) cfg.ramIndex = Math.max(0, Math.min(cfg.ramIndex, 8));
        if (cfg.maxMachines != null) cfg.maxMachines = Math.max(1, Math.min(cfg.maxMachines, 10));
        if (cfg.portMapping != null) cfg.portMapping = Math.max(1, Math.min(cfg.portMapping, 65535));
        return cfg;
      }
    } catch {}
    return null;
  };
  const savedCfg = useRef(loadConfig());

  const [view, setViewRaw] = useState<PanelView>(() => {
    try {
      const saved = sessionStorage.getItem(`deploy-view-${projectId}`);
      if (saved && ['type-select', 'configure', 'deploying', 'overview'].includes(saved)) return saved as PanelView;
    } catch {}
    return 'type-select';
  });
  const [deployType, setDeployTypeRaw] = useState<DeploymentType>(savedCfg.current?.deployType || 'autoscale');
  const [overviewTab, setOverviewTabRaw] = useState<OverviewTab>(savedCfg.current?.overviewTab || 'overview');

  const persistConfig = useCallback((updates: Record<string, any>) => {
    try {
      const cur = JSON.parse(sessionStorage.getItem(configKey) || '{}');
      sessionStorage.setItem(configKey, JSON.stringify({ ...cur, ...updates }));
    } catch {}
  }, [configKey]);

  const setOverviewTab = useCallback((v: OverviewTab) => { setOverviewTabRaw(v); persistConfig({ overviewTab: v }); }, [persistConfig]);

  const setView = useCallback((v: PanelView) => {
    setViewRaw(v);
    try { sessionStorage.setItem(`deploy-view-${projectId}`, v); } catch {}
  }, [projectId]);

  const setDeployType = useCallback((v: DeploymentType) => {
    setDeployTypeRaw(v);
    persistConfig({ deployType: v });
  }, [persistConfig]);

  const [vcpuIndex, setVcpuIndexRaw] = useState(savedCfg.current?.vcpuIndex ?? 4);
  const [ramIndex, setRamIndexRaw] = useState(savedCfg.current?.ramIndex ?? 3);
  const [maxMachines, setMaxMachinesRaw] = useState(savedCfg.current?.maxMachines ?? 3);
  const [editingPower, setEditingPower] = useState(false);

  const setVcpuIndex = useCallback((v: number) => { setVcpuIndexRaw(v); persistConfig({ vcpuIndex: v }); }, [persistConfig]);
  const setRamIndex = useCallback((v: number) => { setRamIndexRaw(v); persistConfig({ ramIndex: v }); }, [persistConfig]);
  const setMaxMachines = useCallback((v: number) => { setMaxMachinesRaw(v); persistConfig({ maxMachines: v }); }, [persistConfig]);

  const [machineConfigId, setMachineConfigIdRaw] = useState(savedCfg.current?.machineConfigId || 'small');
  const [primaryDomain, setPrimaryDomainRaw] = useState(savedCfg.current?.primaryDomain || '');
  const [isPrivate, setIsPrivateRaw] = useState(savedCfg.current?.isPrivate ?? false);
  const [buildCommand, setBuildCommandRaw] = useState(savedCfg.current?.buildCommand || '');
  const [runCommand, setRunCommandRaw] = useState(savedCfg.current?.runCommand || '');
  const [appType, setAppTypeRaw] = useState<'web_server' | 'background_worker'>(savedCfg.current?.appType || 'web_server');
  const [portMapping, setPortMappingRaw] = useState(savedCfg.current?.portMapping ?? 3000);
  const [secrets, setSecrets] = useState<DeploymentSecret[]>(savedCfg.current?.secrets || []);
  const [showAddSecret, setShowAddSecret] = useState(false);
  const [newSecretKey, setNewSecretKey] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [secretVisibility, setSecretVisibility] = useState<Record<string, boolean>>({});

  const setMachineConfigId = useCallback((v: string) => { setMachineConfigIdRaw(v); persistConfig({ machineConfigId: v }); }, [persistConfig]);
  const setPrimaryDomain = useCallback((v: string) => { setPrimaryDomainRaw(v); persistConfig({ primaryDomain: v }); }, [persistConfig]);
  const setIsPrivate = useCallback((v: boolean) => { setIsPrivateRaw(v); persistConfig({ isPrivate: v }); }, [persistConfig]);
  const setBuildCommand = useCallback((v: string) => { setBuildCommandRaw(v); persistConfig({ buildCommand: v }); }, [persistConfig]);
  const setRunCommand = useCallback((v: string) => { setRunCommandRaw(v); persistConfig({ runCommand: v }); }, [persistConfig]);
  const setAppType = useCallback((v: 'web_server' | 'background_worker') => { setAppTypeRaw(v); persistConfig({ appType: v }); }, [persistConfig]);
  const setPortMapping = useCallback((v: number) => { setPortMappingRaw(v); persistConfig({ portMapping: v }); }, [persistConfig]);

  const [cronExpression, setCronExpressionRaw] = useState(savedCfg.current?.cronExpression || '0 * * * *');
  const [scheduleDescription, setScheduleDescriptionRaw] = useState(savedCfg.current?.scheduleDescription || 'Every hour');
  const [jobTimeout, setJobTimeoutRaw] = useState(savedCfg.current?.jobTimeout ?? 2);
  const [timeoutUnit, setTimeoutUnitRaw] = useState<'minutes' | 'hours'>(savedCfg.current?.timeoutUnit || 'minutes');
  const [timezone, setTimezoneRaw] = useState(savedCfg.current?.timezone || 'EST');

  const setCronExpression = useCallback((v: string) => { setCronExpressionRaw(v); persistConfig({ cronExpression: v }); }, [persistConfig]);
  const setScheduleDescription = useCallback((v: string) => { setScheduleDescriptionRaw(v); persistConfig({ scheduleDescription: v }); }, [persistConfig]);
  const setJobTimeout = useCallback((v: number) => { setJobTimeoutRaw(v); persistConfig({ jobTimeout: v }); }, [persistConfig]);
  const setTimeoutUnit = useCallback((v: 'minutes' | 'hours') => { setTimeoutUnitRaw(v); persistConfig({ timeoutUnit: v }); }, [persistConfig]);
  const setTimezone = useCallback((v: string) => { setTimezoneRaw(v); persistConfig({ timezone: v }); }, [persistConfig]);

  const [publicDirectory, setPublicDirectoryRaw] = useState(savedCfg.current?.publicDirectory || 'dist');
  const setPublicDirectory = useCallback((v: string) => { setPublicDirectoryRaw(v); persistConfig({ publicDirectory: v }); }, [persistConfig]);

  const [isDeploying, setIsDeployingRaw] = useState(() => {
    try {
      const ts = sessionStorage.getItem(`deploy-started-${projectId}`);
      return ts ? (Date.now() - Number(ts)) < 120000 : false;
    } catch { return false; }
  });
  const [deployProgress, setDeployProgressRaw] = useState(() => {
    if (savedCfg.current?.deployProgress != null) return savedCfg.current.deployProgress;
    return 0;
  });
  const [deployStage, setDeployStageRaw] = useState(savedCfg.current?.deployStage || '');
  const setDeployProgress = useCallback((v: number) => { setDeployProgressRaw(v); persistConfig({ deployProgress: v }); }, [persistConfig]);
  const setDeployStage = useCallback((v: string) => { setDeployStageRaw(v); persistConfig({ deployStage: v }); }, [persistConfig]);

  const setIsDeploying = useCallback((v: boolean) => {
    setIsDeployingRaw(v);
    try {
      if (v) sessionStorage.setItem(`deploy-started-${projectId}`, String(Date.now()));
      else sessionStorage.removeItem(`deploy-started-${projectId}`);
    } catch {}
  }, [projectId]);
  const [logs, setLogs] = useState<any[]>([]);
  const [logFilter, setLogFilter] = useState('all');
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [timePeriod, setTimePeriod] = useState('24h');
  const [customDomain, setCustomDomainRaw] = useState(savedCfg.current?.customDomain || '');
  const setCustomDomain = useCallback((v: string) => { setCustomDomainRaw(v); persistConfig({ customDomain: v }); }, [persistConfig]);

  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const { data: latestDeployment, isLoading: isLoadingDeployment, refetch: refetchDeployment } = useQuery({
    queryKey: ['/api/projects', projectId, 'deployment', 'latest'],
    refetchInterval: (isDeploying || view === 'deploying') ? 3000 : 30000,
    enabled: !!projectId,
  });

  const { data: deploymentHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['/api/projects', projectId, 'deployments'],
    enabled: !!projectId && view === 'overview',
  });

  const { data: analyticsData, isLoading: isLoadingAnalytics, refetch: refetchAnalytics } = useQuery({
    queryKey: ['/api/projects', projectId, 'deployments', 'analytics', { period: timePeriod }],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/deployments/analytics?period=${timePeriod}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
    enabled: !!projectId && overviewTab === 'analytics',
  });

  const deployment = latestDeployment?.deployment;
  const deploymentId = deployment?.deploymentId || deployment?.id;
  const displayStatus = deployment ? translateStatusToUI(deployment.status) : 'idle';
  const isActive = displayStatus === 'live';
  const isInProgress = displayStatus === 'publishing';

  const syncedRef = useRef(false);
  useEffect(() => {
    if (isLoadingDeployment) return;
    if (syncedRef.current) return;
    syncedRef.current = true;

    if (deployment) {
      const status = translateStatusToUI(deployment.status);
      if (status === 'publishing') {
        setIsDeployingRaw(true);
        setViewRaw('deploying');
        try { sessionStorage.setItem(`deploy-view-${projectId}`, 'deploying'); } catch {}
      } else if (status === 'live' || status === 'failed') {
        if (view === 'type-select' || view === 'deploying') {
          setViewRaw('overview');
          try { sessionStorage.setItem(`deploy-view-${projectId}`, 'overview'); } catch {}
        }
        setIsDeployingRaw(false);
        try { sessionStorage.removeItem(`deploy-started-${projectId}`); } catch {}
      }
    } else {
      if (view === 'overview' || view === 'deploying') {
        setViewRaw('type-select');
        try { sessionStorage.setItem(`deploy-view-${projectId}`, 'type-select'); } catch {}
      }
      setIsDeployingRaw(false);
      try { sessionStorage.removeItem(`deploy-started-${projectId}`); } catch {}
    }
  }, [isLoadingDeployment]);

  useEffect(() => {
    if (deployment && isActive && view === 'deploying') {
      setIsDeploying(false);
      setDeployProgress(100);
      setDeployStage('Complete!');
      setTimeout(() => {
        setView('overview');
        setOverviewTab('overview');
      }, 1000);
    }
  }, [deployment?.status]);

  useEffect(() => {
    if (!isDeploying) return;

    const STATUS_TO_STAGE: Record<string, { stage: string; progress: number }> = {
      pending: { stage: 'Provisioning...', progress: 10 },
      building: { stage: 'Building...', progress: 40 },
      deploying: { stage: 'Promoting...', progress: 75 },
      active: { stage: 'Complete!', progress: 100 },
      deployed: { stage: 'Complete!', progress: 100 },
      live: { stage: 'Complete!', progress: 100 },
      failed: { stage: 'Failed', progress: 0 },
    };

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/publish/status`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();

        if (cancelled) return;

        const deploymentStatus = data.publish?.deployment?.status || data.status || 'pending';
        const mapped = STATUS_TO_STAGE[deploymentStatus] || { stage: 'Processing...', progress: 20 };

        setDeployProgress(mapped.progress);
        setDeployStage(mapped.stage);

        if (deploymentStatus === 'active' || deploymentStatus === 'deployed' || deploymentStatus === 'live') {
          setIsDeploying(false);
          setDeployProgress(100);
          setDeployStage('Complete!');
          refetchDeployment();
          setTimeout(() => {
            setView('overview');
            setOverviewTab('overview');
          }, 1500);
          return;
        }

        if (deploymentStatus === 'failed') {
          setIsDeploying(false);
          setDeployStage('Deployment failed');
          toast({ title: 'Deployment failed', description: 'Check logs for details.', variant: 'destructive' });
          return;
        }
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isDeploying]);

  const fetchLogsViaHTTP = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/deployments/${id}/logs`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.logs) setLogs(data.logs);
      }
    } catch (e) {}
  }, []);

  const connectWebSocket = useCallback((id: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'subscribe', deploymentId: id }));
      return;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/deployments`);
      wsRef.current = ws;
      ws.onopen = () => { setWsConnected(true); ws.send(JSON.stringify({ action: 'subscribe', deploymentId: id })); };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'build_log' || msg.type === 'deploy_log') {
            setLogs(prev => [...prev, { id: Date.now(), type: msg.type === 'build_log' ? 'build' : 'deploy', message: msg.data?.log || '', timestamp: msg.data?.timestamp || new Date().toISOString(), level: detectLogLevel(msg.data?.log || '') }]);
          } else if (msg.type === 'status_change') {
            refetchDeployment();
            if (['deployed', 'active'].includes(msg.data?.status)) { setIsDeploying(false); setDeployProgress(100); toast({ title: 'Deployment successful', description: 'Your app is now live!' }); }
            else if (msg.data?.status === 'failed') { setIsDeploying(false); toast({ title: 'Deployment failed', variant: 'destructive' }); }
          }
        } catch {}
      };
      ws.onclose = () => setWsConnected(false);
      ws.onerror = () => { setWsConnected(false); fetchLogsViaHTTP(id); };
    } catch { fetchLogsViaHTTP(id); }
  }, []);

  useEffect(() => {
    if (deploymentId && overviewTab === 'logs') connectWebSocket(deploymentId);
    return () => { wsRef.current?.close(); wsRef.current = null; };
  }, [deploymentId, overviewTab]);

  useEffect(() => {
    if (isAutoScroll && logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs, isAutoScroll]);

  const detectLogLevel = (msg: string) => {
    const l = msg.toLowerCase();
    if (l.includes('error') || l.includes('failed')) return 'error';
    if (l.includes('warn')) return 'warn';
    if (l.includes('success') || l.includes('complete')) return 'success';
    return 'info';
  };

  const publishMutation = useMutation({
    mutationFn: async (config: any) => {
      return apiRequest('POST', `/api/projects/${projectId}/publish`, config);
    },
    onSuccess: () => {
      setIsDeploying(true);
      setDeployProgress(0);
      setLogs([]);
      setView('deploying');
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      toast({ title: 'Deployment started', description: 'Your app is being deployed...' });
    },
    onError: (error: Error) => {
      if (error.message.includes('ALREADY_PUBLISHED')) {
        republishMutation.mutate({});
      } else {
        toast({ title: 'Deploy failed', description: error.message, variant: 'destructive' });
      }
    },
  });

  const republishMutation = useMutation({
    mutationFn: async (config: any) => apiRequest('POST', `/api/projects/${projectId}/republish`, { forceRebuild: false, ...config }),
    onSuccess: () => {
      setIsDeploying(true);
      setDeployProgress(0);
      setLogs([]);
      setView('deploying');
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      toast({ title: 'Republishing started' });
    },
    onError: (error: Error) => toast({ title: 'Republish failed', description: error.message, variant: 'destructive' }),
  });

  const stopMutation = useMutation({
    mutationFn: async (_id: string) => apiRequest('POST', `/api/projects/${projectId}/deploy/stop`),
    onSuccess: () => { setIsDeploying(false); queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] }); toast({ title: 'Deployment paused' }); },
  });

  const shutdownMutation = useMutation({
    mutationFn: async (_id: string) => apiRequest('DELETE', `/api/projects/${projectId}/deploy`),
    onSuccess: () => { setIsDeploying(false); setView('type-select'); queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] }); toast({ title: 'Deployment shut down', description: 'Your published app has been terminated and unpublished.' }); },
    onError: (error: Error) => toast({ title: 'Shutdown failed', description: error.message, variant: 'destructive' }),
  });

  const handleDeploy = () => {
    const secretsMap: Record<string, string> = {};
    secrets.forEach(s => { if (s.key) secretsMap[s.key] = s.value; });

    const config: any = {
      deploymentType: deployType,
      buildCommand: buildCommand || undefined,
      runCommand: runCommand || undefined,
      customDomain: primaryDomain || undefined,
      isPrivate,
      deploymentSecrets: Object.keys(secretsMap).length > 0 ? secretsMap : undefined,
    };

    if (deployType === 'autoscale') {
      config.machineConfig = { cpu: VCPU_OPTIONS[vcpuIndex]?.vcpu || 4, ram: RAM_OPTIONS[ramIndex]?.ram || 8 };
      config.maxMachines = maxMachines;
    } else if (deployType === 'reserved-vm') {
      const mc = MACHINE_CONFIGS.find(m => m.id === machineConfigId);
      config.machineConfig = mc ? { cpu: mc.cpu, ram: mc.ram } : { cpu: 0.5, ram: 2 };
      config.appType = appType;
      config.portMapping = portMapping;
    } else if (deployType === 'scheduled') {
      config.cronExpression = cronExpression;
      config.scheduleDescription = scheduleDescription;
      config.jobTimeout = timeoutUnit === 'hours' ? jobTimeout * 3600 : jobTimeout * 60;
    } else if (deployType === 'static') {
      config.publicDirectory = publicDirectory;
    }

    publishMutation.mutate(config);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const addSecret = () => {
    if (newSecretKey.trim()) {
      setSecrets(prev => [...prev, { key: newSecretKey.trim(), value: newSecretValue }]);
      setNewSecretKey('');
      setNewSecretValue('');
      setShowAddSecret(false);
    }
  };

  const removeSecret = (idx: number) => {
    setSecrets(prev => prev.filter((_, i) => i !== idx));
  };

  const selectedVCPU = VCPU_OPTIONS[vcpuIndex] || VCPU_OPTIONS[4];
  const selectedRAM = RAM_OPTIONS[ramIndex] || RAM_OPTIONS[3];
  const totalUnitsPerMachine = (selectedVCPU?.units || 72) + (selectedRAM?.units || 8);
  const totalUnitsMax = totalUnitsPerMachine * maxMachines;
  const selectedMachineConfig = MACHINE_CONFIGS.find(m => m.id === machineConfigId) || MACHINE_CONFIGS[2];

  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return logs;
    return logs.filter(l => l.level === logFilter);
  }, [logs, logFilter]);

  const chartConfig: ChartConfig = {
    requests: { label: 'Requests', color: 'hsl(var(--chart-1))' },
    errors: { label: 'Errors', color: 'hsl(var(--chart-2))' },
  };

  if (view === 'type-select') {
    return (
      <div className={cn('h-full flex flex-col overflow-auto', className)} data-testid="replit-deployment-panel">
        <div className="flex-1 flex flex-col items-center justify-start px-4 py-8">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
            <Rocket className="w-6 h-6 text-green-500" />
          </div>
          <h2 className="text-lg font-bold text-[var(--ide-text)] mb-1" data-testid="deploy-title">Deploy to production</h2>
          <p className="text-[12px] text-[var(--ide-text-muted)] text-center max-w-sm mb-1">
            Publish a live, stable, public version of your App, unaffected by the changes you make in the workspace.
          </p>
          <button className="text-[11px] text-[#0079F2] hover:underline mb-6">Learn more.</button>

          <div className="grid grid-cols-4 gap-2 w-full max-w-lg mb-4" data-testid="deploy-type-cards">
            {([
              { type: 'reserved-vm' as DeploymentType, icon: <HardDrive className="w-5 h-5" />, label: 'Reserved VM', sub: 'Always On Servers' },
              { type: 'autoscale' as DeploymentType, icon: <Cloud className="w-5 h-5" />, label: 'Autoscale', sub: 'Best choice for most apps', recommended: true },
              { type: 'static' as DeploymentType, icon: <Monitor className="w-5 h-5" />, label: 'Static pages', sub: 'Simple HTML websites' },
              { type: 'scheduled' as DeploymentType, icon: <Calendar className="w-5 h-5" />, label: 'Scheduled', sub: 'Time-based job scheduler' },
            ]).map(item => (
              <button
                key={item.type}
                className={cn(
                  'relative flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all text-center',
                  deployType === item.type
                    ? 'border-[#0079F2] bg-[#0079F2]/10 ring-1 ring-[#0079F2]'
                    : 'border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[#0079F2]/50'
                )}
                onClick={() => setDeployType(item.type)}
                data-testid={`deploy-type-${item.type}`}
              >
                {item.recommended && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[8px] bg-[#0079F2] text-white px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                    Recommended
                  </span>
                )}
                <div className={cn('text-[var(--ide-text-muted)]', deployType === item.type && 'text-[#0079F2]')}>
                  {item.icon}
                </div>
                <span className={cn('text-[11px] font-semibold', deployType === item.type ? 'text-[#0079F2]' : 'text-[var(--ide-text)]')}>
                  {item.label}
                </span>
                <span className="text-[9px] text-[var(--ide-text-muted)] leading-tight">{item.sub}</span>
              </button>
            ))}
          </div>

          <Button
            className="w-full max-w-lg h-10 bg-[#0079F2] hover:bg-[#0079F2]/90 text-white text-[13px] font-medium"
            onClick={() => setView('configure')}
            data-testid="button-setup-deployment"
          >
            Set up your deployment
          </Button>

          <div className="w-full max-w-lg mt-6">
            {deployType === 'autoscale' && (
              <div className="space-y-3">
                <h3 className="text-[13px] font-semibold text-[var(--ide-text)]">Scale up and down to meet demand exactly</h3>
                <div className="flex items-start gap-3">
                  <Activity className="w-5 h-5 text-[var(--ide-text-muted)] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[var(--ide-text-muted)]">
                    Automatically scales from zero to any level of demand, making it inexpensive for most apps and effortless when you go viral.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <DollarSign className="w-5 h-5 text-[var(--ide-text-muted)] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[var(--ide-text-muted)]">
                    Usage-based pricing. Billed at $0.0000032 per compute unit, plus a fixed cost of $1 per month per deployment.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-[var(--ide-text-muted)] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[var(--ide-text-muted)]">Suitable for web apps and stateless APIs.</p>
                </div>
              </div>
            )}

            {deployType === 'static' && (
              <div className="space-y-3">
                <div className="p-2 rounded bg-[#F5A623]/10 border border-[#F5A623]/30 text-[10px] text-[#F5A623]">
                  Static deployments are not yet officially supported for Agent Apps.
                </div>
                <h3 className="text-[13px] font-semibold text-[var(--ide-text)]">Basic websites with no backend server</h3>
                <div className="flex items-start gap-3">
                  <Globe className="w-5 h-5 text-[var(--ide-text-muted)] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[var(--ide-text-muted)]">You only pay for outbound data transfer. $0.10/GiB.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Database className="w-5 h-5 text-[var(--ide-text-muted)] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[var(--ide-text-muted)]">No database or data persistence.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-[var(--ide-text-muted)] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[var(--ide-text-muted)]">Suitable for HTML, CSS, JavaScript sites.</p>
                </div>
              </div>
            )}

            {deployType === 'reserved-vm' && (
              <div className="space-y-3">
                <h3 className="text-[13px] font-semibold text-[var(--ide-text)]">Reserved VMs are for long-running jobs and apps</h3>
                <div className="flex items-start gap-3">
                  <Server className="w-5 h-5 text-[var(--ide-text-muted)] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[var(--ide-text-muted)]">Reserved VMs ensure high uptime, minimizing disruptions for apps requiring persistent session data.</p>
                </div>
                <div className="flex items-start gap-3">
                  <DollarSign className="w-5 h-5 text-[var(--ide-text-muted)] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[var(--ide-text-muted)]">Reserved VMs are billed hourly starting at $0.00833/hour.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-[var(--ide-text-muted)] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[var(--ide-text-muted)]">Suitable for bots, stateful APIs, webscraping, and long-running jobs.</p>
                </div>
              </div>
            )}

            {deployType === 'scheduled' && (
              <div className="space-y-3">
                <h3 className="text-[13px] font-semibold text-[var(--ide-text)]">The easiest way to schedule for your apps to run</h3>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-[var(--ide-text-muted)] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[var(--ide-text-muted)]">Scheduled deployments run at a specified time and frequency configured by you.</p>
                </div>
                <div className="flex items-start gap-3">
                  <DollarSign className="w-5 h-5 text-[var(--ide-text-muted)] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[var(--ide-text-muted)]">Usage-based pricing. Each scheduled job is billed at $0.00000125 per compute unit + $0.10 per month for the scheduler.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-[var(--ide-text-muted)] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[var(--ide-text-muted)]">Suitable for internal tools, one-off tasks, and Cron jobs.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'configure') {
    return (
      <div className={cn('h-full flex flex-col overflow-auto', className)} data-testid="replit-deployment-panel">
        <div className="px-4 py-3 border-b border-[var(--ide-border)] flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setView('type-select')} data-testid="button-back-to-types">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-[14px] font-bold text-[var(--ide-text)]">
            {deployType === 'autoscale' && 'Autoscale machine configuration'}
            {deployType === 'reserved-vm' && 'Reserved VM configuration'}
            {deployType === 'static' && 'Static deployment configuration'}
            {deployType === 'scheduled' && 'Scheduled Job configuration'}
          </h2>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-4 py-4 space-y-5">
            {deployType === 'autoscale' && (
              <>
                <p className="text-[11px] text-[var(--ide-text-muted)]">
                  Autoscale apps spin up enough machines to meet demand at any point in time. You are billed for the total number of compute units across all machines.
                </p>

                <div className="rounded-lg border border-[var(--ide-border)] p-4 space-y-3" data-testid="machine-power-section">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[var(--ide-text-muted)]" />
                      <span className="text-[13px] font-semibold text-[var(--ide-text)]">Machine power</span>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setEditingPower(!editingPower)} data-testid="button-edit-power">
                      {editingPower ? 'Done' : 'Edit'}
                    </Button>
                  </div>
                  <p className="text-[10px] text-[var(--ide-text-muted)]">The power level for each machine that spins up upon any request</p>

                  {editingPower ? (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[12px] font-semibold text-[var(--ide-text)]">{selectedVCPU.vcpu} vCPUs</span>
                          <span className="text-[11px] text-[var(--ide-text-muted)]">{selectedVCPU.units} compute units/sec</span>
                        </div>
                        <Slider value={[vcpuIndex]} onValueChange={([v]) => setVcpuIndex(v)} min={0} max={VCPU_OPTIONS.length - 1} step={1} data-testid="slider-vcpu" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[12px] font-semibold text-[var(--ide-text)]">{selectedRAM.ram} GiB RAM</span>
                          <span className="text-[11px] text-[var(--ide-text-muted)]">{selectedRAM.units} compute units/sec</span>
                        </div>
                        <Slider value={[ramIndex]} onValueChange={([v]) => setRamIndex(v)} min={0} max={RAM_OPTIONS.length - 1} step={1} data-testid="slider-ram" />
                      </div>
                      <p className="text-[10px] text-[var(--ide-text-muted)]">Only some configurations are valid. When you change one slider, the other one will automatically adjust to remain valid.</p>
                      <div className="flex items-center justify-between pt-2 border-t border-[var(--ide-border)]">
                        <span className="text-[12px] font-bold text-[var(--ide-text)]">Total per machine</span>
                        <span className="text-[12px] font-bold text-[var(--ide-text)]">{totalUnitsPerMachine} compute units/sec</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-[12px]">
                        <span className="text-[var(--ide-text)]">{selectedVCPU.vcpu} vCPUs</span>
                        <span className="text-[var(--ide-text-muted)]">{selectedVCPU.units} compute units/sec</span>
                      </div>
                      <div className="flex justify-between text-[12px]">
                        <span className="text-[var(--ide-text)]">{selectedRAM.ram} GiB RAM</span>
                        <span className="text-[var(--ide-text-muted)]">{selectedRAM.units} compute units/sec</span>
                      </div>
                      <div className="flex justify-between text-[12px] pt-2 border-t border-[var(--ide-border)]">
                        <span className="font-bold text-[var(--ide-text)]">Total per machine</span>
                        <span className="font-bold text-[var(--ide-text)]">{totalUnitsPerMachine} compute units/sec</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-lg border border-[var(--ide-border)] p-4 space-y-3" data-testid="max-machines-section">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-[var(--ide-text-muted)]" />
                    <span className="text-[13px] font-semibold text-[var(--ide-text)]">Max number of machines</span>
                  </div>
                  <p className="text-[10px] text-[var(--ide-text-muted)]">The most machines that should ever spin up to handle your highest traffic. More machines means a faster experience for your users.</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[var(--ide-text)]">{maxMachines} machines</span>
                    <span className="text-[11px] text-[var(--ide-text-muted)]">{totalUnitsMax} compute units/s at max traffic</span>
                  </div>
                  <Slider value={[maxMachines]} onValueChange={([v]) => setMaxMachines(v)} min={1} max={10} step={1} data-testid="slider-max-machines" />
                </div>

                <Button className="w-full h-11 bg-[#0079F2] hover:bg-[#0079F2]/90 text-white text-[13px] font-medium gap-2" onClick={handleDeploy} disabled={publishMutation.isPending} data-testid="button-deploy">
                  {publishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                  Approve and configure build settings
                </Button>
                <p className="text-[10px] text-[var(--ide-text-muted)] text-center">
                  Your deployed app will utilize any available monthly free allotment before charging for additional resource usage.
                </p>
              </>
            )}

            {deployType === 'reserved-vm' && (
              <>
                <p className="text-[11px] text-[var(--ide-text-muted)]">
                  Reserved VM apps are always on and can have a dedicated machine. You are billed for the total number of hours your machines have been running for. The cost per hour changes depending on your machine configuration.
                </p>

                <div className="space-y-2">
                  <Label className="text-[11px] font-medium text-[var(--ide-text)]">Machine Configuration</Label>
                  <Select value={machineConfigId} onValueChange={setMachineConfigId}>
                    <SelectTrigger className="h-9 bg-[var(--ide-surface)] border-[var(--ide-border)] text-[12px]" data-testid="select-machine-config">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MACHINE_CONFIGS.map(mc => (
                        <SelectItem key={mc.id} value={mc.id}>
                          {mc.label} — ${mc.price}/month (${mc.pricePerHour}/hour)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-[var(--ide-text-muted)]">${selectedMachineConfig.price} per month (${selectedMachineConfig.pricePerHour}/hour)</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-medium text-[var(--ide-text)]">Primary domain</Label>
                  <div className="flex items-center gap-1">
                    <Input value={primaryDomain} onChange={e => setPrimaryDomain(e.target.value)} placeholder="my-app-name" className="flex-1 h-9 text-[12px] bg-[var(--ide-surface)] border-[var(--ide-border)]" data-testid="input-primary-domain" />
                    <span className="text-[11px] text-[var(--ide-text-muted)] whitespace-nowrap">.e-code.app</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-[11px] font-medium text-[var(--ide-text)]">Private Deployment</Label>
                    <p className="text-[9px] text-[var(--ide-text-muted)]">Limit deployment access to team members.</p>
                  </div>
                  <Switch checked={isPrivate} onCheckedChange={setIsPrivate} data-testid="switch-private" />
                </div>

                <Separator className="border-[var(--ide-border)]" />

                <div className="space-y-2">
                  <Label className="text-[11px] font-medium text-[var(--ide-text)]">Build command <span className="text-[var(--ide-text-muted)] font-normal">optional</span></Label>
                  <Input value={buildCommand} onChange={e => setBuildCommand(e.target.value)} placeholder="" className="h-9 text-[12px] font-mono bg-[var(--ide-surface)] border-[var(--ide-border)]" data-testid="input-build-command" />
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-medium text-[var(--ide-text)]">Run command</Label>
                  <Input value={runCommand} onChange={e => setRunCommand(e.target.value)} placeholder="npm start" className="h-9 text-[12px] font-mono bg-[var(--ide-surface)] border-[var(--ide-border)]" data-testid="input-run-command" />
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-medium text-[var(--ide-text)]">Deployment secrets</Label>
                  {secrets.map((secret, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-[var(--ide-surface)] rounded border border-[var(--ide-border)]" data-testid={`secret-${idx}`}>
                      <Globe className="w-3.5 h-3.5 text-[var(--ide-text-muted)] shrink-0" />
                      <span className="text-[11px] font-mono text-[var(--ide-text)] flex-1">{secret.key}</span>
                      <span className="text-[11px] font-mono text-[var(--ide-text-muted)]">
                        {secretVisibility[secret.key] ? secret.value : '••••••••'}
                      </span>
                      <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setSecretVisibility(prev => ({ ...prev, [secret.key]: !prev[secret.key] }))}>
                        {secretVisibility[secret.key] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-red-400" onClick={() => removeSecret(idx)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  {showAddSecret ? (
                    <div className="space-y-2 p-2 bg-[var(--ide-surface)] rounded border border-[var(--ide-border)]">
                      <Input value={newSecretKey} onChange={e => setNewSecretKey(e.target.value)} placeholder="KEY" className="h-7 text-[11px] font-mono" data-testid="input-secret-key" />
                      <Input value={newSecretValue} onChange={e => setNewSecretValue(e.target.value)} placeholder="value" className="h-7 text-[11px] font-mono" type="password" data-testid="input-secret-value" />
                      <div className="flex gap-1">
                        <Button size="sm" className="h-6 text-[10px] flex-1 bg-[#0079F2]" onClick={addSecret}>Add</Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setShowAddSecret(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full h-8 text-[11px] gap-1 border-[var(--ide-border)]" onClick={() => setShowAddSecret(true)} data-testid="button-add-secret">
                      <Plus className="w-3 h-3" /> Add deployment secret
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-medium text-[var(--ide-text)]">App type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button className={cn('p-2 rounded border text-[11px] text-center', appType === 'web_server' ? 'border-[#0079F2] bg-[#0079F2]/10 text-[#0079F2]' : 'border-[var(--ide-border)] text-[var(--ide-text-muted)]')} onClick={() => setAppType('web_server')} data-testid="apptype-webserver">
                      Web Server
                    </button>
                    <button className={cn('p-2 rounded border text-[11px] text-center', appType === 'background_worker' ? 'border-[#0079F2] bg-[#0079F2]/10 text-[#0079F2]' : 'border-[var(--ide-border)] text-[var(--ide-text-muted)]')} onClick={() => setAppType('background_worker')} data-testid="apptype-worker">
                      Background Worker
                    </button>
                  </div>
                </div>

                <Button className="w-full h-11 bg-[#0079F2] hover:bg-[#0079F2]/90 text-white text-[13px] font-medium gap-2" onClick={handleDeploy} disabled={publishMutation.isPending} data-testid="button-deploy">
                  {publishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                  Deploy
                </Button>
                <p className="text-[10px] text-[var(--ide-text-muted)] text-center">Your deployed app will incur charges for any resource usage.</p>
              </>
            )}

            {deployType === 'scheduled' && (
              <>
                <p className="text-[11px] text-[var(--ide-text-muted)]">
                  Scheduled deployments run at a specified time and frequency configured by you. During executions they spin up an on demand machine to run your code. You are billed for the total number of compute units used across all machines plus $1/month per scheduled deployment scheduler.
                </p>

                <div className="space-y-2">
                  <Label className="text-[11px] font-medium text-[var(--ide-text)]">Machine Configuration</Label>
                  <div className="p-2 bg-[var(--ide-surface)] rounded border border-[var(--ide-border)] text-[11px] text-[var(--ide-text)]">
                    1 vCPU / 2 GiB RAM ($0.000070/sec) <span className="text-[var(--ide-text-muted)]">Manage</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium text-[var(--ide-text)]">Schedule description</Label>
                    <Input value={scheduleDescription} onChange={e => setScheduleDescription(e.target.value)} placeholder="Every hour" className="h-9 text-[12px] bg-[var(--ide-surface)] border-[var(--ide-border)]" data-testid="input-schedule-desc" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium text-[var(--ide-text)]">Cron expression</Label>
                    <div className="flex items-center gap-1">
                      <Input value={cronExpression} onChange={e => setCronExpression(e.target.value)} placeholder="0 * * * *" className="h-9 text-[12px] font-mono bg-[var(--ide-surface)] border-[var(--ide-border)] flex-1" data-testid="input-cron" />
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger className="h-9 w-20 text-[11px] bg-[var(--ide-surface)] border-[var(--ide-border)]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EST">EST</SelectItem>
                          <SelectItem value="PST">PST</SelectItem>
                          <SelectItem value="UTC">UTC</SelectItem>
                          <SelectItem value="CET">CET</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-medium text-[var(--ide-text)]">Job timeout</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={jobTimeout} onChange={e => setJobTimeout(Number(e.target.value))} className="h-9 w-20 text-[12px] bg-[var(--ide-surface)] border-[var(--ide-border)]" data-testid="input-job-timeout" />
                    <Select value={timeoutUnit} onValueChange={(v: any) => setTimeoutUnit(v)}>
                      <SelectTrigger className="h-9 w-24 text-[11px] bg-[var(--ide-surface)] border-[var(--ide-border)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">minutes</SelectItem>
                        <SelectItem value="hours">hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator className="border-[var(--ide-border)]" />

                <div className="space-y-2">
                  <Label className="text-[11px] font-medium text-[var(--ide-text)]">Build command <span className="text-[var(--ide-text-muted)] font-normal">optional</span></Label>
                  <Input value={buildCommand} onChange={e => setBuildCommand(e.target.value)} className="h-9 text-[12px] font-mono bg-[var(--ide-surface)] border-[var(--ide-border)]" data-testid="input-build-command" />
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-medium text-[var(--ide-text)]">Run command</Label>
                  <Input value={runCommand} onChange={e => setRunCommand(e.target.value)} placeholder="python3 main.py" className="h-9 text-[12px] font-mono bg-[var(--ide-surface)] border-[var(--ide-border)]" data-testid="input-run-command" />
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-medium text-[var(--ide-text)]">Deployment secrets</Label>
                  {secrets.map((secret, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-[var(--ide-surface)] rounded border border-[var(--ide-border)]">
                      <Globe className="w-3.5 h-3.5 text-[var(--ide-text-muted)] shrink-0" />
                      <span className="text-[11px] font-mono flex-1">{secret.key}</span>
                      <span className="text-[11px] font-mono text-[var(--ide-text-muted)]">••••••••</span>
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-red-400" onClick={() => removeSecret(idx)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                  {showAddSecret ? (
                    <div className="space-y-2 p-2 bg-[var(--ide-surface)] rounded border border-[var(--ide-border)]">
                      <Input value={newSecretKey} onChange={e => setNewSecretKey(e.target.value)} placeholder="KEY" className="h-7 text-[11px] font-mono" data-testid="input-secret-key" />
                      <Input value={newSecretValue} onChange={e => setNewSecretValue(e.target.value)} placeholder="value" className="h-7 text-[11px] font-mono" type="password" data-testid="input-secret-value" />
                      <div className="flex gap-1">
                        <Button size="sm" className="h-6 text-[10px] flex-1 bg-[#0079F2]" onClick={addSecret}>Add</Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setShowAddSecret(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full h-8 text-[11px] gap-1 border-[var(--ide-border)]" onClick={() => setShowAddSecret(true)} data-testid="button-add-secret">
                      <Plus className="w-3 h-3" /> Add deployment secret
                    </Button>
                  )}
                </div>

                <Button className="w-full h-11 bg-[#0079F2] hover:bg-[#0079F2]/90 text-white text-[13px] font-medium gap-2" onClick={handleDeploy} disabled={publishMutation.isPending} data-testid="button-deploy">
                  {publishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                  Deploy
                </Button>
                <p className="text-[10px] text-[var(--ide-text-muted)] text-center">Your deployed app will incur charges for any resource usage.</p>
              </>
            )}

            {deployType === 'static' && (
              <>
                <div className="space-y-2">
                  <Label className="text-[11px] font-medium text-[var(--ide-text)]">Public directory</Label>
                  <Input value={publicDirectory} onChange={e => setPublicDirectory(e.target.value)} placeholder="dist" className="h-9 text-[12px] font-mono bg-[var(--ide-surface)] border-[var(--ide-border)]" data-testid="input-public-dir" />
                  <p className="text-[10px] text-[var(--ide-text-muted)]">The folder containing your built HTML/CSS/JS files to serve.</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-medium text-[var(--ide-text)]">Build command <span className="text-[var(--ide-text-muted)] font-normal">optional</span></Label>
                  <Input value={buildCommand} onChange={e => setBuildCommand(e.target.value)} placeholder="npm run build" className="h-9 text-[12px] font-mono bg-[var(--ide-surface)] border-[var(--ide-border)]" data-testid="input-build-command" />
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-medium text-[var(--ide-text)]">Primary domain</Label>
                  <div className="flex items-center gap-1">
                    <Input value={primaryDomain} onChange={e => setPrimaryDomain(e.target.value)} placeholder="my-site" className="flex-1 h-9 text-[12px] bg-[var(--ide-surface)] border-[var(--ide-border)]" data-testid="input-primary-domain" />
                    <span className="text-[11px] text-[var(--ide-text-muted)] whitespace-nowrap">.e-code.app</span>
                  </div>
                </div>

                <Button className="w-full h-11 bg-[#0079F2] hover:bg-[#0079F2]/90 text-white text-[13px] font-medium gap-2" onClick={handleDeploy} disabled={publishMutation.isPending} data-testid="button-deploy">
                  {publishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                  Deploy
                </Button>
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (view === 'deploying') {
    const stages = ['Provision', 'Security Scan', 'Build', 'Bundle', 'Promote'];
    return (
      <div className={cn('h-full flex flex-col', className)} data-testid="replit-deployment-panel">
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
          <Loader2 className="w-10 h-10 text-[#0079F2] animate-spin mb-4" />
          <h2 className="text-[15px] font-bold text-[var(--ide-text)] mb-1">Deploying your app...</h2>
          <p className="text-[11px] text-[var(--ide-text-muted)] mb-6">{deployStage || 'Initializing...'}</p>

          <div className="w-full max-w-sm space-y-2 mb-6">
            <div className="flex items-center gap-1">
              {stages.map((stage, i) => {
                const stageProgress = deployProgress / 20;
                const isDone = stageProgress > i + 1;
                const isCurrent = stageProgress > i && stageProgress <= i + 1;
                return (
                  <div key={stage} className="flex-1">
                    <div className={cn('h-2 rounded-full transition-all', isDone ? 'bg-green-500' : isCurrent ? 'bg-[#0079F2] animate-pulse' : 'bg-[var(--ide-border)]')} />
                    <div className={cn('text-[8px] mt-1 text-center font-medium', isDone ? 'text-green-500' : isCurrent ? 'text-[#0079F2]' : 'text-[var(--ide-text-muted)]')}>
                      {isDone ? `${stage} ✓` : stage}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-center text-[10px] text-[var(--ide-text-muted)]">{deployProgress}% complete</div>
          </div>

          <ScrollArea className="w-full max-w-sm h-40 rounded border border-[var(--ide-border)] bg-black/95 font-mono text-[10px] text-zinc-400">
            <div className="p-2 space-y-0.5">
              {logs.length === 0 ? (
                <div className="text-center py-4 text-zinc-600">Waiting for build output...</div>
              ) : logs.slice(-20).map((log, i) => (
                <div key={log.id || i} className="text-[10px]">{log.message}</div>
              ))}
            </div>
          </ScrollArea>

          <Button variant="ghost" size="sm" className="mt-4 text-[11px] text-[var(--ide-text-muted)]" onClick={() => { setView('overview'); setOverviewTab('overview'); }}>
            View full dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('h-full flex flex-col overflow-hidden', className)} data-testid="replit-deployment-panel">
      <div className="flex items-center border-b border-[var(--ide-border)] shrink-0 overflow-x-auto">
        {([
          { id: 'overview' as OverviewTab, icon: <Globe className="w-3 h-3" />, label: 'Overview' },
          { id: 'logs' as OverviewTab, icon: <FileText className="w-3 h-3" />, label: 'Logs' },
          { id: 'analytics' as OverviewTab, icon: <BarChart3 className="w-3 h-3" />, label: 'Analytics' },
          { id: 'resources' as OverviewTab, icon: <Activity className="w-3 h-3" />, label: 'Resources' },
          { id: 'domains' as OverviewTab, icon: <Globe className="w-3 h-3" />, label: 'Domains' },
          { id: 'manage' as OverviewTab, icon: <Settings className="w-3 h-3" />, label: 'Manage' },
        ]).map(tab => (
          <button
            key={tab.id}
            className={cn(
              'flex items-center gap-1 px-3 py-2 text-[10px] font-medium whitespace-nowrap border-b-2 transition-colors',
              overviewTab === tab.id
                ? 'border-[#0079F2] text-[var(--ide-text)]'
                : 'border-transparent text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
            )}
            onClick={() => setOverviewTab(tab.id)}
            data-testid={`tab-overview-${tab.id}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {overviewTab === 'overview' && (
        <div className="flex-1 overflow-auto">
          <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-b border-[var(--ide-border)]">
            <Button size="sm" className="h-7 text-[10px] bg-green-600 hover:bg-green-700 text-white gap-1" onClick={() => republishMutation.mutate({})} disabled={republishMutation.isPending || isInProgress} data-testid="button-republish">
              {republishMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Republish
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 border-[var(--ide-border)]" onClick={() => setView('configure')} data-testid="button-adjust-settings">
              <Settings className="w-3 h-3" /> Adjust settings
            </Button>
          </div>

          {isDeploying && (
            <div className="px-4 py-3 border-b border-[var(--ide-border)]">
              <div className="flex items-center gap-3 mb-2">
                {['Provision', 'Security Scan', 'Build', 'Bundle', 'Promote'].map((stage, i) => {
                  const stageProgress = deployProgress / 20;
                  const isDone = stageProgress > i + 1;
                  const isCurrent = stageProgress > i && stageProgress <= i + 1;
                  return (
                    <div key={stage} className="flex-1">
                      <div className={cn('h-1.5 rounded-full', isDone ? 'bg-green-500' : isCurrent ? 'bg-[#0079F2] animate-pulse' : 'bg-[var(--ide-border)]')} />
                      <div className={cn('text-[8px] mt-0.5 text-center', isDone ? 'text-green-500' : isCurrent ? 'text-[#0079F2]' : 'text-[var(--ide-text-muted)]')}>
                        {stage} {isDone && '✓'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="px-4 py-3 space-y-3">
            <h3 className="text-[13px] font-bold text-[var(--ide-text)]">Production</h3>

            <div className="space-y-2 text-[12px]">
              <div className="flex items-start gap-8">
                <span className="text-[var(--ide-text-muted)] w-20 shrink-0">Status</span>
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full', isActive ? 'bg-green-500' : isInProgress ? 'bg-blue-500 animate-pulse' : displayStatus === 'failed' ? 'bg-red-500' : 'bg-gray-500')} />
                  <span className="text-[var(--ide-text)] font-medium capitalize">{displayStatus === 'live' ? 'Published' : displayStatus}</span>
                  {deployment?.createdAt && <span className="text-[var(--ide-text-muted)]">{new Date(deployment.createdAt).toLocaleDateString()}</span>}
                </div>
              </div>

              <div className="flex items-start gap-8">
                <span className="text-[var(--ide-text-muted)] w-20 shrink-0">Visibility</span>
                <div className="flex items-center gap-1">
                  <Globe className="w-3 h-3 text-[var(--ide-text-muted)]" />
                  <span className="text-[var(--ide-text)]">Public</span>
                </div>
              </div>

              {deployment?.url && (
                <div className="flex items-start gap-8">
                  <span className="text-[var(--ide-text-muted)] w-20 shrink-0">Domain</span>
                  <div className="flex items-center gap-2">
                    <a href={deployment.url} target="_blank" rel="noopener noreferrer" className="text-[#0079F2] hover:underline font-mono text-[11px]">{deployment.url}</a>
                    <Button variant="ghost" size="icon" className="w-5 h-5" onClick={() => copyToClipboard(deployment.url)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-8">
                <span className="text-[var(--ide-text-muted)] w-20 shrink-0">Geography</span>
                <span className="text-[var(--ide-text)]">North America</span>
              </div>

              <div className="flex items-start gap-8">
                <span className="text-[var(--ide-text-muted)] w-20 shrink-0">Type</span>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--ide-text)] capitalize">{deployment?.type || deployType}</span>
                  <button className="text-[#0079F2] text-[10px] hover:underline" onClick={() => setView('configure')}>Manage</button>
                </div>
              </div>

              <div className="flex items-start gap-8">
                <span className="text-[var(--ide-text-muted)] w-20 shrink-0">Database</span>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--ide-text)]">Production database connected</span>
                  <button className="text-[#0079F2] text-[10px] hover:underline">Manage</button>
                </div>
              </div>
            </div>
          </div>

          {isActive && deployment?.url && (
            <div className="px-4 py-3 border-t border-[var(--ide-border)]">
              <div className="flex items-center gap-4">
                <div className="bg-white p-2 rounded" data-testid="qr-code-container">
                  <QRCodeSVG value={deployment.url.startsWith('http') ? deployment.url : `https://${deployment.url}`} size={80} level="M" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-[var(--ide-text)] mb-1">Mobile Access</p>
                  <p className="text-[10px] text-[var(--ide-text-muted)]">Scan the QR code to open your deployed app on a mobile device.</p>
                </div>
              </div>
            </div>
          )}

          <Separator className="border-[var(--ide-border)]" />

          <div className="px-4 py-3 space-y-2">
            {(deploymentHistory?.deployments || []).slice(0, 10).map((dep: any) => {
              const depId = dep.deploymentId || dep.id;
              const depStatus = translateStatusToUI(dep.status);
              return (
                <div key={dep.id} className="flex items-center gap-2 py-1" data-testid={`history-${depId?.slice(0, 8)}`}>
                  <div className={cn('w-2 h-2 rounded-full', depStatus === 'live' ? 'bg-green-500' : depStatus === 'failed' ? 'bg-red-500' : 'bg-gray-500')} />
                  <span className="text-[11px] font-mono text-[#0079F2]">{depId?.slice(0, 8)}</span>
                  <span className="text-[11px] text-[var(--ide-text)]">{depStatus === 'live' ? 'published' : depStatus === 'failed' ? 'failed to publish' : depStatus}</span>
                  <span className="text-[10px] text-[var(--ide-text-muted)]">{dep.createdAt ? new Date(dep.createdAt).toLocaleDateString() : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {overviewTab === 'logs' && (
        <div className="flex-1 flex flex-col overflow-hidden p-3 gap-2">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Select value={logFilter} onValueChange={setLogFilter}>
                <SelectTrigger className="w-24 h-7 text-[10px]" data-testid="select-log-filter">
                  <Filter className="w-3 h-3 mr-1" /><SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-[9px]">{filteredLogs.length} entries</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setIsAutoScroll(!isAutoScroll)}><ArrowDown className="w-3 h-3" /></Button>
              <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setLogs([])}><Trash2 className="w-3 h-3" /></Button>
              {deploymentId && <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => fetchLogsViaHTTP(deploymentId)}><RefreshCw className="w-3 h-3" /></Button>}
            </div>
          </div>
          <ScrollArea className="flex-1 rounded border bg-black/95 font-mono text-[10px] text-zinc-300">
            <div className="p-2 space-y-0.5">
              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-zinc-500 gap-1">
                  <Terminal className="w-6 h-6 opacity-20" />
                  <p className="text-[10px]">No logs to display</p>
                </div>
              ) : filteredLogs.map((log, i) => (
                <div key={log.id || i} className={cn('flex items-start gap-1.5 p-1 rounded text-[10px]', log.level === 'error' ? 'text-red-400 bg-red-500/10' : log.level === 'warn' ? 'text-yellow-400 bg-yellow-500/10' : log.level === 'success' ? 'text-green-400 bg-green-500/10' : 'text-blue-400')}>
                  <span className="text-zinc-600 shrink-0 w-14">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <span className="break-all">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </ScrollArea>
        </div>
      )}

      {overviewTab === 'analytics' && (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-medium text-[var(--ide-text)]">Deployment Analytics</h3>
            <div className="flex gap-2">
              <Select value={timePeriod} onValueChange={setTimePeriod}>
                <SelectTrigger className="w-24 h-7 text-[10px]"><Clock className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="6h">6 hours</SelectItem>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => refetchAnalytics()}><RefreshCw className="w-3 h-3" /></Button>
            </div>
          </div>

          {isLoadingAnalytics ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}</div>
          ) : analyticsData?.analytics ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Requests', value: analyticsData.analytics.summary.totalRequests, icon: <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> },
                  { label: 'Error Rate', value: `${analyticsData.analytics.summary.errorRate?.toFixed(2)}%`, icon: <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> },
                  { label: 'Avg Response', value: `${Math.round(analyticsData.analytics.summary.avgResponseTime || 0)}ms`, icon: <Timer className="w-3.5 h-3.5 text-green-500" /> },
                  { label: 'Uptime', value: `${(analyticsData.analytics.summary.uptime || 0).toFixed(2)}%`, icon: <Activity className="w-3.5 h-3.5 text-purple-500" /> },
                ].map(metric => (
                  <div key={metric.label} className="p-3 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)]">
                    <div className="flex items-center justify-between">{metric.icon}<span className="text-[9px] text-[var(--ide-text-muted)]">{metric.label}</span></div>
                    <p className="text-[14px] font-bold text-[var(--ide-text)] mt-1">{metric.value}</p>
                  </div>
                ))}
              </div>
              {analyticsData.analytics.costs && (
                <div className="p-3 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)]">
                  <div className="flex items-center gap-2 mb-2"><DollarSign className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" /><span className="text-[11px] font-semibold text-[var(--ide-text)]">Cost Breakdown</span></div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between"><span className="text-[var(--ide-text-muted)]">Compute</span><span className="text-[var(--ide-text)]">${analyticsData.analytics.costs.compute?.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--ide-text-muted)]">Bandwidth</span><span className="text-[var(--ide-text)]">${analyticsData.analytics.costs.bandwidth?.toFixed(2)}</span></div>
                    <Separator className="border-[var(--ide-border)] my-1" />
                    <div className="flex justify-between font-bold"><span>Total</span><span>${analyticsData.analytics.costs.total?.toFixed(2)}</span></div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center py-8 text-[var(--ide-text-muted)]">
              <Activity className="w-6 h-6 mb-2 opacity-40" />
              <p className="text-[11px]">No analytics data available</p>
            </div>
          )}
        </div>
      )}

      {overviewTab === 'resources' && (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-medium text-[var(--ide-text)]">Resource Utilization</h3>
            <Select defaultValue="1h">
              <SelectTrigger className="w-32 h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Past one hour</SelectItem>
                <SelectItem value="6h">Past 6 hours</SelectItem>
                <SelectItem value="24h">Past 24 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)]">
              <h4 className="text-[12px] font-semibold text-[var(--ide-text)] mb-3">CPU Utilization</h4>
              <div className="h-32 flex items-end justify-around gap-1 border-b border-l border-[var(--ide-border)] p-2">
                {Array.from({ length: 20 }, (_, i) => (
                  <div key={i} className="flex-1 bg-[#0079F2]/60 rounded-t" style={{ height: `${Math.random() * 30 + 5}%` }} />
                ))}
              </div>
              <div className="flex justify-between mt-1 text-[9px] text-[var(--ide-text-muted)]">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)]">
              <h4 className="text-[12px] font-semibold text-[var(--ide-text)] mb-3">Memory Utilization</h4>
              <div className="h-32 flex items-end justify-around gap-1 border-b border-l border-[var(--ide-border)] p-2">
                {Array.from({ length: 20 }, (_, i) => (
                  <div key={i} className="flex-1 bg-[#0079F2]/60 rounded-t" style={{ height: `${Math.random() * 20 + 60}%` }} />
                ))}
              </div>
              <div className="flex justify-between mt-1 text-[9px] text-[var(--ide-text-muted)]">
                <span>0 MiB</span><span>512 MiB</span><span>1024 MiB</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {overviewTab === 'domains' && (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-[var(--ide-text)]">Domains</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1"><Plus className="w-3 h-3" /> Connect your own domain</Button>
            </div>
          </div>

          <div className="border border-[var(--ide-border)] rounded-lg overflow-hidden">
            <div className="grid grid-cols-3 gap-4 px-4 py-2 bg-[var(--ide-surface)] border-b border-[var(--ide-border)] text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase">
              <span>Name</span>
              <span>Registered With</span>
              <span></span>
            </div>

            {deployment?.url && (
              <div className="grid grid-cols-3 gap-4 px-4 py-3 border-b border-[var(--ide-border)] text-[11px]">
                <span className="text-[var(--ide-text)] font-mono">{new URL(deployment.url).hostname}</span>
                <span className="text-[var(--ide-text-muted)]">E-Code</span>
                <Button variant="outline" size="sm" className="h-6 text-[9px] w-fit gap-1"><Settings className="w-3 h-3" /> Manage</Button>
              </div>
            )}

            <div className="px-4 py-3 text-[11px]">
              <div className="flex items-center gap-2">
                <Input value={customDomain} onChange={e => setCustomDomain(e.target.value)} placeholder="yourdomain.com" className="h-8 text-[11px] flex-1 bg-[var(--ide-surface)] border-[var(--ide-border)]" data-testid="input-custom-domain" />
                <Button size="sm" className="h-8 text-[10px] bg-[#0079F2]" disabled={!customDomain} data-testid="button-add-domain">
                  Add Domain
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {overviewTab === 'manage' && (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <h3 className="text-[13px] font-bold text-[var(--ide-text)]">Manage published app</h3>

          <div className="space-y-3">
            <Button variant="outline" className="w-full h-10 text-[12px] gap-2 border-[var(--ide-border)] justify-center" onClick={() => { if (deploymentId) stopMutation.mutate(deploymentId); }} data-testid="button-pause">
              <Pause className="w-4 h-4" /> Pause
            </Button>
            <p className="text-[10px] text-[var(--ide-text-muted)]">Your billing will continue, but all users will lose access to your app</p>

            <Button variant="outline" className="w-full h-10 text-[12px] gap-2 border-[var(--ide-border)] justify-center" onClick={() => setView('type-select')} data-testid="button-change-type">
              <Settings className="w-4 h-4" /> Change deployment type
            </Button>
            <p className="text-[10px] text-[var(--ide-text-muted)]">To change your deployment type, you will need to unpublish and publish again.</p>

            <Button variant="outline" className="w-full h-10 text-[12px] gap-2 border-[var(--ide-border)] justify-center text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => { if (deploymentId) shutdownMutation.mutate(deploymentId); }} disabled={shutdownMutation.isPending} data-testid="button-shutdown">
              <Trash2 className="w-4 h-4" /> {shutdownMutation.isPending ? 'Shutting down...' : 'Shut down'}
            </Button>
            <p className="text-[10px] text-[var(--ide-text-muted)]">Your published app billing will be canceled, and it will cease to exist</p>
          </div>

          <Separator className="border-[var(--ide-border)]" />

          <div className="space-y-3">
            <h4 className="text-[12px] font-semibold text-[var(--ide-text)]">Display settings</h4>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[var(--ide-text)]">"Made with E-Code" badge</span>
                <p className="text-[9px] text-[var(--ide-text-muted)]">Display a "Made with E-Code" referral badge on your published app.</p>
              </div>
              <Switch defaultChecked={false} data-testid="switch-badge" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
