// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import {
  Globe, Server, Rocket, Clock, CheckCircle, XCircle, AlertCircle, ExternalLink,
  RefreshCw, Loader2, Copy, Pause, Play, Trash2, ArrowLeft, Shield, Link2,
  ChevronDown, ChevronRight, Search, Filter, BarChart3, Cpu, HardDrive,
  Cloud, Zap, Monitor, Timer, X, MoreHorizontal, Settings, Eye, EyeOff
} from 'lucide-react';

interface ReplitDeploymentPanelProps {
  projectId: string;
  className?: string;
  defaultTab?: string;
}

interface DeploymentRecord {
  id: string;
  projectId: string;
  userId: string;
  status: string;
  deploymentType: string;
  url: string;
  version: number;
  buildLog?: string;
  buildCommand?: string;
  runCommand?: string;
  machineConfig?: string;
  maxMachines?: number;
  isPrivate?: boolean;
  showBadge?: boolean;
  createdAt: string;
  finishedAt?: string;
  deployConfig?: any;
}

interface DomainRecord {
  id: string;
  domain: string;
  target: string;
  verified: boolean;
}

type DeployPhase = 'select_type' | 'configure' | 'published';
type DeployType = 'autoscale' | 'static' | 'reserved-vm' | 'scheduled';
type PostDeployTab = 'overview' | 'logs' | 'analytics' | 'resources' | 'domains' | 'manage';

const DEPLOY_TYPES: { id: DeployType; label: string; subtitle: string; icon: any; recommended?: boolean }[] = [
  { id: 'reserved-vm', label: 'Reserved VM', subtitle: 'Always On Servers', icon: Server },
  { id: 'autoscale', label: 'Autoscale', subtitle: 'Best choice for most apps', icon: Cloud, recommended: true },
  { id: 'static', label: 'Static pages', subtitle: 'Simple HTML websites', icon: Monitor },
  { id: 'scheduled', label: 'Scheduled', subtitle: 'Time-based job scheduler', icon: Clock },
];

const REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-central-1', label: 'EU Central (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
];

const MACHINE_CONFIGS = [
  { value: 'small', label: '0.5 vCPU / 512 MiB RAM', cpu: 0.5, ram: 512 },
  { value: 'medium', label: '1 vCPU / 1 GiB RAM', cpu: 1, ram: 1024 },
  { value: 'large', label: '2 vCPU / 2 GiB RAM', cpu: 2, ram: 2048 },
  { value: 'xlarge', label: '4 vCPU / 4 GiB RAM', cpu: 4, ram: 4096 },
];

