import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Deployment } from '@shared/schema';
import { formatDistanceToNow } from 'date-fns';

// UI Components
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Rocket,
  ExternalLink,
  RefreshCw,
  XCircle,
  Clock,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Globe,
} from 'lucide-react';

interface DeploymentPanelProps {
  projectId: number;
}

const DeploymentPanel: React.FC<DeploymentPanelProps> = ({ projectId }) => {
  const { toast } = useToast();
  const [expandedDeployment, setExpandedDeployment] = useState<number | null>(null);
  const [deploymentLogs, setDeploymentLogs] = useState<Record<number, string[]>>({});

  // Query for fetching deployments
  const {
    data: deployments,
    isLoading: deploymentsLoading,
    error: deploymentsError,
  } = useQuery<Deployment[]>({
    queryKey: ['/api/projects', projectId, 'deployments'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/deployments`);
      if (!res.ok) {
        throw new Error('Failed to fetch deployments');
      }
      return res.json();
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Mutation for deploying project
  const deployMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/deploy`);
      if (!res.ok) {
        throw new Error('Failed to deploy project');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'deployments'] });
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

  // Mutation for stopping a deployment
  const stopDeploymentMutation = useMutation({
    mutationFn: async (deploymentId: number) => {
      const res = await apiRequest('POST', `/api/deployments/${deploymentId}/stop`);
      if (!res.ok) {
        throw new Error('Failed to stop deployment');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'deployments'] });
      toast({
        title: "Deployment stopped",
        description: "Your deployment has been stopped.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to stop deployment",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Fetch deployment logs when a deployment is expanded
  useEffect(() => {
    if (!expandedDeployment) return;

    const fetchLogs = async () => {
      try {
        const res = await apiRequest('GET', `/api/deployments/${expandedDeployment}/logs`);
        if (!res.ok) {
          throw new Error('Failed to fetch deployment logs');
        }
        const data = await res.json();
        setDeploymentLogs(prevLogs => ({
          ...prevLogs,
          [expandedDeployment]: data.logs
        }));
      } catch (error) {
        console.error('Error fetching deployment logs:', error);
      }
    };

    fetchLogs();
    
    // Set up an interval to refresh logs
    const interval = setInterval(fetchLogs, 5000);
    
    return () => clearInterval(interval);
  }, [expandedDeployment]);

  // Helper function to render deployment status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'deploying':
        return <Badge className="bg-blue-500"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Deploying</Badge>;
      case 'running':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Running</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'stopped':
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Stopped</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  // Helper function to open deployment URL
  const openDeploymentUrl = (url: string) => {
    window.open(url, '_blank');
  };

  // Render loading state
  if (deploymentsLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-10">
        <Spinner size="lg" />
        <p className="mt-4 text-muted-foreground">Loading deployments...</p>
      </div>
    );
  }

  // Render error state
  if (deploymentsError) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 p-4 rounded-lg text-destructive">
          <p>Error loading deployments: {deploymentsError.message}</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'deployments'] })}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!deployments || deployments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-10">
        <div className="mb-4 bg-muted/30 p-4 rounded-full">
          <Rocket className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No deployments yet</h3>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          Deploy your project to make it available online. Each deployment creates a new version.
        </p>
        <Button 
          className="gap-2" 
          onClick={() => deployMutation.mutate()}
          disabled={deployMutation.isPending}
        >
          {deployMutation.isPending ? (
            <Spinner size="sm" className="mr-2" />
          ) : (
            <Rocket className="h-4 w-4 mr-2" />
          )}
          Deploy Project
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Deployments</h2>
        <Button 
          onClick={() => deployMutation.mutate()}
          disabled={deployMutation.isPending}
          className="gap-2"
        >
          {deployMutation.isPending ? (
            <Spinner size="sm" className="mr-2" />
          ) : (
            <Rocket className="h-4 w-4" />
          )}
          New Deployment
        </Button>
      </div>

      <div className="space-y-4">
        {deployments.map((deployment) => (
          <Card key={deployment.id} className="overflow-hidden">
            <CardHeader className="pb-3 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base flex items-center">
                    {deployment.version}
                    <span className="ml-3">
                      {renderStatusBadge(deployment.status)}
                    </span>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Deployed {formatDate(deployment.createdAt)}
                  </CardDescription>
                </div>
                {deployment.url && deployment.status === 'running' && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-1"
                    onClick={() => openDeploymentUrl(deployment.url)}
                  >
                    <Globe className="h-4 w-4" />
                    Visit
                  </Button>
                )}
              </div>
            </CardHeader>
            <Accordion
              type="single"
              collapsible
              value={expandedDeployment === deployment.id ? 'logs' : undefined}
              onValueChange={(value) => setExpandedDeployment(value === 'logs' ? deployment.id : null)}
            >
              <AccordionItem value="logs" className="border-0">
                <AccordionTrigger className="py-3 px-4 text-sm font-medium">
                  <Terminal className="h-4 w-4 mr-2" />
                  Deployment Logs
                </AccordionTrigger>
                <AccordionContent>
                  <div className="bg-black text-white p-2 rounded-md">
                    <ScrollArea className="h-[200px] w-full">
                      <pre className="text-xs font-mono p-2">
                        {deploymentLogs[deployment.id] ? (
                          deploymentLogs[deployment.id].map((log, idx) => (
                            <div key={idx} className="py-0.5">
                              {log}
                            </div>
                          ))
                        ) : (
                          <div className="flex justify-center items-center h-full">
                            <Spinner size="sm" className="mr-2" />
                            <span>Loading logs...</span>
                          </div>
                        )}
                      </pre>
                    </ScrollArea>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <CardFooter className="bg-muted/50 py-2">
              <div className="flex justify-between items-center w-full">
                <div className="text-xs text-muted-foreground flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatDate(deployment.updatedAt)}
                </div>
                {deployment.status === 'running' && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => stopDeploymentMutation.mutate(deployment.id)}
                    disabled={stopDeploymentMutation.isPending}
                  >
                    {stopDeploymentMutation.isPending ? (
                      <Spinner size="sm" className="mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-1" />
                    )}
                    Stop Deployment
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DeploymentPanel;