import { useState } from 'react';
import { Check, RotateCcw, Code2, Eye, ChevronDown, ChevronUp, Clock, FileCode, GitCommit, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { formatDistanceToNow } from 'date-fns';

interface CheckpointStats {
  timeWorked?: string;
  workDone?: number;
  itemsRead?: number;
  codeChangedAdd?: number;
  codeChangedRemove?: number;
  agentUsage?: number;
}

interface InlineChatCheckpointProps {
  id: number;
  description: string;
  createdAt: string | Date;
  status: 'complete' | 'pending' | 'creating' | 'failed';
  commitId?: string;
  stats?: CheckpointStats;
  onRollback?: (id: number) => void;
  onViewChanges?: (id: number) => void;
  onPreview?: (id: number) => void;
  isRestoring?: boolean;
  className?: string;
}

export function InlineChatCheckpoint({
  id,
  description,
  createdAt,
  status,
  commitId,
  stats,
  onRollback,
  onViewChanges,
  onPreview,
  isRestoring = false,
  className,
}: InlineChatCheckpointProps) {
  const [showStats, setShowStats] = useState(false);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);

  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  
  const statusIcon = {
    complete: <Check className="h-4 w-4 text-green-600" />,
    pending: <Clock className="h-4 w-4 text-yellow-600 animate-pulse" />,
    creating: <Clock className="h-4 w-4 text-blue-600 animate-spin" />,
    failed: <Clock className="h-4 w-4 text-red-600" />,
  };

  const handleRollback = () => {
    setShowRollbackDialog(false);
    onRollback?.(id);
  };

  return (
    <>
      <Card 
        className={cn(
          "bg-muted/50 border-border/50 p-4 rounded-xl",
          className
        )}
        data-testid={`inline-checkpoint-${id}`}
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className={cn(
              "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
              status === 'complete' && "bg-green-100 dark:bg-green-900/30",
              status === 'pending' && "bg-yellow-100 dark:bg-yellow-900/30",
              status === 'creating' && "bg-blue-100 dark:bg-blue-900/30",
              status === 'failed' && "bg-red-100 dark:bg-red-900/30",
            )}>
              {statusIcon[status]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground mb-1" data-testid={`checkpoint-time-${id}`}>
                {timeAgo}
              </p>
              <p className="text-[13px] font-medium text-foreground leading-snug" data-testid={`checkpoint-description-${id}`}>
                {description}
              </p>
              {commitId && (
                <div className="flex items-center gap-1 mt-1">
                  <GitCommit className="h-3 w-3 text-muted-foreground" />
                  <code className="text-[10px] text-muted-foreground font-mono">
                    {commitId.slice(0, 7)}
                  </code>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-3 text-[11px] font-medium bg-background hover:bg-muted border border-border"
              onClick={() => setShowRollbackDialog(true)}
              disabled={isRestoring || status !== 'complete'}
              data-testid={`button-rollback-${id}`}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Rollback here
            </Button>
            
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-3 text-[11px] font-medium bg-background hover:bg-muted border border-border"
              onClick={() => onViewChanges?.(id)}
              disabled={!commitId}
              data-testid={`button-changes-${id}`}
            >
              <Code2 className="h-3.5 w-3.5 mr-1.5" />
              Changes
            </Button>
            
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-3 text-[11px] font-medium bg-background hover:bg-muted border border-border"
              onClick={() => onPreview?.(id)}
              data-testid={`button-preview-${id}`}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Preview
            </Button>
          </div>
        </div>

        {stats && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <button
              onClick={() => setShowStats(!showStats)}
              className="flex items-center justify-between w-full text-left hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
              data-testid={`button-toggle-stats-${id}`}
            >
              <span className="text-[13px] text-muted-foreground flex items-center gap-2">
                <FileCode className="h-4 w-4" />
                {showStats ? 'Show less' : 'Show more'}
              </span>
              {showStats ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            
            {showStats && (
              <div className="mt-3 space-y-2 text-[13px]">
                {stats.timeWorked && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Time worked</span>
                    <span className="font-medium">{stats.timeWorked}</span>
                  </div>
                )}
                {stats.workDone !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Work done</span>
                    <span className="font-medium">{stats.workDone} actions</span>
                  </div>
                )}
                {stats.itemsRead !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Items read</span>
                    <span className="font-medium">{stats.itemsRead} lines</span>
                  </div>
                )}
                {(stats.codeChangedAdd !== undefined || stats.codeChangedRemove !== undefined) && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Code changed</span>
                    <span className="font-medium">
                      <span className="text-green-600">+{stats.codeChangedAdd || 0}</span>
                      {' '}
                      <span className="text-red-600">-{stats.codeChangedRemove || 0}</span>
                    </span>
                  </div>
                )}
                {stats.agentUsage !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      Agent Usage
                      <ChevronDown className="h-3 w-3" />
                    </span>
                    <span className="font-medium">${stats.agentUsage.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      <AlertDialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback to this checkpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore your project to the state it was in when this checkpoint was created.
              Any changes made after this point will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRollback} disabled={isRestoring}>
              {isRestoring ? 'Rolling back...' : 'Rollback'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function CollapsedCheckpointMessage({
  messageCount,
  actionCount,
  summary,
  checkpoint,
  onExpand,
  className,
}: {
  messageCount: number;
  actionCount: number;
  summary: string;
  checkpoint?: InlineChatCheckpointProps;
  onExpand?: () => void;
  className?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={cn("space-y-3", className)} data-testid="collapsed-checkpoint-message">
      <button
        onClick={() => {
          setIsExpanded(!isExpanded);
          onExpand?.();
        }}
        className="flex items-center justify-between w-full text-left hover:bg-muted/30 rounded-lg p-2 -mx-2 transition-colors"
        data-testid="button-expand-message"
      >
        <span className="text-[13px] text-muted-foreground">
          {messageCount} message{messageCount !== 1 ? 's' : ''} & {actionCount} action{actionCount !== 1 ? 's' : ''}
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      
      {!isExpanded && (
        <p className="text-[13px] text-foreground line-clamp-2" data-testid="message-summary">
          {summary}
        </p>
      )}
      
      {checkpoint && (
        <InlineChatCheckpoint {...checkpoint} />
      )}
    </div>
  );
}

export default InlineChatCheckpoint;