export function ReplitDeploymentPanel({ projectId, className, defaultTab }: ReplitDeploymentPanelProps) {
  const [phase, setPhase] = useState<DeployPhase>('select_type');
  const [selectedType, setSelectedType] = useState<DeployType>('autoscale');
  const [activeTab, setActiveTab] = useState<PostDeployTab>('overview');
  const [configRegion, setConfigRegion] = useState('us-east-1');
  const [configEnv, setConfigEnv] = useState('production');
  const [configDomain, setConfigDomain] = useState('');
  const [configBuildCmd, setConfigBuildCmd] = useState('');
  const [configRunCmd, setConfigRunCmd] = useState('');
  const [configMachine, setConfigMachine] = useState('small');
  const [configMaxMachines, setConfigMaxMachines] = useState(1);
  const [configPublicDir, setConfigPublicDir] = useState('/');
  const [domainInput, setDomainInput] = useState('');
  const [domainVerifying, setDomainVerifying] = useState(false);
  const [domainDnsRecords, setDomainDnsRecords] = useState<any[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<DomainRecord | null>(null);
  const [logSearch, setLogSearch] = useState('');
  const [analyticsPeriod, setAnalyticsPeriod] = useState('1h');
  const [showDomainMenu, setShowDomainMenu] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const { data: latestDeploy, isLoading: loadingLatest, refetch: refetchLatest } = useQuery({
    queryKey: ['deployment-latest', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/deployment/latest`, { credentials: 'include' });
      if (!res.ok) return { status: 'not_deployed' };
      return res.json();
    },
    enabled: !!projectId,
    refetchInterval: 5000,
  });

  const { data: deployHistory } = useQuery({
    queryKey: ['deployment-history', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/deployments`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId && phase === 'published',
  });

  const { data: domains, refetch: refetchDomains } = useQuery({
    queryKey: ['deployment-domains', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/domains`, { credentials: 'include' });
      if (!res.ok) return { domains: [] };
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: analyticsData } = useQuery({
    queryKey: ['deployment-analytics', projectId, analyticsPeriod],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/deployments/analytics?period=${analyticsPeriod}`, { credentials: 'include' });
      if (!res.ok) return { cpuData: [], memoryData: [], totalRequests: 0, totalErrors: 0, avgCpu: 0, avgMemory: 0 };
      return res.json();
    },
    enabled: !!projectId && activeTab === 'analytics',
  });

  const { data: deployLogs } = useQuery({
    queryKey: ['deployment-logs', latestDeploy?.id],
    queryFn: async () => {
      const res = await fetch(`/api/deployments/${latestDeploy.id}/logs`, { credentials: 'include' });
      if (!res.ok) return { logs: [] };
      return res.json();
    },
    enabled: !!latestDeploy?.id && activeTab === 'logs',
    refetchInterval: latestDeploy?.status === 'building' ? 2000 : false,
  });

  useEffect(() => {
    if (latestDeploy && latestDeploy.status && latestDeploy.status !== 'not_deployed') {
      setPhase('published');
    }
  }, [latestDeploy]);

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          deploymentType: selectedType,
          environment: configEnv,
          region: configRegion,
          buildCommand: configBuildCmd || undefined,
          runCommand: configRunCmd || undefined,
          machineConfig: configMachine,
          maxMachines: configMaxMachines,
          publicDirectory: configPublicDir,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Publish failed');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Publishing started', description: 'Your app is being deployed...' });
      setPhase('published');
      refetchLatest();
    },
    onError: (err: Error) => {
      toast({ title: 'Publish failed', description: err.message, variant: 'destructive' });
    },
  });

  const republishMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/republish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({}),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Republishing...', description: 'Your app is being redeployed.' });
      refetchLatest();
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action }: { action: string }) => {
      const res = await fetch(`/api/deployments/${latestDeploy.id}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({}),
      });
      return res.json();
    },
    onSuccess: (_, vars) => {
      toast({ title: `Deployment ${vars.action}`, description: `Action completed successfully.` });
      refetchLatest();
    },
  });

  const handleVerifyDomain = async () => {
    if (!domainInput.trim()) return;
    setDomainVerifying(true);
    try {
      const addRes = await fetch(`/api/projects/${projectId}/domains`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ domain: domainInput.trim() }),
      });
      const addData = await addRes.json();
      if (addData.dnsRecords) {
        setDomainDnsRecords(addData.dnsRecords);
      }
      const verifyRes = await fetch(`/api/projects/${projectId}/domains/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ domain: domainInput.trim() }),
      });
      const verifyData = await verifyRes.json();
      if (verifyData.verified) {
        toast({ title: 'Domain verified', description: `${domainInput} has been connected.` });
      } else {
        toast({ title: 'Verification failed', description: verifyData.message || 'Please check your DNS settings', variant: 'destructive' });
      }
      refetchDomains();
    } catch {
      toast({ title: 'Error', description: 'Failed to verify domain', variant: 'destructive' });
    } finally {
      setDomainVerifying(false);
    }
  };

  const handleDeleteDomain = async (domainId: string) => {
    try {
      await fetch(`/api/projects/${projectId}/domains/${domainId}`, {
        method: 'DELETE', credentials: 'include',
      });
      refetchDomains();
      setSelectedDomain(null);
      toast({ title: 'Domain disconnected' });
    } catch {}
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Copied to clipboard' });
  };

  const isDeployed = latestDeploy?.status === 'deployed' || latestDeploy?.status === 'active';
  const isBuilding = latestDeploy?.status === 'building' || latestDeploy?.status === 'deploying';
  const isPaused = latestDeploy?.status === 'paused';
  const isStopped = latestDeploy?.status === 'stopped';
  const deployUrl = latestDeploy?.url;
  const replitAppDomain = deployUrl ? new URL(deployUrl).hostname : null;

  if (phase === 'select_type' || (phase !== 'published' && !latestDeploy?.id)) {
    return (
      <div className={cn("h-full flex flex-col bg-background", className)} data-testid="deploy-panel">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Globe className="h-4 w-4 text-green-500" />
          <span className="text-sm font-semibold" data-testid="deploy-header">Deploy</span>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            <div className="text-center space-y-3 py-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Rocket className="h-6 w-6 text-green-500" />
              </div>
              <h2 className="text-lg font-semibold" data-testid="deploy-title">Deploy to production</h2>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Publish a live, stable, public version of your App, unaffected by the changes you make in the workspace.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Deployment Type</p>
              <div className="grid grid-cols-2 gap-2">
                {DEPLOY_TYPES.map((dt) => (
                  <button
                    key={dt.id}
                    onClick={() => { setSelectedType(dt.id); setPhase('configure'); }}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all text-center",
                      selectedType === dt.id
                        ? "border-primary bg-primary/10 ring-2 ring-primary"
                        : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                    )}
                    data-testid={`deploy-type-${dt.id}`}
                  >
                    {dt.recommended && (
                      <Badge variant="secondary" className="absolute -top-2 text-[9px] px-1.5 py-0 bg-blue-500 text-white border-0">
                        Chosen by Agent
                      </Badge>
                    )}
                    <dt.icon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs font-medium">{dt.label}</span>
                    <span className="text-[10px] text-muted-foreground">{dt.subtitle}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedType === 'autoscale' && (
              <div className="space-y-3 bg-muted/30 rounded-lg p-3">
                <h3 className="text-sm font-semibold">Scale up and down to meet demand exactly</h3>
                <div className="space-y-2 text-[11px] text-muted-foreground">
                  <div className="flex gap-2">
                    <Zap className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-400" />
                    <p>Automatically scales from zero to any level of demand, making it inexpensive for most apps.</p>
                  </div>
                  <div className="flex gap-2">
                    <BarChart3 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-400" />
                    <p>Usage-based pricing. Billed at $0.0000032 per compute unit, plus a fixed cost of $1 per month.</p>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={() => setPhase('configure')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="btn-setup-deployment"
            >
              Set up your deployment
            </Button>
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (phase === 'configure') {
    return (
      <div className={cn("h-full flex flex-col bg-background", className)} data-testid="deploy-configure">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <button onClick={() => setPhase('select_type')} className="p-1 rounded hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Globe className="h-4 w-4 text-green-500" />
          <span className="text-sm font-semibold">Deploy</span>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Type</p>
                <p className="text-sm font-medium capitalize">{selectedType.replace('-', ' ')}</p>
              </div>
              <Badge variant="outline" className="text-[10px]">{selectedType === 'autoscale' ? 'Recommended' : selectedType}</Badge>
            </div>

            {(selectedType === 'autoscale' || selectedType === 'reserved-vm') && (
              <>
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Machine Configuration</label>
                  <Select value={configMachine} onValueChange={setConfigMachine}>
                    <SelectTrigger className="h-9 text-xs" data-testid="select-machine">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MACHINE_CONFIGS.map(mc => (
                        <SelectItem key={mc.value} value={mc.value} className="text-xs">{mc.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedType === 'autoscale' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Max number of machines</label>
                    <div className="flex items-center gap-3">
                      <Slider
                        value={[configMaxMachines]}
                        onValueChange={([v]) => setConfigMaxMachines(v)}
                        min={1} max={10} step={1}
                        className="flex-1"
                        data-testid="slider-max-machines"
                      />
                      <span className="text-xs font-medium w-6 text-right">{configMaxMachines}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{configMaxMachines} machines · {configMaxMachines * 88} compute units/s at max traffic</p>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Environment</label>
                <Select value={configEnv} onValueChange={setConfigEnv}>
                  <SelectTrigger className="h-9 text-xs" data-testid="select-env">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production" className="text-xs">Production</SelectItem>
                    <SelectItem value="staging" className="text-xs">Staging</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Region</label>
                <Select value={configRegion} onValueChange={setConfigRegion}>
                  <SelectTrigger className="h-9 text-xs" data-testid="select-region">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map(r => (
                      <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedType === 'static' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Public directory</label>
                <Input value={configPublicDir} onChange={e => setConfigPublicDir(e.target.value)} placeholder="/" className="h-9 text-xs" data-testid="input-public-dir" />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Build command <span className="text-muted-foreground/50 normal-case">optional</span></label>
              <Input value={configBuildCmd} onChange={e => setConfigBuildCmd(e.target.value)} placeholder="npm run build" className="h-9 text-xs" data-testid="input-build-cmd" />
            </div>

            {selectedType !== 'static' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Run command</label>
                <Input value={configRunCmd} onChange={e => setConfigRunCmd(e.target.value)} placeholder="npm start" className="h-9 text-xs" data-testid="input-run-cmd" />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Custom Domain <span className="text-muted-foreground/50 normal-case">(Optional)</span></label>
              <div className="flex gap-2">
                <Input value={configDomain} onChange={e => setConfigDomain(e.target.value)} placeholder="yourdomain.com" className="h-9 text-xs flex-1" data-testid="input-custom-domain" />
                {configDomain && (
                  <Button variant="outline" size="sm" className="h-9 text-xs" onClick={handleVerifyDomain} disabled={domainVerifying} data-testid="btn-verify-domain">
                    {domainVerifying ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Verify'}
                  </Button>
                )}
              </div>
              {domainDnsRecords.length > 0 && (
                <div className="mt-2 bg-muted/30 rounded-lg p-3 space-y-2">
                  <p className="text-[11px] font-medium">DNS Records</p>
                  <p className="text-[10px] text-muted-foreground">Add the following records to your domain's DNS settings</p>
                  <div className="space-y-1">
                    <div className="grid grid-cols-3 gap-2 text-[10px] font-medium text-muted-foreground border-b border-border pb-1">
                      <span>Type</span><span>Hostname</span><span>Record</span>
                    </div>
                    {domainDnsRecords.map((rec: any, i: number) => (
                      <div key={i} className="grid grid-cols-3 gap-2 text-[11px] items-center">
                        <span className="font-medium">{rec.type}</span>
                        <div className="flex items-center gap-1">
                          <span>{rec.hostname}</span>
                          <button onClick={() => copyToClipboard(rec.hostname)} className="p-0.5 hover:bg-muted rounded"><Copy className="h-2.5 w-2.5" /></button>
                        </div>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="truncate">{rec.record}</span>
                          <button onClick={() => copyToClipboard(rec.record)} className="p-0.5 hover:bg-muted rounded shrink-0"><Copy className="h-2.5 w-2.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10"
              data-testid="btn-publish"
            >
              {publishMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Publishing...</>
              ) : (
                <><Rocket className="h-4 w-4 mr-2" /> Publish App</>
              )}
            </Button>
          </div>
        </ScrollArea>
      </div>
    );
  }

  const POST_DEPLOY_TABS: { id: PostDeployTab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: Globe },
    { id: 'logs', label: 'Logs', icon: Filter },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'resources', label: 'Resources', icon: Cpu },
    { id: 'domains', label: 'Domains', icon: Link2 },
    { id: 'manage', label: 'Manage', icon: Settings },
  ];

  return (
    <div className={cn("h-full flex flex-col bg-background", className)} data-testid="deploy-published">
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <Globe className="h-4 w-4 text-green-500" />
        <span className="text-sm font-semibold">Publishing</span>
      </div>

      <div className="border-b border-border overflow-x-auto">
        <div className="flex">
          {POST_DEPLOY_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium whitespace-nowrap border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className="h-3 w-3" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => republishMutation.mutate()}
                disabled={republishMutation.isPending || isBuilding}
                size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs h-8"
                data-testid="btn-republish"
              >
                {republishMutation.isPending || isBuilding ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Republishing...</>
                ) : (
                  <><Globe className="h-3 w-3 mr-1" /> Republish</>
                )}
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setPhase('configure')} data-testid="btn-adjust-settings">
                <Settings className="h-3 w-3 mr-1" /> Adjust settings
              </Button>
            </div>

            <div className="bg-muted/20 rounded-lg p-3 border border-border/50 space-y-3">
              <h3 className="text-xs font-semibold">Production</h3>

              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</p>
                <div className="flex items-center gap-2">
                  {isDeployed && <div className="w-2 h-2 rounded-full bg-green-500" />}
                  {isBuilding && <Loader2 className="h-3 w-3 animate-spin text-amber-500" />}
                  {isPaused && <Pause className="h-3 w-3 text-amber-500" />}
                  {isStopped && <XCircle className="h-3 w-3 text-red-500" />}
                  <span className="text-xs font-medium">
                    {isDeployed ? 'Live' : isBuilding ? 'Building...' : isPaused ? 'Paused' : isStopped ? 'Stopped' : latestDeploy?.status}
                  </span>
                  {latestDeploy?.createdAt && (
                    <span className="text-[10px] text-muted-foreground">
                      · {new Date(latestDeploy.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Domain</p>
                {deployUrl && (
                  <div className="flex items-center gap-2">
                    <a href={deployUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate" data-testid="link-deploy-url">
                      {deployUrl}
                    </a>
                    <button onClick={() => copyToClipboard(deployUrl)} className="p-1 hover:bg-muted rounded" data-testid="btn-copy-url">
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <a href={deployUrl} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-muted rounded">
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  </div>
                )}
                {domains?.domains?.filter((d: DomainRecord) => d.verified).map((d: DomainRecord) => (
                  <div key={d.id} className="flex items-center gap-2">
                    <a href={`https://${d.domain}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                      https://{d.domain}
                    </a>
                    <button onClick={() => copyToClipboard(`https://${d.domain}`)} className="p-1 hover:bg-muted rounded">
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Type</p>
                <p className="text-xs font-medium capitalize">
                  {latestDeploy?.deploymentType?.replace('-', ' ') || 'Autoscale'}
                  {latestDeploy?.machineConfig && (
                    <span className="text-muted-foreground ml-1">({latestDeploy.machineConfig})</span>
                  )}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Database</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium">Production database connected</p>
                  <button className="text-xs text-blue-500 hover:underline" onClick={() => setActiveTab('manage')}>Manage</button>
                </div>
                <div className="bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] rounded-md p-2 flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 shrink-0" />
                  Your production database is ready! Your app can now save and manage live user data securely.
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> History
                </h3>
                <button className="text-[10px] text-blue-500 hover:underline" data-testid="btn-show-all-history">Show All</button>
              </div>
              {(deployHistory || []).slice(0, 5).map((d: any) => (
                <div key={d.id} className="flex items-center gap-3 py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-[10px] font-mono text-muted-foreground w-16 shrink-0">{d.id?.slice(0, 7)}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px]">
                      Published {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <Badge variant={d.status === 'deployed' ? 'default' : 'secondary'} className="text-[9px] h-4">
                    {d.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 p-3 border-b border-border">
              <div className="flex-1 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  value={logSearch}
                  onChange={e => setLogSearch(e.target.value)}
                  placeholder="Search logs..."
                  className="h-8 text-xs pl-8"
                  data-testid="input-log-search"
                />
              </div>
            </div>
            <div className="flex-1 bg-[#0d1117] dark:bg-[#0d1117] text-[#c9d1d9] font-mono text-[11px] p-3 overflow-auto">
              {(!deployLogs?.logs || deployLogs.logs.length === 0) ? (
                <div className="text-center text-muted-foreground py-8">
                  {isBuilding ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Building...</span>
                    </div>
                  ) : 'No logs available'}
                </div>
              ) : (
                deployLogs.logs
                  .filter((log: any) => !logSearch || log.message?.toLowerCase().includes(logSearch.toLowerCase()))
                  .map((log: any, i: number) => (
                    <div key={log.id || i} className={cn(
                      "flex gap-3 py-0.5 hover:bg-white/5",
                      log.level === 'error' && "bg-red-500/10 text-red-400",
                      log.level === 'warn' && "bg-yellow-500/10 text-yellow-400",
                    )}>
                      <span className="text-[10px] text-muted-foreground shrink-0 w-32">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                      </span>
                      <span className="flex-1 break-all">{log.message}</span>
                    </div>
                  ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Select value={analyticsPeriod} onValueChange={setAnalyticsPeriod}>
                <SelectTrigger className="h-8 w-40 text-xs" data-testid="select-analytics-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h" className="text-xs">Past one hour</SelectItem>
                  <SelectItem value="6h" className="text-xs">Past six hours</SelectItem>
                  <SelectItem value="24h" className="text-xs">Past one day</SelectItem>
                  <SelectItem value="3d" className="text-xs">Past three days</SelectItem>
                  <SelectItem value="7d" className="text-xs">Past one week</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold">CPU Utilization</h3>
                <div className="h-32 bg-muted/20 rounded-lg border border-border/50 flex items-center justify-center relative overflow-hidden">
                  {analyticsData?.cpuData?.length > 0 ? (
                    <div className="w-full h-full p-2">
                      <div className="w-full h-full flex items-end gap-px">
                        {analyticsData.cpuData.slice(-30).map((d: any, i: number) => (
                          <div key={i} className="flex-1 bg-blue-400/50 rounded-t-sm" style={{ height: `${Math.max(d.value, 1)}%` }} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Cpu className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                      <p className="text-[10px] text-muted-foreground">No CPU data for this period</p>
                      <p className="text-lg font-semibold">{(analyticsData?.avgCpu || 0).toFixed(1)}%</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold">Memory Utilization</h3>
                <div className="h-32 bg-muted/20 rounded-lg border border-border/50 flex items-center justify-center relative overflow-hidden">
                  {analyticsData?.memoryData?.length > 0 ? (
                    <div className="w-full h-full p-2">
                      <div className="w-full h-full flex items-end gap-px">
                        {analyticsData.memoryData.slice(-30).map((d: any, i: number) => (
                          <div key={i} className="flex-1 bg-blue-400/50 rounded-t-sm" style={{ height: `${Math.max(d.value, 1)}%` }} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <HardDrive className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                      <p className="text-[10px] text-muted-foreground">No memory data for this period</p>
                      <p className="text-lg font-semibold">{(analyticsData?.avgMemory || 0).toFixed(0)} MiB</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="p-4 space-y-4">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold">Machine Configuration</h3>
              <div className="bg-muted/20 rounded-lg p-3 border border-border/50 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium capitalize">{latestDeploy?.deploymentType?.replace('-', ' ') || 'Autoscale'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Machine</span>
                  <span className="font-medium">{latestDeploy?.machineConfig || 'Small'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Max Machines</span>
                  <span className="font-medium">{latestDeploy?.maxMachines || 1}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Region</span>
                  <span className="font-medium">{latestDeploy?.deployConfig?.region || 'us-east-1'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold">Database</h3>
              <div className="bg-muted/20 rounded-lg p-3 border border-border/50 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Status</span>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="font-medium text-green-500">Connected</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">PostgreSQL</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'domains' && (
          <div className="p-4 space-y-4">
            {selectedDomain ? (
              <div className="space-y-4">
                <button onClick={() => setSelectedDomain(null)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold">{selectedDomain.domain}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        {selectedDomain.verified ? (
                          <><div className="w-1.5 h-1.5 rounded-full bg-green-500" /><span className="text-[10px] text-green-500">Verified</span></>
                        ) : (
                          <><XCircle className="h-3 w-3 text-red-500" /><span className="text-[10px] text-red-500">Not verified</span></>
                        )}
                      </div>
                    </div>
                    <div className="relative">
                      <button onClick={() => setShowDomainMenu(showDomainMenu === selectedDomain.id ? null : selectedDomain.id)} className="p-1.5 hover:bg-muted rounded">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {showDomainMenu === selectedDomain.id && (
                        <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg z-10 py-1 min-w-[180px]">
                          <button
                            onClick={() => { handleDeleteDomain(selectedDomain.id); setShowDomainMenu(null); }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-500 hover:bg-muted"
                          >
                            <Link2 className="h-3 w-3" /> Disconnect this domain
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-muted/20 rounded-lg p-3 border border-border/50 space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold">DNS Records</h4>
                    <p className="text-[10px] text-muted-foreground">Add the following records to your domain's DNS settings</p>
                  </div>
                  <div className="space-y-1">
                    <div className="grid grid-cols-3 gap-2 text-[10px] font-medium text-muted-foreground border-b border-border pb-1">
                      <span>Type</span><span>Hostname</span><span>Record</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] items-center py-1">
                      <span className="font-medium">A</span>
                      <div className="flex items-center gap-1">
                        <span>@</span>
                        <button onClick={() => copyToClipboard('@')} className="p-0.5 hover:bg-muted rounded"><Copy className="h-2.5 w-2.5" /></button>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>76.76.21.21</span>
                        <button onClick={() => copyToClipboard('76.76.21.21')} className="p-0.5 hover:bg-muted rounded"><Copy className="h-2.5 w-2.5" /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] items-center py-1">
                      <span className="font-medium">TXT</span>
                      <div className="flex items-center gap-1">
                        <span>@</span>
                        <button onClick={() => copyToClipboard('@')} className="p-0.5 hover:bg-muted rounded"><Copy className="h-2.5 w-2.5" /></button>
                      </div>
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="truncate">ecode-verify={selectedDomain.id.slice(0, 12)}</span>
                        <button onClick={() => copyToClipboard(`ecode-verify=${selectedDomain.id.slice(0, 12)}`)} className="p-0.5 hover:bg-muted rounded shrink-0"><Copy className="h-2.5 w-2.5" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Domains</h3>
                  <div className="ml-auto flex gap-2">
                    <Button variant="outline" size="sm" className="text-[11px] h-7" data-testid="btn-connect-domain"
                      onClick={() => {
                        const newDomain = prompt('Enter your domain (e.g., example.com):');
                        if (newDomain) { setDomainInput(newDomain); handleVerifyDomain(); }
                      }}>
                      Connect your own domain
                    </Button>
                  </div>
                </div>

                <div className="bg-muted/20 rounded-lg border border-border/50">
                  <div className="px-3 py-2 border-b border-border/50">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Name</span>
                  </div>
                  {replitAppDomain && (
                    <div className="flex items-center justify-between px-3 py-3 border-b border-border/30">
                      <span className="text-xs">{replitAppDomain}</span>
                      <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => setSelectedDomain({ id: 'replit-app', domain: replitAppDomain, target: '', verified: true })}>
                        <Settings className="h-2.5 w-2.5 mr-1" /> Manage
                      </Button>
                    </div>
                  )}
                  {(domains?.domains || []).map((d: DomainRecord) => (
                    <div key={d.id} className="flex items-center justify-between px-3 py-3 border-b border-border/30 last:border-0">
                      <div>
                        <span className="text-xs">{d.domain}</span>
                        {d.verified && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            <span className="text-[10px] text-green-500">Verified</span>
                          </div>
                        )}
                      </div>
                      <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => setSelectedDomain(d)}>
                        <Settings className="h-2.5 w-2.5 mr-1" /> Manage
                      </Button>
                    </div>
                  ))}
                  {(!domains?.domains || domains.domains.length === 0) && !replitAppDomain && (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No domains connected yet
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="p-4 space-y-4">
            <h3 className="text-sm font-semibold">Manage published app</h3>

            <Button
              variant="outline"
              className="w-full justify-center h-10 text-xs"
              onClick={() => actionMutation.mutate({ action: isPaused ? 'resume' : 'pause' })}
              disabled={actionMutation.isPending}
              data-testid="btn-pause"
            >
              {isPaused ? <><Play className="h-3.5 w-3.5 mr-2" /> Resume</> : <><Pause className="h-3.5 w-3.5 mr-2" /> Pause</>}
            </Button>
            <p className="text-[10px] text-muted-foreground">
              {isPaused ? 'Resume your app to make it accessible again.' : 'Your billing will continue, but all users will lose access to your app'}
            </p>

            <Button
              variant="outline"
              className="w-full justify-center h-10 text-xs"
              onClick={() => setPhase('configure')}
              data-testid="btn-change-type"
            >
              <Settings className="h-3.5 w-3.5 mr-2" /> Change deployment type
            </Button>
            <p className="text-[10px] text-muted-foreground">
              To change your deployment type, you will need to unpublish and publish again.
            </p>

            <Button
              variant="destructive"
              className="w-full justify-center h-10 text-xs"
              onClick={() => {
                if (confirm('Are you sure? Your published app billing will be canceled, and it will cease to exist.')) {
                  actionMutation.mutate({ action: 'shutdown' });
                }
              }}
              disabled={actionMutation.isPending}
              data-testid="btn-shutdown"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Shut down
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Your published app billing will be canceled, and it will cease to exist
            </p>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Display settings</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">"Made with E-Code" badge</p>
                  <p className="text-[10px] text-muted-foreground">Display a referral badge on your published app</p>
                </div>
                <Switch
                  checked={latestDeploy?.showBadge ?? false}
                  onCheckedChange={async (checked) => {
                    try {
                      await fetch(`/api/deployments/${latestDeploy.id}/settings`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                        credentials: 'include', body: JSON.stringify({ showBadge: checked }),
                      });
                      refetchLatest();
                    } catch {}
                  }}
                  data-testid="switch-badge"
                />
              </div>
            </div>
          </div>
        )}
      </ScrollArea>

      {(isBuilding || publishMutation.isPending || republishMutation.isPending) && (
        <div className="border-t border-border bg-amber-500/10 px-3 py-2 flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
          <span className="text-[11px] text-amber-600 dark:text-amber-400">Publishing started — Your app is being deployed...</span>
          <button className="ml-auto p-0.5 hover:bg-muted rounded">
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}

      <div className="border-t border-border px-3 py-2 flex items-center gap-2 text-[10px] text-muted-foreground">
        <Shield className="h-3 w-3" />
        <span>SYSTEM READY</span>
      </div>
    </div>
  );
}

export default ReplitDeploymentPanel;
