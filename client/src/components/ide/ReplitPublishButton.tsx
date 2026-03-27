// @ts-nocheck
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Rocket,
  ExternalLink,
  Copy,
  FileText,
  BarChart3,
  Trash2,
  ChevronDown,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

type PublishStatus = 'idle' | 'publishing' | 'live' | 'failed' | 'needs-republish';

interface PublishState {
  status: PublishStatus;
  url?: string;
  deployedAt?: string;
  lastCodeChange?: string;
  errorMessage?: string;
}

interface ReplitPublishButtonProps {
  projectId: string;
  onOpenLogs?: () => void;
  onOpenAnalytics?: () => void;
}

export function ReplitPublishButton({
  projectId,
  onOpenLogs,
  onOpenAnalytics,
}: ReplitPublishButtonProps) {
  const [showUnpublishDialog, setShowUnpublishDialog] = useState(false);

  const { data: publishState, isLoading: isLoadingStatus } = useQuery<PublishState>({
    queryKey: ['/api/projects', projectId, 'publish', 'status'],
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === 'publishing' ? 2000 : false;
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<PublishState>('POST', `/api/projects/${projectId}/publish`);
    },
    onMutate: () => {
      queryClient.setQueryData<PublishState>(
        ['/api/projects', projectId, 'publish', 'status'],
        (old) => ({ ...old, status: 'publishing' })
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'publish', 'status'] });
      toast({
        title: 'Published successfully!',
        description: data?.url ? `Your app is live at ${data.url}` : 'Your app is now live.',
      });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'publish', 'status'] });
      toast({
        title: 'Publish failed',
        description: error.message || 'Something went wrong while publishing.',
        variant: 'destructive',
      });
    },
  });

  const republishMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<PublishState>('POST', `/api/projects/${projectId}/republish`);
    },
    onMutate: () => {
      queryClient.setQueryData<PublishState>(
        ['/api/projects', projectId, 'publish', 'status'],
        (old) => ({ ...old, status: 'publishing' })
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'publish', 'status'] });
      toast({
        title: 'Republished successfully!',
        description: 'Your changes are now live.',
      });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'publish', 'status'] });
      toast({
        title: 'Republish failed',
        description: error.message || 'Something went wrong while republishing.',
        variant: 'destructive',
      });
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<void>('DELETE', `/api/projects/${projectId}/publish`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'publish', 'status'] });
      setShowUnpublishDialog(false);
      toast({
        title: 'Unpublished',
        description: 'Your app has been taken offline.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Unpublish failed',
        description: error.message || 'Something went wrong while unpublishing.',
        variant: 'destructive',
      });
    },
  });

  const handlePublish = () => {
    if (publishState?.status === 'live' || publishState?.status === 'needs-republish') {
      republishMutation.mutate(undefined);
    } else {
      publishMutation.mutate(undefined);
    }
  };

  const handleCopyUrl = () => {
    if (publishState?.url) {
      navigator.clipboard.writeText(publishState.url);
      toast({
        title: 'URL copied',
        description: 'Deployment URL copied to clipboard.',
      });
    }
  };

  const handleViewLiveApp = () => {
    if (publishState?.url) {
      window.open(publishState.url, '_blank', 'noopener,noreferrer');
    }
  };

  const status = publishState?.status || 'idle';
  const isPublishing = status === 'publishing' || publishMutation.isPending || republishMutation.isPending;
  const isLive = status === 'live';
  const needsRepublish = status === 'needs-republish';
  const isFailed = status === 'failed';
  const hasDropdown = isLive || needsRepublish;

  if (isLoadingStatus) {
    return (
      <Skeleton 
        className="h-7 w-20 rounded-md" 
        data-testid="publish-button-skeleton"
      />
    );
  }

  const StatusDot = () => {
    if (isPublishing) {
      return (
        <Loader2 
          className="h-3 w-3 animate-spin" 
          data-testid="status-dot-publishing"
        />
      );
    }
    
    if (isLive) {
      return (
        <span 
          className="relative flex h-2 w-2"
          data-testid="status-dot-live"
        >
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
      );
    }
    
    if (needsRepublish) {
      return (
        <span 
          className="h-2 w-2 rounded-full bg-yellow-500"
          data-testid="status-dot-needs-republish"
        />
      );
    }
    
    if (isFailed) {
      return (
        <span 
          className="h-2 w-2 rounded-full bg-red-500"
          data-testid="status-dot-failed"
        />
      );
    }
    
    return (
      <span 
        className="h-2 w-2 rounded-full bg-gray-400"
        data-testid="status-dot-idle"
      />
    );
  };

  const getButtonText = () => {
    if (isPublishing) return 'Publishing...';
    if (needsRepublish) return 'Republish';
    if (isLive) return 'Republish';
    return 'Publish';
  };

  const getButtonVariant = () => {
    if (isFailed) return 'destructive';
    if (isLive || needsRepublish) return 'outline';
    return 'default';
  };

  const getButtonStyles = () => {
    if (isPublishing) {
      return 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600';
    }
    if (isLive) {
      return 'border-green-500/50 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20';
    }
    if (needsRepublish) {
      return 'border-yellow-500/50 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950/20';
    }
    if (isFailed) {
      return 'bg-red-600 hover:bg-red-700 text-white';
    }
    return 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white';
  };

  const buttonContent = (
    <Button
      variant={getButtonVariant()}
      size="sm"
      onClick={hasDropdown ? undefined : handlePublish}
      disabled={isPublishing}
      data-testid="publish-button"
      className={cn(
        'h-7 px-2.5 gap-1.5 text-[11px] font-medium transition-all shadow-sm',
        getButtonStyles()
      )}
    >
      <StatusDot />
      <span>{getButtonText()}</span>
      {hasDropdown && (
        <ChevronDown className="h-3 w-3 ml-0.5 opacity-70" />
      )}
    </Button>
  );

  const tooltipContent = publishState?.url ? (
    <div className="flex flex-col gap-1">
      <span className="font-medium">Deployed at:</span>
      <span className="text-[11px] opacity-90">{publishState.url}</span>
      {publishState.deployedAt && (
        <span className="text-[11px] opacity-70">
          {new Date(publishState.deployedAt).toLocaleString()}
        </span>
      )}
    </div>
  ) : isFailed && publishState?.errorMessage ? (
    <div className="flex flex-col gap-1">
      <span className="font-medium text-red-500">Deployment failed</span>
      <span className="text-[11px]">{publishState.errorMessage}</span>
    </div>
  ) : null;

  if (hasDropdown) {
    return (
      <TooltipProvider>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                {buttonContent}
              </DropdownMenuTrigger>
            </TooltipTrigger>
            {tooltipContent && (
              <TooltipContent side="bottom" className="max-w-xs">
                {tooltipContent}
              </TooltipContent>
            )}
          </Tooltip>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={handlePublish}
              disabled={isPublishing}
              data-testid="dropdown-republish"
              className="gap-2"
            >
              {isPublishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              <span>{isPublishing ? 'Publishing...' : 'Republish'}</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            {publishState?.url && (
              <>
                <DropdownMenuItem
                  onClick={handleViewLiveApp}
                  data-testid="dropdown-view-live"
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>View live app</span>
                </DropdownMenuItem>
                
                <DropdownMenuItem
                  onClick={handleCopyUrl}
                  data-testid="dropdown-copy-url"
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  <span>Copy URL</span>
                </DropdownMenuItem>
              </>
            )}
            
            {onOpenLogs && (
              <DropdownMenuItem
                onClick={onOpenLogs}
                data-testid="dropdown-view-logs"
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                <span>View logs</span>
              </DropdownMenuItem>
            )}
            
            {onOpenAnalytics && (
              <DropdownMenuItem
                onClick={onOpenAnalytics}
                data-testid="dropdown-view-analytics"
                className="gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                <span>View analytics</span>
              </DropdownMenuItem>
            )}
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem
              onClick={() => setShowUnpublishDialog(true)}
              data-testid="dropdown-unpublish"
              className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
            >
              <Trash2 className="h-4 w-4" />
              <span>Unpublish</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={showUnpublishDialog} onOpenChange={setShowUnpublishDialog}>
          <AlertDialogContent data-testid="unpublish-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Unpublish this app?</AlertDialogTitle>
              <AlertDialogDescription>
                This will take your app offline and remove it from the public URL. 
                You can publish it again at any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="unpublish-cancel">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => unpublishMutation.mutate(undefined)}
                disabled={unpublishMutation.isPending}
                data-testid="unpublish-confirm"
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {unpublishMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Unpublishing...
                  </>
                ) : (
                  'Unpublish'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {buttonContent}
        </TooltipTrigger>
        {tooltipContent && (
          <TooltipContent side="bottom" className="max-w-xs">
            {tooltipContent}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
