import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  RotateCcw, Play, Pause, SkipBack, SkipForward, Clock,
  FileText, GitCommit, Save, AlertTriangle, Check, X,
  ChevronLeft, ChevronRight, Calendar, History, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

interface Checkpoint {
  id: string;
  timestamp: string;
  type: 'auto' | 'manual' | 'git_commit' | 'deploy';
  description: string;
  files: { path: string; action: 'created' | 'modified' | 'deleted' }[];
  snapshot?: string;
  userId?: string;
  size?: number;
}

interface RewindPanelProps {
  projectId: string;
  onRestore?: (checkpointId: string) => void;
  className?: string;
}

export function RewindPanel({ projectId, onRestore, className }: RewindPanelProps) {
  const queryClient = useQueryClient();
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);

  const { data: checkpoints, isLoading } = useQuery<Checkpoint[]>({
    queryKey: ['/api/checkpoints', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/checkpoints?projectId=${projectId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        return [] as Checkpoint[];
      }
      return response.json();
    },
    enabled: !!projectId
  });

  const restoreMutation = useMutation({
    mutationFn: async (checkpointId: string) => {
      const response = await apiRequest('POST', `/api/checkpoints/${checkpointId}/restore`, {
        projectId
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Checkpoint restored', description: 'Your project has been restored to the selected checkpoint' });
      queryClient.invalidateQueries({ queryKey: ['/api/files', projectId] });
      setShowConfirmRestore(false);
      onRestore?.(selectedCheckpoint!.id);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to restore', description: error.message, variant: 'destructive' });
    }
  });

  const createCheckpointMutation = useMutation({
    mutationFn: async (description: string) => {
      const response = await apiRequest('POST', '/api/checkpoints', {
        projectId,
        description,
        type: 'manual'
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Checkpoint created' });
      queryClient.invalidateQueries({ queryKey: ['/api/checkpoints', projectId] });
    }
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && checkpoints && checkpoints.length > 0) {
      interval = setInterval(() => {
        setPlaybackPosition(prev => {
          if (prev >= checkpoints.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, checkpoints]);

  useEffect(() => {
    if (checkpoints && checkpoints.length > 0 && playbackPosition < checkpoints.length) {
      setSelectedCheckpoint(checkpoints[playbackPosition]);
    }
  }, [playbackPosition, checkpoints]);

  const getCheckpointIcon = (type: Checkpoint['type']) => {
    switch (type) {
      case 'auto': return Clock;
      case 'manual': return Save;
      case 'git_commit': return GitCommit;
      case 'deploy': return Check;
      default: return FileText;
    }
  };

  const getCheckpointColor = (type: Checkpoint['type']) => {
    switch (type) {
      case 'auto': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'manual': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'git_commit': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'deploy': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created': return <span className="text-green-500">+</span>;
      case 'modified': return <span className="text-yellow-500">~</span>;
      case 'deleted': return <span className="text-red-500">-</span>;
      default: return null;
    }
  };

  return (
    <div className={cn("h-full flex flex-col bg-[var(--ecode-surface)]", className)}>
      <div className="h-9 border-b border-[var(--ecode-border)] flex items-center justify-between px-2.5 bg-[var(--ecode-surface)]">
        <div className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text-muted)]">Rewind</span>
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {checkpoints?.length || 0}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => createCheckpointMutation.mutate('Manual checkpoint')}
          disabled={createCheckpointMutation.isPending}
          className="h-6 px-2 text-[10px] text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
          data-testid="create-checkpoint"
        >
          <Save className="h-3 w-3 mr-1" />
          Save
        </Button>
      </div>

      <div className="p-3 border-b bg-muted/30">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setPlaybackPosition(0)}
            disabled={!checkpoints?.length}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setPlaybackPosition(Math.max(0, playbackPosition - 1))}
            disabled={playbackPosition === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={isPlaying ? "default" : "outline"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={!checkpoints?.length}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setPlaybackPosition(Math.min((checkpoints?.length || 1) - 1, playbackPosition + 1))}
            disabled={playbackPosition >= (checkpoints?.length || 1) - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setPlaybackPosition((checkpoints?.length || 1) - 1)}
            disabled={!checkpoints?.length}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {checkpoints && checkpoints.length > 0 && (
          <div className="space-y-1">
            <Slider
              value={[playbackPosition]}
              onValueChange={([v]) => setPlaybackPosition(v)}
              max={checkpoints.length - 1}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Oldest</span>
              <span>{playbackPosition + 1} of {checkpoints.length}</span>
              <span>Latest</span>
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : checkpoints && checkpoints.length > 0 ? (
          <div className="p-2 space-y-1">
            {checkpoints.map((checkpoint, index) => {
              const Icon = getCheckpointIcon(checkpoint.type);
              const isSelected = selectedCheckpoint?.id === checkpoint.id;
              const isCurrent = index === playbackPosition;

              return (
                <Card
                  key={checkpoint.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    isSelected && "ring-2 ring-primary",
                    isCurrent && "bg-primary/5"
                  )}
                  onClick={() => {
                    setSelectedCheckpoint(checkpoint);
                    setPlaybackPosition(index);
                  }}
                  data-testid={`checkpoint-${checkpoint.id}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <div className={cn("p-1.5 rounded", getCheckpointColor(checkpoint.type))}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-medium truncate">{checkpoint.description}</p>
                          {isCurrent && (
                            <Badge variant="outline" className="text-[10px] shrink-0">Current</Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(checkpoint.timestamp), { addSuffix: true })}
                        </p>
                        {checkpoint.files.length > 0 && (
                          <div className="mt-2 space-y-0.5">
                            {checkpoint.files.slice(0, 3).map((file, i) => (
                              <div key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                {getActionIcon(file.action)}
                                <span className="truncate">{file.path}</span>
                              </div>
                            ))}
                            {checkpoint.files.length > 3 && (
                              <p className="text-[10px] text-muted-foreground">
                                +{checkpoint.files.length - 3} more files
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 p-4 text-center">
            <History className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-[13px] font-medium mb-1">No checkpoints yet</p>
            <p className="text-[11px] text-muted-foreground mb-3">
              Checkpoints are created automatically as you work
            </p>
            <Button variant="outline" size="sm" onClick={() => createCheckpointMutation.mutate('Initial checkpoint')}>
              <Save className="h-3.5 w-3.5 mr-1" />
              Create First Checkpoint
            </Button>
          </div>
        )}
      </ScrollArea>

      {selectedCheckpoint && (
        <div className="p-3 border-t bg-muted/30">
          {showConfirmRestore ? (
            <Alert variant="destructive" className="mb-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-[11px]">
                This will restore your project to this checkpoint. Any unsaved changes will be lost.
              </AlertDescription>
            </Alert>
          ) : null}
          
          <div className="flex gap-2">
            {showConfirmRestore ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowConfirmRestore(false)}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={() => restoreMutation.mutate(selectedCheckpoint.id)}
                  disabled={restoreMutation.isPending}
                >
                  {restoreMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  )}
                  Confirm Restore
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowConfirmRestore(true)}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Restore to This Point
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
