import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { cn } from '@/lib/utils';
import {
  History,
  RotateCcw,
  Clock,
  Bot,
  User,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Sparkles,
  FileCode,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import type { AutoCheckpoint } from '@shared/schema';

interface CheckpointHistoryPanelProps {
  projectId: number | string;
  className?: string;
  compact?: boolean;
  maxHeight?: string;
}

interface CheckpointListResponse {
  success: boolean;
  checkpoints: AutoCheckpoint[];
  count: number;
}

export function useAutoCheckpoints(projectId: number | string, limit: number = 50) {
  return useQuery<CheckpointListResponse>({
    queryKey: ['/api/projects', projectId, 'auto-checkpoints'],
    enabled: !!projectId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

export function useRestoreCheckpoint(projectId: number | string) {
  return useMutation({
    mutationFn: async (checkpointId: number) => {
      return apiRequest('POST', `/api/auto-checkpoints/${checkpointId}/restore`, { createBackup: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'auto-checkpoints'] });
    },
  });
}

function CheckpointTypeBadge({ type }: { type: string }) {
  const config = {
    auto: { label: 'Auto', variant: 'secondary' as const, icon: Bot },
    manual: { label: 'Manual', variant: 'outline' as const, icon: User },
    milestone: { label: 'Milestone', variant: 'default' as const, icon: Sparkles },
  };
  
  const { label, variant, icon: Icon } = config[type as keyof typeof config] || config.auto;
  
  return (
    <Badge variant={variant} className="gap-1 text-[11px]" data-testid={`badge-checkpoint-type-${type}`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function CheckpointStatusBadge({ status }: { status: string }) {
  const config = {
    complete: { label: 'Complete', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle },
    pending: { label: 'Pending', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: Clock },
    creating: { label: 'Creating', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Loader2 },
    failed: { label: 'Failed', color: 'bg-red-500/10 text-red-600 border-red-500/20', icon: AlertCircle },
  };
  
  const { label, color, icon: Icon } = config[status as keyof typeof config] || config.pending;
  
  return (
    <Badge variant="outline" className={cn("gap-1 text-[11px]", color)} data-testid={`badge-checkpoint-status-${status}`}>
      <Icon className={cn("h-3 w-3", status === 'creating' && 'animate-spin')} />
      {label}
    </Badge>
  );
}

function CheckpointItem({ 
  checkpoint, 
  onRestore,
  isRestoring,
}: { 
  checkpoint: AutoCheckpoint;
  onRestore: () => void;
  isRestoring: boolean;
}) {
  const createdAt = new Date(checkpoint.createdAt);
  const filesCount = checkpoint.filesSnapshot ? Object.keys(checkpoint.filesSnapshot).length : 0;
  
  return (
    <div 
      className="group relative flex gap-2 md:gap-3 py-2 px-1.5 md:py-3 md:px-2 hover:bg-muted/50 rounded-lg transition-colors"
      data-testid={`checkpoint-item-${checkpoint.id}`}
    >
      <div className="flex flex-col items-center">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <div className="flex-1 w-px bg-border" />
      </div>
      
      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckpointTypeBadge type={checkpoint.type} />
              <CheckpointStatusBadge status={checkpoint.status} />
            </div>
            
            <p className="text-[11px] md:text-[13px] text-foreground leading-relaxed line-clamp-2 md:line-clamp-none">
              {checkpoint.aiSummary || 'Checkpoint created'}
            </p>
            
            <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-[11px] text-muted-foreground flex-wrap">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(createdAt, { addSuffix: true })}
                  </TooltipTrigger>
                  <TooltipContent>
                    {format(createdAt, 'PPpp')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {filesCount > 0 && (
                <span className="flex items-center gap-1">
                  <FileCode className="h-3 w-3" />
                  {filesCount} file{filesCount !== 1 ? 's' : ''}
                </span>
              )}
              
              {checkpoint.includesDatabase && (
                <Badge variant="outline" className="text-[11px] py-0 h-5">
                  +DB
                </Badge>
              )}
            </div>
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRestore}
                  disabled={isRestoring || checkpoint.status !== 'complete'}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0 min-h-[44px] min-w-[44px] touch-manipulation"
                  data-testid={`button-restore-checkpoint-${checkpoint.id}`}
                >
                  {isRestoring ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Restore to this checkpoint
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

function CheckpointSkeleton() {
  return (
    <div className="flex gap-3 py-3 px-2">
      <div className="flex flex-col items-center">
        <Skeleton className="h-2 w-2 rounded-full" />
        <Skeleton className="flex-1 w-px" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
}

export function CheckpointHistoryPanel({ 
  projectId, 
  className, 
  compact = false,
  maxHeight = "400px",
}: CheckpointHistoryPanelProps) {
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<AutoCheckpoint | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  
  const { data, isLoading, error, refetch, isFetching } = useAutoCheckpoints(projectId);
  const restoreMutation = useRestoreCheckpoint(projectId);
  
  const handleRestoreClick = (checkpoint: AutoCheckpoint) => {
    setSelectedCheckpoint(checkpoint);
    setShowRestoreDialog(true);
  };
  
  const handleConfirmRestore = async () => {
    if (!selectedCheckpoint) return;
    
    try {
      await restoreMutation.mutateAsync(selectedCheckpoint.id);
      setShowRestoreDialog(false);
      setSelectedCheckpoint(null);
    } catch (err) {
      console.error('Failed to restore checkpoint:', err);
    }
  };
  
  const checkpoints = data?.checkpoints || [];
  
  if (error) {
    return (
      <Card className={cn("", className)} data-testid="card-checkpoint-history-error">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Checkpoint History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-[13px] text-destructive">
            <AlertCircle className="h-4 w-4" />
            Failed to load checkpoints
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <Card className={cn("", className)} data-testid="card-checkpoint-history">
        <CardHeader className="pb-2 md:pb-3 px-3 md:px-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 md:space-y-1">
              <CardTitle className="flex items-center gap-1.5 md:gap-2 text-[13px] md:text-base">
                <History className="h-3.5 w-3.5 md:h-4 md:w-4" />
                Checkpoint History
              </CardTitle>
              {!compact && (
                <CardDescription>
                  {checkpoints.length} checkpoint{checkpoints.length !== 1 ? 's' : ''} available
                </CardDescription>
              )}
            </div>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => refetch()}
                    disabled={isFetching}
                    data-testid="button-refresh-checkpoints"
                  >
                    <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh checkpoints</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 px-2 md:px-6">
          <ScrollArea style={{ maxHeight }} className="pr-2 md:pr-4">
            {isLoading ? (
              <div className="space-y-1">
                {[1, 2, 3].map((i) => (
                  <CheckpointSkeleton key={i} />
                ))}
              </div>
            ) : checkpoints.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 md:py-8 text-center text-muted-foreground">
                <History className="h-6 w-6 md:h-8 md:w-8 mb-2 opacity-50" />
                <p className="text-[11px] md:text-[13px]">No checkpoints yet</p>
                <p className="text-[10px] md:text-[11px]">Checkpoints are created automatically as you build</p>
              </div>
            ) : (
              <div className="space-y-1">
                {checkpoints.map((checkpoint) => (
                  <CheckpointItem
                    key={checkpoint.id}
                    checkpoint={checkpoint}
                    onRestore={() => handleRestoreClick(checkpoint)}
                    isRestoring={restoreMutation.isPending && selectedCheckpoint?.id === checkpoint.id}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent className="max-w-[95vw] md:max-w-lg mx-auto" data-testid="dialog-restore-checkpoint">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base md:text-[15px]">
              <RotateCcw className="h-4 w-4 md:h-5 md:w-5" />
              Restore Checkpoint
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedCheckpoint && (
                <div className="space-y-3">
                  <p>
                    Are you sure you want to restore to this checkpoint? This will revert your project files to the state at that point in time.
                  </p>
                  <div className="bg-muted p-2 md:p-3 rounded-lg space-y-1.5 md:space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckpointTypeBadge type={selectedCheckpoint.type} />
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(selectedCheckpoint.createdAt), 'PPpp')}
                      </span>
                    </div>
                    <p className="text-[13px] text-foreground">
                      {selectedCheckpoint.aiSummary || 'Checkpoint'}
                    </p>
                  </div>
                  <p className="text-[13px] text-muted-foreground">
                    A backup of your current state will be created before restoring.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="min-h-[44px] touch-manipulation" data-testid="button-cancel-restore">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRestore}
              disabled={restoreMutation.isPending}
              className="bg-primary min-h-[44px] touch-manipulation"
              data-testid="button-confirm-restore"
            >
              {restoreMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default CheckpointHistoryPanel;
