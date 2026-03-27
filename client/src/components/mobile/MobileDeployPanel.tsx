import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import {
  Rocket,
  Globe,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileDeployPanelProps {
  projectId: string;
  className?: string;
}

type PublishStatus = 'idle' | 'publishing' | 'live' | 'failed' | 'needs-republish';

interface Deployment {
  id: string;
  deploymentId?: string;
  projectId: string;
  status: string;
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

interface DeploymentResponse {
  success: boolean;
  deployment: Deployment;
}

function translateStatusToUI(internalStatus: string, lastCodeChange?: string, deployedAt?: string): PublishStatus {
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

export function MobileDeployPanel({ projectId, className }: MobileDeployPanelProps) {
  const [copied, setCopied] = useState(false);

  const { data: deploymentData, isLoading } = useQuery<DeploymentResponse>({
    queryKey: ['/api/projects', projectId, 'deployments'],
    queryFn: async () => {
      const response = await apiRequest<{ deployments: Deployment[] }>('GET', `/api/projects/${projectId}/deployments`);
      // Get the latest deployment
      const latestDeployment = response.deployments?.[0];
      return latestDeployment ? { success: true, deployment: latestDeployment } : { success: false, deployment: {} as Deployment };
    },
    refetchInterval: (query) => {
      const status = query.state.data?.deployment?.status;
      return status === 'pending' || status === 'building' || status === 'deploying' ? 2000 : false;
    },
    enabled: !!projectId,
  });

  const deployment = deploymentData?.deployment;
  const publishState: PublishState = deployment ? {
    status: translateStatusToUI(deployment.status, deployment.lastCodeChange, deployment.deployedAt),
    url: deployment.url || deployment.domain || deployment.customDomain,
    deployedAt: deployment.deployedAt,
    lastCodeChange: deployment.lastCodeChange,
  } : { status: 'idle' };

  const publishMutation = useMutation<DeploymentResponse, Error, void>({
    mutationFn: async () => {
      return apiRequest<DeploymentResponse>('POST', `/api/projects/${projectId}/publish`);
    },
    onMutate: () => {
      queryClient.setQueryData<DeploymentResponse>(
        ['/api/projects', projectId, 'deployments'],
        (old) => old ? { ...old, deployment: { ...old.deployment, status: 'deploying' } } : undefined
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'deployments'] });
      toast({
        title: 'Published successfully!',
        description: data?.deployment?.url ? `Your app is live at ${data.deployment.url}` : 'Your app is now live.',
      });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'deployments'] });
      toast({
        title: 'Publish failed',
        description: error.message || 'Something went wrong while publishing.',
        variant: 'destructive',
      });
    },
  });

  const republishMutation = useMutation<DeploymentResponse, Error, void>({
    mutationFn: async () => {
      return apiRequest<DeploymentResponse>('POST', `/api/projects/${projectId}/publish`);
    },
    onMutate: () => {
      queryClient.setQueryData<DeploymentResponse>(
        ['/api/projects', projectId, 'deployments'],
        (old) => old ? { ...old, deployment: { ...old.deployment, status: 'deploying' } } : undefined
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'deployments'] });
      toast({
        title: 'Republished successfully!',
        description: data?.deployment?.url ? `Your app is live at ${data.deployment.url}` : 'Your app has been updated.',
      });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'deployments'] });
      toast({
        title: 'Republish failed',
        description: error.message || 'Something went wrong while republishing.',
        variant: 'destructive',
      });
    },
  });

  const handleCopyUrl = async () => {
    if (publishState?.url) {
      await navigator.clipboard.writeText(publishState.url);
      setCopied(true);
      toast({ title: 'URL copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isPublishing = publishMutation.isPending || republishMutation.isPending || publishState?.status === 'publishing';
  const isLive = publishState?.status === 'live';
  const needsRepublish = publishState?.status === 'needs-republish';
  const isFailed = publishState?.status === 'failed';

  if (isLoading) {
    return (
      <div className={cn("p-4 space-y-4", className)}>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className={cn("p-4 space-y-4 h-full overflow-auto", className)} data-testid="mobile-deploy-panel">
      <Card className="bg-[var(--ecode-surface)] border-[var(--ecode-border)]">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-[var(--ecode-accent)]" />
              <h2 className="text-[15px] font-semibold text-[var(--ecode-text)]">Deploy</h2>
            </div>
            <Badge 
              variant={isLive ? "default" : isFailed ? "destructive" : "secondary"}
              className={cn(
                "text-[11px] font-medium",
                isLive && "bg-green-500/20 text-green-400 border-green-500/30",
                needsRepublish && "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
              )}
            >
              {isPublishing ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Publishing</>
              ) : isLive ? (
                <><CheckCircle className="h-3 w-3 mr-1" /> Live</>
              ) : needsRepublish ? (
                <><AlertCircle className="h-3 w-3 mr-1" /> Needs Update</>
              ) : isFailed ? (
                <><XCircle className="h-3 w-3 mr-1" /> Failed</>
              ) : (
                'Not Published'
              )}
            </Badge>
          </div>

          {isLive && publishState?.url && (
            <div className="bg-[var(--ecode-background)] rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-[13px] text-[var(--ecode-text-muted)]">
                <Globe className="h-4 w-4" />
                <span>Your app is live at:</span>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={publishState.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 text-[13px] text-[var(--ecode-accent)] hover:underline truncate"
                  data-testid="link-published-url"
                >
                  {publishState.url}
                </a>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={handleCopyUrl}
                  data-testid="button-copy-url"
                >
                  {copied ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={() => window.open(publishState.url, '_blank')}
                  data-testid="button-open-url"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              {publishState.deployedAt && (
                <p className="text-[11px] text-[var(--ecode-text-muted)]">
                  Last deployed: {new Date(publishState.deployedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {isFailed && publishState?.errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-[13px] text-red-400">
                <XCircle className="h-4 w-4" />
                <span>Deployment failed</span>
              </div>
              <p className="text-[11px] text-red-300 mt-1">{publishState.errorMessage}</p>
            </div>
          )}

          <Button
            className="w-full min-h-[48px] text-[15px] font-semibold"
            disabled={isPublishing}
            onClick={() => {
              if (isLive || needsRepublish) {
                republishMutation.mutate();
              } else {
                publishMutation.mutate();
              }
            }}
            data-testid="button-publish"
          >
            {isPublishing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Publishing...
              </>
            ) : isLive || needsRepublish ? (
              <>
                <RefreshCw className="h-5 w-5 mr-2" />
                Republish Changes
              </>
            ) : (
              <>
                <Rocket className="h-5 w-5 mr-2" />
                Publish App
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-[var(--ecode-surface)] border-[var(--ecode-border)]">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-[13px] font-medium text-[var(--ecode-text)]">Deployment Info</h3>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[var(--ecode-text-muted)]">Environment</span>
              <span className="text-[var(--ecode-text)]">Production</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ecode-text-muted)]">Region</span>
              <span className="text-[var(--ecode-text)]">Auto (Global CDN)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ecode-text-muted)]">SSL</span>
              <Badge variant="secondary" className="text-[11px] bg-green-500/20 text-green-400">
                <CheckCircle className="h-3 w-3 mr-1" /> Enabled
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
