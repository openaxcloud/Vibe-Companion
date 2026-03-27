import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
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
  Settings,
  Zap,
  Shield,
  Copy,
  Play,
  Square,
  RotateCcw,
} from 'lucide-react';

interface DeploymentPanelProps {
  projectId: string;
  className?: string;
}

interface Deployment {
  id: string;
  projectId: string;
  status: 'pending' | 'building' | 'deploying' | 'deployed' | 'failed' | 'stopped';
  url?: string;
  domain?: string;
  customDomain?: string;
  environment: string;
  region: string;
  createdAt: string;
  updatedAt: string;
  buildLogs?: string[];
}

export function DeploymentPanel({ projectId, className }: DeploymentPanelProps) {
  const [deployType, setDeployType] = useState<'static' | 'autoscale' | 'reserved-vm'>('autoscale');
  const [customDomain, setCustomDomain] = useState('');
  const [environment, setEnvironment] = useState<'production' | 'staging' | 'development'>('production');
  const [region, setRegion] = useState('us-east-1');
  const [isDeploying, setIsDeploying] = useState(false);

  const { data: deployments, isLoading } = useQuery<Deployment[]>({
    queryKey: ['/api/projects', projectId, 'deployments'],
  });

  const { data: latestDeployment } = useQuery<Deployment>({
    queryKey: ['/api/projects', projectId, 'deployment', 'latest'],
    refetchInterval: isDeploying ? 2000 : false,
  });

  const deployMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/projects/${projectId}/deploy`, {
        type: deployType,
        environment,
        regions: [region],
        customDomain: customDomain || undefined,
        sslEnabled: true,
      });
    },
    onSuccess: () => {
      setIsDeploying(true);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      toast({ title: 'Deployment started', description: 'Your app is being deployed...' });
    },
    onError: (error: Error) => {
      toast({ title: 'Deployment failed', description: error.message, variant: 'destructive' });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async (deploymentId: string) => {
      return apiRequest('POST', `/api/deployments/${deploymentId}/stop`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      toast({ title: 'Deployment stopped' });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'deployed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'building': case 'deploying': return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'stopped': return <Square className="h-4 w-4 text-gray-500" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      deployed: 'bg-surface-solid text-green-500 border-border',
      building: 'bg-surface-solid text-blue-500 border-border',
      deploying: 'bg-surface-solid text-blue-500 border-border',
      failed: 'bg-surface-solid text-red-500 border-border',
      stopped: 'bg-surface-solid text-gray-500 border-border',
      pending: 'bg-surface-solid text-yellow-500 border-border',
    };
    return variants[status] || variants.pending;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <Card className={cn('h-full flex flex-col bg-[var(--ecode-surface)] border-[var(--ecode-border)]', className)}>
      <CardHeader className="h-9 flex-none flex items-center justify-between px-2.5 py-0 border-b border-[var(--ecode-border)]">
        <CardTitle className="text-xs font-medium text-[var(--ecode-text-muted)] flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5" />
          Deployments
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <Tabs defaultValue="deploy" className="h-full flex flex-col">
          <TabsList className="h-9 mx-2.5 flex overflow-x-auto bg-[var(--ecode-surface)] border-b border-[var(--ecode-border)] rounded-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <TabsTrigger value="deploy" className="flex-1 text-xs whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-[hsl(142,72%,42%)]" data-testid="tab-deploy">Deploy</TabsTrigger>
            <TabsTrigger value="history" className="flex-1 text-xs whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-[hsl(142,72%,42%)]" data-testid="tab-history">History</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 text-xs whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-[hsl(142,72%,42%)]" data-testid="tab-settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="deploy" className="flex-1 overflow-auto p-4 space-y-4">
            {latestDeployment && (
              <Card className="border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(latestDeployment.status)}
                      <span className="font-medium">Current Deployment</span>
                    </div>
                    <Badge className={getStatusBadge(latestDeployment.status)}>
                      {latestDeployment.status}
                    </Badge>
                  </div>

                  {latestDeployment.url && (
                    <div className="flex items-center gap-2 mb-3">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={latestDeployment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-primary hover:underline flex items-center gap-1"
                        data-testid="link-deployment-url"
                      >
                        {latestDeployment.url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(latestDeployment.url!)}
                        data-testid="button-copy-url"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {(latestDeployment.status === 'building' || latestDeployment.status === 'deploying') && (
                    <Progress value={latestDeployment.status === 'building' ? 40 : 80} className="h-2" />
                  )}

                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] })}
                      data-testid="button-refresh-deployment"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Refresh
                    </Button>
                    {latestDeployment.status === 'deployed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => stopMutation.mutate(latestDeployment.id)}
                        data-testid="button-stop-deployment"
                      >
                        <Square className="h-4 w-4 mr-1" />
                        Stop
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Deployment Type</Label>
                <Select value={deployType} onValueChange={(v) => setDeployType(v as typeof deployType)}>
                  <SelectTrigger data-testid="select-deploy-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="autoscale">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Autoscale (Recommended)
                      </div>
                    </SelectItem>
                    <SelectItem value="static">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Static
                      </div>
                    </SelectItem>
                    <SelectItem value="reserved-vm">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        Reserved VM
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Environment</Label>
                <Select value={environment} onValueChange={(v) => setEnvironment(v as typeof environment)}>
                  <SelectTrigger data-testid="select-environment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Region</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger data-testid="select-region">
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

              <div className="space-y-2">
                <Label>Custom Domain (Optional)</Label>
                <Input
                  placeholder="myapp.example.com"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  data-testid="input-custom-domain"
                />
              </div>

              <Button
                className="w-full"
                onClick={() => deployMutation.mutate(undefined)}
                disabled={deployMutation.isPending}
                data-testid="button-deploy"
              >
                {deployMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4 mr-2" />
                    Deploy Now
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="history" className="flex-1 overflow-hidden p-4">
            <ScrollArea className="h-full">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : deployments && deployments.length > 0 ? (
                <div className="space-y-3">
                  {deployments.map((deployment) => (
                    <Card key={deployment.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(deployment.status)}
                          <span className="text-[13px] font-medium">{deployment.environment}</span>
                        </div>
                        <Badge className={getStatusBadge(deployment.status)}>
                          {deployment.status}
                        </Badge>
                      </div>
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(deployment.createdAt).toLocaleString()}
                        </div>
                        {deployment.url && (
                          <a
                            href={deployment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 mt-1"
                          >
                            <Globe className="h-3 w-3" />
                            {deployment.url}
                          </a>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Rocket className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No deployments yet</p>
                  <p className="text-[11px] mt-1">Deploy your app to see history</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="settings" className="flex-1 overflow-auto p-4 space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-deploy on push</Label>
                  <p className="text-[11px] text-muted-foreground">Deploy automatically when you push to main</p>
                </div>
                <Switch data-testid="switch-auto-deploy" />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>SSL/HTTPS</Label>
                  <p className="text-[11px] text-muted-foreground">Enable secure connections</p>
                </div>
                <Switch defaultChecked data-testid="switch-ssl" />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Health Checks</Label>
                  <p className="text-[11px] text-muted-foreground">Monitor deployment health</p>
                </div>
                <Switch defaultChecked data-testid="switch-health-checks" />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Build Command</Label>
                <Input placeholder="npm run build" data-testid="input-build-command" />
              </div>

              <div className="space-y-2">
                <Label>Start Command</Label>
                <Input placeholder="npm start" data-testid="input-start-command" />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
