import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Sparkles,
  FileCode,
  RefreshCw,
  Save,
  Plus,
  Database,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

export interface UnifiedCheckpointsPanelProps {
  projectId: number | string;
  className?: string;
  compact?: boolean;
  showCreateForm?: boolean;
  maxHeight?: string;
}

export interface Checkpoint {
  id: number;
  projectId: number;
  name?: string | null;
  description?: string | null;
  type: 'auto' | 'manual' | 'milestone' | 'before_action' | 'error_recovery';
  status: 'complete' | 'pending' | 'creating' | 'failed';
  aiSummary?: string | null;
  filesSnapshot?: Record<string, unknown> | null;
  includesDatabase?: boolean;
  createdAt: string | Date;
  fileCount?: number;
}

interface CheckpointListResponse {
  success: boolean;
  checkpoints: Checkpoint[];
  count: number;
}

interface CreateCheckpointData {
  name?: string;
  description?: string;
}

export function useCheckpoints(projectId: number | string) {
  return useQuery<CheckpointListResponse>({
    queryKey: ['/api/projects', projectId, 'checkpoints'],
    enabled: !!projectId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateCheckpoint(projectId: number | string) {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: CreateCheckpointData) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/checkpoints`, {
        name: data.name || `Checkpoint ${new Date().toISOString()}`,
        description: data.description,
      });
      if (!res.ok) throw new Error('Failed to create checkpoint');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'checkpoints'] });
      toast({
        title: 'Checkpoint created',
        description: 'Your project state has been saved',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create checkpoint',
        variant: 'destructive',
      });
    },
  });
}

export function useRestoreCheckpoint(projectId: number | string) {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (checkpointId: number) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/checkpoints/${checkpointId}/restore`, {
        createBackup: true,
      });
      if (!res.ok) throw new Error('Failed to restore checkpoint');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'checkpoints'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'files'] });
      toast({
        title: 'Checkpoint restored',
        description: 'Your project has been restored to the selected checkpoint',
      });
    },
    onError: (error) => {
      toast({
        title: 'Restore failed',
        description: error.message || 'Failed to restore checkpoint',
        variant: 'destructive',
      });
    },
  });
}

function CheckpointTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: typeof Bot }> = {
    auto: { label: 'Auto', variant: 'secondary', icon: Bot },
    manual: { label: 'Manual', variant: 'outline', icon: User },
    milestone: { label: 'Milestone', variant: 'default', icon: Sparkles },
    before_action: { label: 'Pre-Action', variant: 'secondary', icon: Zap },
    error_recovery: { label: 'Recovery', variant: 'destructive', icon: AlertTriangle },
  };
  
  const { label, variant, icon: Icon } = config[type] || config.auto;
  
  return (
    <Badge variant={variant} className="gap-1 text-[11px]" data-testid={`badge-checkpoint-type-${type}`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function CheckpointStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
    complete: { label: 'Complete', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle },
    pending: { label: 'Pending', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: Clock },
    creating: { label: 'Creating', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Loader2 },
    failed: { label: 'Failed', color: 'bg-red-500/10 text-red-600 border-red-500/20', icon: AlertCircle },
  };
  
  const { label, color, icon: Icon } = config[status] || config.pending;
  
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
  compact,
}: { 
  checkpoint: Checkpoint;
  onRestore: () => void;
  isRestoring: boolean;
  compact?: boolean;
}) {
  const createdAt = new Date(checkpoint.createdAt);
  const filesCount = checkpoint.fileCount || (checkpoint.filesSnapshot ? Object.keys(checkpoint.filesSnapshot).length : 0);
  
  return (
    <div 
      className={cn(
        "group relative flex gap-2 md:gap-3 hover:bg-muted/50 rounded-lg transition-colors",
        compact ? "py-1.5 px-1" : "py-2 px-1.5 md:py-3 md:px-2"
      )}
      data-testid={`checkpoint-item-${checkpoint.id}`}
    >
      <div className="flex flex-col items-center">
        <div className={cn("rounded-full bg-primary", compact ? "h-1.5 w-1.5" : "h-2 w-2")} />
        <div className="flex-1 w-px bg-border" />
      </div>
      
      <div className="flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <CheckpointTypeBadge type={checkpoint.type} />
              <CheckpointStatusBadge status={checkpoint.status} />
            </div>
            
            {checkpoint.name && (
              <p className={cn(
                "font-medium text-foreground truncate",
                compact ? "text-[11px]" : "text-[11px] md:text-[13px]"
              )}>
                {checkpoint.name}
              </p>
            )}
            
            <p className={cn(
              "text-muted-foreground leading-relaxed",
              compact ? "text-[11px] line-clamp-1" : "text-[11px] md:text-[13px] line-clamp-2 md:line-clamp-none"
            )}>
              {checkpoint.description || checkpoint.aiSummary || 'Checkpoint created'}
            </p>
            
            <div className={cn(
              "flex items-center gap-2 text-muted-foreground flex-wrap",
              compact ? "text-[9px] gap-1.5" : "text-[10px] md:text-[11px] md:gap-3"
            )}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1" data-testid={`tooltip-trigger-time-${checkpoint.id}`}>
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(createdAt, { addSuffix: true })}
                  </TooltipTrigger>
                  <TooltipContent data-testid={`tooltip-content-time-${checkpoint.id}`}>
                    {format(createdAt, 'PPpp')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {filesCount > 0 && (
                <span className="flex items-center gap-1" data-testid={`text-file-count-${checkpoint.id}`}>
                  <FileCode className="h-3 w-3" />
                  {filesCount} file{filesCount !== 1 ? 's' : ''}
                </span>
              )}
              
              {checkpoint.includesDatabase && (
                <Badge variant="outline" className={cn("py-0", compact ? "text-[9px] h-4" : "text-[11px] h-5")} data-testid={`badge-includes-db-${checkpoint.id}`}>
                  <Database className="h-2.5 w-2.5 mr-0.5" />
                  DB
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
                  className={cn(
                    "shrink-0 touch-manipulation transition-opacity",
                    compact 
                      ? "h-8 w-8 p-0 opacity-100" 
                      : "min-h-[44px] min-w-[44px] opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  )}
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
                {checkpoint.status !== 'complete' 
                  ? 'Checkpoint not ready for restore' 
                  : 'Restore to this checkpoint'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

function CheckpointSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("flex gap-3", compact ? "py-2 px-1" : "py-3 px-2")}>
      <div className="flex flex-col items-center">
        <Skeleton className={cn("rounded-full", compact ? "h-1.5 w-1.5" : "h-2 w-2")} />
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

function CreateCheckpointForm({ 
  projectId, 
  compact,
  onSuccess,
}: { 
  projectId: number | string;
  compact?: boolean;
  onSuccess?: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const createMutation = useCreateCheckpoint(projectId);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync({ name, description });
    setName('');
    setDescription('');
    onSuccess?.();
  };
  
  return (
    <form onSubmit={handleSubmit} className={cn("space-y-2", compact ? "p-2" : "p-3")} data-testid="form-create-checkpoint">
      <Input
        type="text"
        placeholder="Checkpoint name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={compact ? "h-8 text-[11px]" : ""}
        data-testid="input-checkpoint-name"
      />
      {!compact && (
        <Textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-16 resize-none"
          data-testid="input-checkpoint-description"
        />
      )}
      <Button
        type="submit"
        disabled={createMutation.isPending}
        className={cn("w-full", compact && "h-8 text-[11px]")}
        data-testid="button-create-checkpoint"
      >
        {createMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Create Checkpoint
          </>
        )}
      </Button>
    </form>
  );
}

export function UnifiedCheckpointsPanel({ 
  projectId, 
  className, 
  compact = false,
  showCreateForm = true,
  maxHeight = "400px",
}: UnifiedCheckpointsPanelProps) {
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showCreateSection, setShowCreateSection] = useState(false);
  
  const { data, isLoading, error, refetch, isFetching } = useCheckpoints(projectId);
  const restoreMutation = useRestoreCheckpoint(projectId);
  
  const handleRestoreClick = (checkpoint: Checkpoint) => {
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
      <Card className={cn("", className)} data-testid="card-unified-checkpoints-error">
        <CardHeader className={compact ? "pb-2 px-3" : "pb-3"}>
          <CardTitle className={cn("flex items-center gap-2", compact ? "text-[13px]" : "text-base")}>
            <History className="h-4 w-4" />
            Checkpoints
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-[13px] text-destructive" data-testid="text-error-message">
            <AlertCircle className="h-4 w-4" />
            Failed to load checkpoints
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()} 
            className="mt-2"
            data-testid="button-retry-load"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <Card className={cn("", className)} data-testid="card-unified-checkpoints">
        <CardHeader className={cn("px-3 md:px-6", compact ? "pb-2" : "pb-2 md:pb-3")}>
          <div className="flex items-center justify-between">
            <div className={compact ? "space-y-0" : "space-y-0.5 md:space-y-1"}>
              <CardTitle className={cn("flex items-center gap-1.5 md:gap-2", compact ? "text-[13px]" : "text-[13px] md:text-base")}>
                <History className={compact ? "h-3.5 w-3.5" : "h-3.5 w-3.5 md:h-4 md:w-4"} />
                Checkpoints
              </CardTitle>
              {!compact && (
                <CardDescription data-testid="text-checkpoint-count">
                  {checkpoints.length} checkpoint{checkpoints.length !== 1 ? 's' : ''} available
                </CardDescription>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              {showCreateForm && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant={showCreateSection ? "secondary" : "ghost"}
                        onClick={() => setShowCreateSection(!showCreateSection)}
                        data-testid="button-toggle-create-form"
                      >
                        <Plus className={cn("h-4 w-4", showCreateSection && "rotate-45 transition-transform")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{showCreateSection ? 'Hide create form' : 'Create checkpoint'}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
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
          </div>
        </CardHeader>
        
        {showCreateSection && showCreateForm && (
          <div className="border-b">
            <CreateCheckpointForm 
              projectId={projectId} 
              compact={compact}
              onSuccess={() => setShowCreateSection(false)}
            />
          </div>
        )}
        
        <CardContent className={cn("pt-0", compact ? "px-2" : "px-2 md:px-6")}>
          <ScrollArea style={{ maxHeight }} className={compact ? "pr-1" : "pr-2 md:pr-4"} data-testid="scroll-area-checkpoints">
            {isLoading ? (
              <div className="space-y-1" data-testid="loading-skeletons">
                {[1, 2, 3].map((i) => (
                  <CheckpointSkeleton key={i} compact={compact} />
                ))}
              </div>
            ) : checkpoints.length === 0 ? (
              <div className={cn(
                "flex flex-col items-center justify-center text-center text-muted-foreground",
                compact ? "py-4" : "py-6 md:py-8"
              )} data-testid="empty-state">
                <History className={cn("mb-2 opacity-50", compact ? "h-5 w-5" : "h-6 w-6 md:h-8 md:w-8")} />
                <p className={compact ? "text-[11px]" : "text-[11px] md:text-[13px]"}>No checkpoints yet</p>
                <p className={compact ? "text-[9px]" : "text-[10px] md:text-[11px]"}>
                  Create a checkpoint to save your project state
                </p>
                {showCreateForm && !showCreateSection && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => setShowCreateSection(true)}
                    data-testid="button-create-first-checkpoint"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create First Checkpoint
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1" data-testid="checkpoint-list">
                {checkpoints.map((checkpoint) => (
                  <CheckpointItem
                    key={checkpoint.id}
                    checkpoint={checkpoint}
                    onRestore={() => handleRestoreClick(checkpoint)}
                    isRestoring={restoreMutation.isPending && selectedCheckpoint?.id === checkpoint.id}
                    compact={compact}
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
            <AlertDialogDescription asChild>
              <div>
                {selectedCheckpoint && (
                  <div className="space-y-3">
                    <p>
                      Are you sure you want to restore to this checkpoint? This will revert your project files to the state at that point in time.
                    </p>
                    <div className="bg-muted p-2 md:p-3 rounded-lg space-y-1.5 md:space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CheckpointTypeBadge type={selectedCheckpoint.type} />
                        <CheckpointStatusBadge status={selectedCheckpoint.status} />
                        <span className="text-[11px] text-muted-foreground">
                          {format(new Date(selectedCheckpoint.createdAt), 'PPpp')}
                        </span>
                      </div>
                      {selectedCheckpoint.name && (
                        <p className="text-[13px] font-medium text-foreground">
                          {selectedCheckpoint.name}
                        </p>
                      )}
                      <p className="text-[13px] text-foreground">
                        {selectedCheckpoint.description || selectedCheckpoint.aiSummary || 'Checkpoint'}
                      </p>
                      {selectedCheckpoint.includesDatabase && (
                        <Badge variant="outline" className="text-[11px]">
                          <Database className="h-3 w-3 mr-1" />
                          Includes database snapshot
                        </Badge>
                      )}
                    </div>
                    <p className="text-[13px] text-muted-foreground">
                      A backup of your current state will be created before restoring.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="min-h-[44px] touch-manipulation" data-testid="button-cancel-restore">
              Cancel
            </AlertDialogCancel>
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

export default UnifiedCheckpointsPanel;
