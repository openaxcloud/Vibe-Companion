import { cn } from '@/lib/utils';
import { GitBranch, AlertCircle, Wifi, WifiOff, Keyboard, Wand2, Rocket } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StatusBarProps {
  gitBranch: string;
  isRunning: boolean;
  cursorPosition: { line: number; column: number };
  language?: string;
  encoding?: string;
  onShowShortcuts?: () => void;
  isConnected?: boolean;
  lastSaved?: Date | null;
  problems?: { errors: number; warnings: number };
  deploymentStatus?: 'idle' | 'deploying' | 'live' | 'failed';
  deploymentUrl?: string;
  onDeployClick?: () => void;
  wsStatus?: string;
  onStartWorkspace?: () => void;
  onStopWorkspace?: () => void;
  wsLoading?: boolean;
}

export function StatusBar({
  gitBranch,
  isRunning,
  cursorPosition,
  language = 'TypeScript',
  encoding = 'UTF-8',
  onShowShortcuts,
  isConnected = true,
  problems = { errors: 0, warnings: 0 },
  deploymentStatus = 'idle',
  onDeployClick,
  wsStatus,
  onStartWorkspace,
  onStopWorkspace,
  wsLoading,
}: StatusBarProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center justify-between px-2 h-6 bg-[var(--ide-bg)] border-t border-[var(--ide-border)]/60 shrink-0">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex items-center gap-1 px-1.5 h-5 rounded text-[10px] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]/60 hover:text-[var(--ide-text)] transition-colors" data-testid="button-git-branch">
                <GitBranch className="w-3 h-3" />
                <span className="font-medium">{gitBranch}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
              Current branch: {gitBranch}
            </TooltipContent>
          </Tooltip>

          <span className="w-px h-3 bg-[var(--ide-surface)]" />

          <button className="flex items-center gap-1 px-1.5 h-5 rounded text-[10px] text-[var(--ide-text-muted)] hover:bg-[var(--ide-surface)]/60 hover:text-[var(--ide-text)] transition-colors" data-testid="button-problems">
            <AlertCircle className="w-3 h-3" />
            <span>{problems.errors}</span>
            <span className="text-[var(--ide-text-muted)]">·</span>
            <span>{problems.warnings}</span>
          </button>

          <span className="w-px h-3 bg-[var(--ide-surface)]" />

          <span className="flex items-center gap-1.5 text-[10px] text-[var(--ide-text-muted)]">
            <span className={cn(
              'w-[5px] h-[5px] rounded-full',
              isRunning
                ? 'bg-[#0CCE6B] shadow-[0_0_6px_rgba(12,206,107,0.6)] animate-pulse'
                : isConnected
                  ? 'bg-[#4A5068]'
                  : 'bg-red-400 animate-pulse'
            )} />
            {isRunning ? 'Running' : isConnected ? 'Ready' : 'Offline'}
          </span>

          <span className="flex items-center gap-1 text-[10px] text-[var(--ide-text-muted)]">
            {isConnected ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5 text-red-400" />}
            {isConnected ? 'WS' : 'Off'}
          </span>

          {deploymentStatus === 'live' && (
            <>
              <span className="w-px h-3 bg-[var(--ide-surface)]" />
              <button
                onClick={onDeployClick}
                className="flex items-center gap-1 px-1.5 h-5 rounded text-[10px] text-[#0CCE6B] hover:bg-[#0CCE6B]/10 transition-colors"
                data-testid="status-deployment"
              >
                <Rocket className="w-2.5 h-2.5" />
                <span className="font-medium">Live</span>
              </button>
            </>
          )}

          {wsStatus && wsStatus !== 'none' && (
            <>
              <span className="w-px h-3 bg-[var(--ide-surface)]" />
              <button
                onClick={wsStatus === 'running' ? onStopWorkspace : onStartWorkspace}
                disabled={wsLoading}
                className={cn(
                  'flex items-center gap-1 px-1.5 h-5 rounded text-[10px] transition-colors',
                  wsStatus === 'running' ? 'text-[#0CCE6B] hover:bg-[#0CCE6B]/10' : 'text-[var(--ide-text-muted)] hover:bg-[var(--ide-surface)]/60',
                )}
                data-testid="status-workspace"
              >
                <span className={cn(
                  'w-[5px] h-[5px] rounded-full',
                  wsStatus === 'running' ? 'bg-[#0CCE6B]' : wsStatus === 'starting' ? 'bg-amber-400 animate-pulse' : wsStatus === 'error' ? 'bg-red-400' : 'bg-[var(--ide-text-muted)]',
                )} />
                <span className="font-medium capitalize">{wsLoading ? 'Loading...' : `WS: ${wsStatus}`}</span>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--ide-text-secondary)]" data-testid="text-cursor-position">
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
          <span className="text-[10px] text-[var(--ide-text-secondary)] capitalize">{language}</span>
          <span className="text-[10px] text-[var(--ide-text-muted)]">{encoding}</span>
          <span className="text-[10px] text-[var(--ide-text-muted)]">LF</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex items-center gap-1 px-1.5 h-5 rounded text-[10px] text-[var(--ide-text-muted)] hover:bg-[var(--ide-surface)]/60 transition-colors" data-testid="button-prettier">
                <Wand2 className="w-3 h-3" />
                <span>Prettier</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
              Format Document
            </TooltipContent>
          </Tooltip>
          <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1">
            <svg width="9" height="9" viewBox="0 0 32 32" fill="none">
              <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="currentColor"/>
              <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="currentColor"/>
              <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="currentColor"/>
            </svg>
            E-Code
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}
