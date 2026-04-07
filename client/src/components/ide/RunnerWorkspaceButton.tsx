// @ts-nocheck
/**
 * RunnerWorkspaceButton
 *
 * Self-contained button that manages the Runner external workspace lifecycle.
 * Renders nothing when the Runner service is not configured on the server.
 */

import { Server, ServerOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useRunnerWorkspace } from '@/hooks/use-runner-workspace';

interface RunnerWorkspaceButtonProps {
  projectId: string;
}

export function RunnerWorkspaceButton({ projectId }: RunnerWorkspaceButtonProps) {
  const {
    isRunnerEnabled,
    isActive,
    isStarting,
    isStopping,
    startWorkspace,
    stopWorkspace,
    workspace,
  } = useRunnerWorkspace(projectId);

  if (!isRunnerEnabled) return null;

  const isBusy = isStarting || isStopping;

  const label = isStopping
    ? 'Stopping…'
    : isStarting
    ? 'Starting…'
    : isActive
    ? 'Workspace running'
    : 'Start workspace';

  const handleClick = () => {
    if (isBusy) return;
    if (isActive) {
      stopWorkspace();
    } else {
      startWorkspace();
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClick}
            disabled={isBusy}
            data-testid="runner-workspace-button"
            className={cn(
              'h-7 px-2 gap-1.5 text-[12px] font-medium rounded-md transition-all',
              isActive
                ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                : 'text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]'
            )}
          >
            {isBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isActive ? (
              <Server className="h-3.5 w-3.5" />
            ) : (
              <ServerOff className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {isStopping ? 'Stopping' : isStarting ? 'Starting' : isActive ? 'VM' : 'VM'}
            </span>
            {isActive && (
              <span className="hidden sm:inline h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {label}
          {workspace?.previewUrl && (
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[200px]">
              {workspace.previewUrl}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
