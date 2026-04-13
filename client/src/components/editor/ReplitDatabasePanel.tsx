// @ts-nocheck
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { LazyMotionDiv } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Database,
  Table,
  Play,
  RefreshCw,
  Download,
  ChevronRight,
  ChevronDown,
  Circle,
  CheckCircle,
  AlertCircle,
  Search,
  Copy,
  Settings,
  Plus,
  Loader2,
  Eye,
  EyeOff,
  Key,
  Server,
  HardDrive
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface DatabaseInfo {
  provisioned: boolean;
  database?: {
    id: number;
    name: string;
    type: string;
    status: string;
    region: string;
    host: string;
    port: number;
    databaseName: string;
    username: string;
    plan: string;
    storageUsedMb: number;
    storageLimitMb: number;
    connectionCount: number;
    maxConnections: number;
  };
}

interface DatabaseCredentials {
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password: string;
  connectionUrl: string;
  sslEnabled: boolean;
}

function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-muted", className)}>
      <LazyMotionDiv
        className="absolute inset-0 -translate-x-full"
        style={{
          background: 'linear-gradient(90deg, transparent, hsl(var(--accent)), transparent)',
        }}
        animate={{ translateX: ['−100%', '100%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-3 space-y-3">
      <ShimmerSkeleton className="h-8 w-full" />
      <ShimmerSkeleton className="h-6 w-3/4" />
      <ShimmerSkeleton className="h-6 w-1/2" />
      <ShimmerSkeleton className="h-6 w-2/3" />
    </div>
  );
}

export function ReplitDatabasePanel({ projectId }: { projectId?: string }) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'starter' | 'pro' | 'enterprise'>('free');
  const [activeTab, setActiveTab] = useState<'status' | 'credentials' | 'query'>('status');

  // Fetch database status
  const { data: databaseInfo, isLoading: databaseLoading, refetch: refetchDatabase } = useQuery<DatabaseInfo>({
    queryKey: ['/api/database/project', projectId],
    queryFn: async () => {
      if (!projectId) return { provisioned: false };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(`/api/database/project/${projectId}`, { credentials: 'include', signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return { provisioned: false };
        return await res.json();
      } catch {
        clearTimeout(timeout);
        return { provisioned: false };
      }
    },
    retry: 1,
    enabled: !!projectId,
    staleTime: 30000,
  });

  // Fetch credentials when provisioned
  const { data: credentials, isLoading: credentialsLoading, refetch: refetchCredentials } = useQuery<{ credentials: DatabaseCredentials }>({
    queryKey: ['/api/database/project', projectId, 'credentials'],
    queryFn: async () => {
      return apiRequest<{ credentials: DatabaseCredentials }>('GET', `/api/database/project/${projectId}/credentials`);
    },
    enabled: !!projectId && databaseInfo?.provisioned === true,
    staleTime: 60000,
  });

  // Provision mutation
  const provisionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/database/project/${projectId}/provision`, {
        plan: selectedPlan,
        type: 'postgresql',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/database/project', projectId] });
      toast({
        title: 'Database Provisioned',
        description: 'Your PostgreSQL database is ready to use.',
      });
      setActiveTab('credentials');
    },
    onError: (error: any) => {
      toast({
        title: 'Provisioning Failed',
        description: error.message || 'Failed to provision database',
        variant: 'destructive',
      });
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: `${label} copied to clipboard` });
  };

  const handleRefresh = () => {
    refetchDatabase();
    if (databaseInfo?.provisioned) {
      refetchCredentials();
    }
  };

  // No project ID - show message
  if (!projectId) {
    return (
      <div className="h-full flex flex-col bg-[var(--ecode-surface)]" data-testid="database-panel">
        <div className="h-9 px-2.5 flex items-center border-b border-[var(--ecode-border)] shrink-0">
          <Database className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)] ml-1.5">Database</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <Database className="w-8 h-8 text-[var(--ecode-text-muted)] opacity-40 mb-3" />
          <p className="text-xs text-[var(--ecode-text-muted)] text-center">
            Open a project to manage its database
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (databaseLoading) {
    return (
      <div className="h-full flex flex-col bg-[var(--ecode-surface)]" data-testid="database-panel">
        <div className="h-9 px-2.5 flex items-center border-b border-[var(--ecode-border)] shrink-0">
          <Database className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)] ml-1.5">Database</span>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  // Not provisioned - show provisioning UI
  if (!databaseInfo?.provisioned) {
    return (
      <div className="h-full flex flex-col bg-[var(--ecode-surface)]" data-testid="database-panel">
        <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
            <span className="text-xs font-medium text-[var(--ecode-text)]">Database</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]" onClick={handleRefresh}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <Database className="w-8 h-8 text-[var(--ecode-text-muted)] opacity-40 mb-3" />
          <p className="text-xs font-medium text-[var(--ecode-text)] mb-1">No Database</p>
          <p className="text-[10px] text-[var(--ecode-text-muted)] text-center mb-4 max-w-[240px]">
            Provision a PostgreSQL database for this project
          </p>

          <div className="w-full max-w-[240px] space-y-3">
            <div>
              <label className="text-[9px] uppercase tracking-wider text-[var(--ecode-text-muted)] font-medium mb-1.5 block">
                Plan
              </label>
              <Select value={selectedPlan} onValueChange={(v: any) => setSelectedPlan(v)}>
                <SelectTrigger className="h-8 text-xs bg-[var(--ecode-sidebar-hover)] border-[var(--ecode-border)]" data-testid="plan-selector">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free (500MB)</SelectItem>
                  <SelectItem value="starter">Starter (2GB)</SelectItem>
                  <SelectItem value="pro">Pro (10GB)</SelectItem>
                  <SelectItem value="enterprise">Enterprise (100GB)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => provisionMutation.mutate()}
              disabled={provisionMutation.isPending}
              className="w-full h-7 text-xs bg-[hsl(142,72%,42%)] hover:bg-[hsl(142,72%,38%)] text-white"
              data-testid="provision-database-button"
            >
              {provisionMutation.isPending ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  Provisioning...
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3 mr-1.5" />
                  Provision
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Provisioned - show database info and credentials
  const db = databaseInfo.database!;
  const creds = credentials?.credentials;
  const storagePercent = db.storageLimitMb > 0 ? (db.storageUsedMb / db.storageLimitMb) * 100 : 0;
  const connectionPercent = db.maxConnections > 0 ? (db.connectionCount / db.maxConnections) * 100 : 0;

  return (
    <div className="h-full flex flex-col bg-[var(--ecode-surface)]" data-testid="database-panel">
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">Database</span>
          <Badge className={cn(
            "h-4 px-1 text-[9px] rounded",
            db.status === 'running' ? 'bg-[hsl(142,72%,42%)]/10 text-[hsl(142,72%,42%)]' : 'bg-yellow-500/10 text-yellow-500'
          )}>
            {db.status}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]" onClick={handleRefresh}>
          <RefreshCw className={cn("w-3.5 h-3.5", databaseLoading && "animate-spin")} />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 flex flex-col">
        <TabsList className="h-9 w-full justify-start rounded-none border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)] p-0 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <TabsTrigger value="status" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(142,72%,42%)] px-2.5 text-xs whitespace-nowrap" data-testid="tab-status">
            Status
          </TabsTrigger>
          <TabsTrigger value="credentials" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(142,72%,42%)] px-2.5 text-xs whitespace-nowrap" data-testid="tab-credentials">
            Credentials
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="status" className="p-4 space-y-4 mt-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Type</span>
                <p className="text-[15px] text-foreground flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  PostgreSQL
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Plan</span>
                <p className="text-[15px] text-foreground capitalize">{db.plan}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Region</span>
                <p className="text-[15px] text-foreground">{db.region}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Database</span>
                <p className="text-[15px] text-foreground font-mono text-[13px]">{db.databaseName}</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <HardDrive className="w-4 h-4" />
                    Storage
                  </span>
                  <span className="text-foreground">{db.storageUsedMb}MB / {db.storageLimitMb}MB</span>
                </div>
                <Progress value={storagePercent} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Server className="w-4 h-4" />
                    Connections
                  </span>
                  <span className="text-foreground">{db.connectionCount} / {db.maxConnections}</span>
                </div>
                <Progress value={connectionPercent} className="h-2" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="credentials" className="p-4 space-y-4 mt-0">
            {credentialsLoading ? (
              <LoadingSkeleton />
            ) : creds ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Connection URL</label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={showPassword ? creds.connectionUrl : creds.connectionUrl.replace(/:([^:@]+)@/, ':••••••••@')}
                      className="font-mono text-[12px] bg-muted border-border"
                      data-testid="connection-url"
                    />
                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => copyToClipboard(creds.connectionUrl, 'Connection URL')}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Host</label>
                    <div className="flex gap-2">
                      <Input readOnly value={creds.host} className="font-mono text-[12px] bg-muted border-border" />
                      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => copyToClipboard(creds.host, 'Host')}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Port</label>
                    <Input readOnly value={creds.port.toString()} className="font-mono text-[12px] bg-muted border-border" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Database</label>
                    <div className="flex gap-2">
                      <Input readOnly value={creds.databaseName} className="font-mono text-[12px] bg-muted border-border" />
                      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => copyToClipboard(creds.databaseName, 'Database')}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Username</label>
                    <div className="flex gap-2">
                      <Input readOnly value={creds.username} className="font-mono text-[12px] bg-muted border-border" />
                      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => copyToClipboard(creds.username, 'Username')}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Password</label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      type={showPassword ? 'text' : 'password'}
                      value={creds.password}
                      className="font-mono text-[12px] bg-muted border-border"
                      data-testid="password-field"
                    />
                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => copyToClipboard(creds.password, 'Password')}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[13px] text-muted-foreground pt-2">
                  <Key className="w-4 h-4" />
                  <span>SSL: {creds.sslEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-[13px]">Unable to load credentials</p>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
