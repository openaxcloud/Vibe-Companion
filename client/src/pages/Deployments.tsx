import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LazyMotionDiv } from '@/lib/motion';
import {
  Globe, RefreshCw, Shield, AlertTriangle, Rocket, Terminal,
  ExternalLink, Clock, Server, Activity, Download, Plus, Settings,
  CheckCircle2, XCircle, AlertCircle, ChevronRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Deployment } from '@shared/schema';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export default function Deployments() {
  const [selectedTab, setSelectedTab] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const params = useParams();
  const projectId = params.projectId;

  // Fetch deployments for the current project
  const { data, isLoading } = useQuery({
    queryKey: projectId ? [`/api/projects/${projectId}/deployments`] : ['/api/deployments'],
    enabled: true,
    initialData: { deployments: [] } as any
  });

  const deployments = data?.deployments || (Array.isArray(data) ? data : []);

  const createDeploymentMutation = useMutation({
    mutationFn: async (_?: void) => {
      if (!projectId) throw new Error('Project ID required');
      const response = await apiRequest('POST', `/api/projects/${projectId}/deploy`, {});
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectId ? [`/api/projects/${projectId}/deployments`] : ['/api/deployments'] });
      toast({
        title: "Deployment started",
        description: "Your project is being deployed...",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Deployment failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const getStatusConfig = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'success':
      case 'live':
        return { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' };
      case 'failed':
      case 'error':
        return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' };
      case 'building':
      case 'deploying':
      case 'publishing':
        return { icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500/10' };
      case 'stopped':
      case 'idle':
        return { icon: AlertCircle, color: 'text-gray-500', bg: 'bg-gray-500/10' };
      default:
        return { icon: AlertCircle, color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
    }
  };

  const filteredDeployments = deployments?.filter((d: Deployment) =>
    d.url?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.status?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <PageShell>
      <PageHeader
        title="Deployments"
        description="Manage and monitor your application deployments"
        actions={
          <Button 
            onClick={() => createDeploymentMutation.mutate()}
            disabled={createDeploymentMutation.isPending || !projectId}
            data-testid="button-create-deployment"
          >
            <Rocket className="h-4 w-4 mr-2" />
            {createDeploymentMutation.isPending ? 'Deploying...' : 'New Deployment'}
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Quick Stats */}
        {!isLoading && deployments && deployments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="card-total-deployments">
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px] font-medium text-muted-foreground">
                  Total Deployments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-deployments">
                  {deployments.length}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-active-deployments">
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px] font-medium text-muted-foreground">
                  Active
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500" data-testid="text-active-deployments">
                  {deployments.filter((d: Deployment) => d.status === 'active').length}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-failed-deployments">
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px] font-medium text-muted-foreground">
                  Failed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500" data-testid="text-failed-deployments">
                  {deployments.filter((d: Deployment) => d.status === 'failed').length}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search deployments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-deployments"
            />
          </div>
        </div>

        {/* Deployments List */}
        <Card>
          <CardHeader>
            <CardTitle>Deployment History</CardTitle>
            <CardDescription>
              View and manage all your deployments
            </CardDescription>
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-2" data-testid="tabs-deployments">
                <TabsTrigger value="active" data-testid="tab-active-deployments">Active</TabsTrigger>
                <TabsTrigger value="all" data-testid="tab-all-deployments">All History</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : filteredDeployments.length === 0 ? (
              <div className="text-center py-12">
                <Rocket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-[15px] font-semibold mb-2">No deployments yet</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery 
                    ? 'No deployments match your search.' 
                    : 'Get started by creating your first deployment.'}
                </p>
                {!searchQuery && projectId && (
                  <Button 
                    onClick={() => createDeploymentMutation.mutate()}
                    disabled={createDeploymentMutation.isPending}
                    data-testid="button-first-deployment"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Deployment
                  </Button>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-4 pr-4">
                  {filteredDeployments
                    .filter((d: Deployment) => selectedTab === 'all' || d.status === 'active')
                    .map((deployment: Deployment, index: number) => {
                    const statusConfig = getStatusConfig(deployment.status);
                    const StatusIcon = statusConfig.icon;

                    return (
                      <div
                        key={deployment.id}
                        className="border rounded-lg p-4 hover:border-primary/50 transition-colors animate-slide-in-up opacity-0"
                        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
                        data-testid={`card-deployment-${deployment.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={cn("p-2 rounded-lg", statusConfig.bg)}>
                              <StatusIcon className={cn("h-5 w-5", statusConfig.color)} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold truncate">
                                  {deployment.url || `Deployment #${deployment.id}`}
                                </h4>
                                <Badge 
                                  variant={deployment.status === 'active' ? 'default' : 'destructive'}
                                  data-testid={`badge-deployment-status-${deployment.id}`}
                                >
                                  {deployment.status}
                                </Badge>
                              </div>

                              <div className="text-[13px] text-muted-foreground space-y-1">
                                {deployment.url && (
                                  <div className="flex items-center gap-2">
                                    <Globe className="h-3 w-3" />
                                    <a 
                                      href={deployment.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="hover:underline flex items-center gap-1"
                                      data-testid={`link-deployment-url-${deployment.id}`}
                                    >
                                      {deployment.url}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {deployment.createdAt 
                                      ? formatDistanceToNow(new Date(deployment.createdAt), { addSuffix: true })
                                      : 'Unknown time'}
                                  </span>
                                </div>
                                {deployment.environment && (
                                  <div className="flex items-center gap-2">
                                    <Server className="h-3 w-3" />
                                    <span className="capitalize">{deployment.environment}</span>
                                  </div>
                                )}
                              </div>

                              {deployment.status === 'failed' && deployment.buildLogs && (
                                <Alert variant="destructive" className="mt-3">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription>{deployment.buildLogs}</AlertDescription>
                                </Alert>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 ml-4">
                            {deployment.url && deployment.status === 'active' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                asChild
                                data-testid={`button-visit-${deployment.id}`}
                              >
                                <a href={deployment.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Visit
                                </a>
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              data-testid={`button-settings-${deployment.id}`}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        {!projectId && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Viewing all deployments</AlertTitle>
            <AlertDescription>
              To deploy a project, navigate to a specific project first.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </PageShell>
  );
}
