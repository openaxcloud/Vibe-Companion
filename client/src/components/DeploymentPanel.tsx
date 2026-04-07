import React from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ExternalLink, 
  AlertCircle, 
  RefreshCw,
  Shield,
  ChevronDown,
  ChevronUp,
  Clock,
  Globe,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface DeploymentData {
  id?: number;
  status?: 'running' | 'failed' | 'building' | 'stopped' | 'active' | 'deploying';
  environment?: string;
  lastDeployedAgo?: string;
  visibility?: 'public' | 'private';
  domain?: string;
  url?: string;
  buildErrors?: any[];
  type?: 'autoscale' | 'static' | 'reserved-vm' | 'serverless' | 'scheduled';
  customDomain?: string;
  sslEnabled?: boolean;
  regions?: string[];
  createdAt?: string;
  updatedAt?: string;
  metrics?: {
    cpuUsage?: number;
    memoryUsage?: number;
    requestsPerSecond?: number;
    uptime?: number;
  };
  resources?: {
    cpu?: string;
    memory?: string;
  };
  scaling?: {
    minInstances?: number;
    maxInstances?: number;
    targetCPU?: number;
  };
}

interface DeploymentPanelProps {
  projectId: number;
}

export const DeploymentPanel: React.FC<DeploymentPanelProps> = ({ projectId }) => {
  const [, navigate] = useLocation();
  const [showAgentSuggestions, setShowAgentSuggestions] = React.useState(true);
  const [showBuildErrors, setShowBuildErrors] = React.useState(true);

  // Fetch deployment data from the backend
  const { data: deploymentResponse, isLoading, refetch } = useQuery<{ deployment?: DeploymentData; deployments?: DeploymentData[] }>({
    queryKey: [`/api/projects/${projectId}/deployments`],
    refetchInterval: (_data, _query) => {
      // If deployment is in progress, poll more frequently
      const data = _data;
      const deployment = data?.deployment || (data?.deployments && data.deployments[0]);
      if (deployment?.status === 'building' || deployment?.status === 'deploying') {
        return 3000; // Poll every 3 seconds while deploying
      }
      return false; // Don't poll when not deploying to save resources
    },
    enabled: !!projectId,
    retry: 3,
    staleTime: 10000, // Consider data fresh for 10 seconds
  });

  // Get the latest deployment from the response
  const deployment = deploymentResponse?.deployment || 
    (deploymentResponse?.deployments && deploymentResponse.deployments.length > 0 
      ? deploymentResponse.deployments[0] 
      : undefined);

  const handleRedeploy = async () => {
    try {
      const response = await apiRequest('POST', `/api/projects/${projectId}/deploy`, {
        type: deployment?.type || 'autoscale',
        regions: deployment?.regions || ['us-east-1'],
        environment: deployment?.environment || 'production',
        sslEnabled: true
      });
      if (response.ok) {
        await queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/deployments`] });
      }
    } catch (error) {
      console.error('Failed to redeploy:', error);
    }
  };

  const handleSecurityScan = async () => {
    try {
      const response = await apiRequest('POST', `/api/security/${projectId}/scan`, {});
      if (response.ok) {
        await queryClient.invalidateQueries({ queryKey: [`/api/deployment/${projectId}`] });
      }
    } catch (error) {
      console.error('Failed to run security scan:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  const hasErrors = deployment?.status === 'failed' || (deployment?.buildErrors?.length ?? 0) > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Deployment Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="font-medium">Deployment</h3>
            <span className={cn(
              "px-2 py-0.5 text-[11px] rounded-full font-medium",
              deployment?.status === 'running' || deployment?.status === 'active' ? "bg-green-100 text-green-700" : 
              deployment?.status === 'failed' ? "bg-red-100 text-red-700" :
              deployment?.status === 'building' ? "bg-blue-100 text-blue-700" :
              "bg-gray-100 text-gray-700"
            )}>
              {deployment?.environment || 'Production'}
            </span>
            {deployment?.status === 'failed' && deployment?.updatedAt && (
              <span className="text-[11px] text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Deployment failed {new Date(deployment.updatedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Deployment Info */}
        <div className="space-y-2 text-[13px]">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Visibility:</span>
            <div className="flex items-center gap-1">
              {deployment?.visibility === 'public' ? (
                <>
                  <Globe className="h-3 w-3" />
                  <span>Public</span>
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3" />
                  <span>Private</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Domain:</span>
            {deployment?.customDomain || deployment?.domain || deployment?.url ? (
              <a 
                href={deployment.customDomain || deployment.domain || deployment.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1"
              >
                {deployment.customDomain || deployment.domain || deployment.url}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-muted-foreground">No domain configured</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Type:</span>
            <span>
              {deployment?.type === 'autoscale' && deployment?.scaling ? 
                `Autoscale (${deployment.resources?.cpu || '500m'} CPU / ${deployment.resources?.memory || '512Mi'} RAM / ${deployment.scaling.maxInstances || 3} Max)` :
              deployment?.type === 'static' ? 
                'Static Hosting' :
              deployment?.type === 'reserved-vm' ?
                `Reserved VM (${deployment.resources?.cpu || '1'} vCPU / ${deployment.resources?.memory || '2Gi'} RAM)` :
              deployment?.type === 'serverless' ?
                'Serverless Function' :
                'Standard Deployment'
              }
            </span>
            <Button variant="link" size="sm" className="h-auto p-0 text-blue-600">
              Manage
            </Button>
            <Button variant="link" size="sm" className="h-auto p-0 text-blue-600">
              See all usage
            </Button>
          </div>
        </div>
      </div>

      {/* Build Failed Alert */}
      {hasErrors && deployment?.buildErrors && deployment.buildErrors.length > 0 && (
        <div className="px-2.5 py-2 border-b border-[var(--ecode-border)]">
          <Alert className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <div className="font-medium mb-2">Build process failed</div>
              <div className="space-y-2 text-[13px]">
                {deployment.buildErrors.slice(0, 4).map((error, index) => (
                  <div key={index} className="space-y-1">
                    <div>{error.message || error}</div>
                    {error.file && (
                      <Button variant="link" size="sm" className="h-auto p-0 text-blue-600">
                        {error.file}
                      </Button>
                    )}
                  </div>
                ))}
                {deployment.buildErrors.length > 4 && (
                  <div className="text-[11px] text-muted-foreground">
                    ...and {deployment.buildErrors.length - 4} more errors
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Agent Suggestions */}
      {hasErrors && deployment?.buildErrors && deployment.buildErrors.length > 0 && (
        <div className="px-2.5 py-2 border-b border-[var(--ecode-border)]">
          <button
            onClick={() => setShowAgentSuggestions(!showAgentSuggestions)}
            className="flex items-center justify-between w-full text-left"
          >
            <h4 className="text-xs font-medium flex items-center gap-1.5 text-[var(--ecode-text)]">
              <span className="text-purple-600">🤖</span>
              Agent suggestions
            </h4>
            {showAgentSuggestions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          
          {showAgentSuggestions && (
            <div className="mt-3 space-y-2">
              <p className="text-[13px] text-muted-foreground mb-2">
                AI Agent can help you debug and fix these deployment errors.
              </p>
              <Button className="w-full mt-3 bg-purple-600 hover:bg-purple-700">
                🤖 Debug with Agent
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="p-4 space-y-2">
        <Button 
          onClick={handleRedeploy}
          className="w-full justify-start"
          variant="outline"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Redeploy
        </Button>
        
        <Button 
          className="w-full justify-start"
          variant="outline"
        >
          <Clock className="h-4 w-4 mr-2" />
          Edit commands and secrets
        </Button>
        
        <Button 
          onClick={handleSecurityScan}
          className="w-full justify-start"
          variant="outline"
        >
          <Shield className="h-4 w-4 mr-2" />
          Run security scan
        </Button>

        <div className="mt-4">
          <Button 
            variant="link" 
            size="sm" 
            className="text-blue-600 p-0 h-auto flex items-center gap-1"
            onClick={() => navigate(`/projects/${projectId}/deployments`)}
          >
            View logs
            {deployment?.id && (
              <span className="bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded text-[11px] ml-1">
                {deployment.buildErrors?.length || 0}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* View all failed builds */}
      {hasErrors && (
        <div className="p-4 border-t mt-auto">
          <button
            onClick={() => setShowBuildErrors(!showBuildErrors)}
            className="flex items-center gap-2 text-[13px] text-blue-600 hover:underline"
          >
            {showBuildErrors ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            View all failed builds
          </button>
        </div>
      )}
    </div>
  );
};