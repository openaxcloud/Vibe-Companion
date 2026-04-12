import { Button } from '@/components/ui/button';
import {
  Command,
  Circle,
  GitBranch,
  Wifi,
  WifiOff,
  Bell,
  AlertCircle,
  CheckCircle,
  Loader2,
  Cpu,
  HardDrive,
  Clock,
  Rocket,
  Globe,
  XCircle,
} from 'lucide-react';
import { Code2, Braces } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type DeploymentStatus = 'idle' | 'deploying' | 'live' | 'failed';

interface StatusBarProps {
  gitBranch: string;
  isRunning: boolean;
  cursorPosition: { line: number; column: number };
  language: string;
  encoding: string;
  onShowShortcuts: () => void;
  notifications?: number;
  problems?: { errors: number; warnings: number };
  isConnected?: boolean;
  cpuUsage?: number;
  memoryUsage?: number;
  lastSaved?: Date | null;
  deploymentStatus?: DeploymentStatus;
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
  language,
  encoding,
  onShowShortcuts,
  notifications = 0,
  problems = { errors: 0, warnings: 0 },
  isConnected = true,
  cpuUsage,
  memoryUsage,
  lastSaved,
  deploymentStatus = 'idle',
  deploymentUrl,
  onDeployClick,
  wsStatus,
  onStartWorkspace,
  onStopWorkspace,
  wsLoading,
}: StatusBarProps) {
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <TooltipProvider>
      <div
        className={cn(
          'h-[22px] flex items-center text-[10px]',
          'bg-[var(--ide-bg)] border-t border-[var(--ide-border)]',
          'shrink-0'
        )}
        data-testid="status-bar"
      >
        <div className="flex items-center h-full">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-1 h-full px-2',
                  'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]',
                  'hover:bg-[var(--ide-surface)] transition-colors'
                )}
                data-testid="status-git-branch"
              >
                <GitBranch className="h-2.5 w-2.5" />
                <span className="font-medium">{gitBranch}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
              Current branch: {gitBranch}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'flex items-center gap-1 h-full px-1.5',
                  'hover:bg-[var(--ide-surface)] transition-colors cursor-default'
                )}
              >
                {isConnected ? (
                  <Wifi className="h-2.5 w-2.5 text-[#0CCE6B]" />
                ) : (
                  <WifiOff className="h-2.5 w-2.5 text-red-500" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
              {isConnected ? 'Connected' : 'Disconnected'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'flex items-center gap-1 h-full px-1.5',
                  'hover:bg-[var(--ide-surface)] transition-colors cursor-default'
                )}
                data-testid="status-running"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-2.5 w-2.5 text-[#0CCE6B] animate-spin" />
                    <span className="text-[#0CCE6B]">Running</span>
                  </>
                ) : (
                  <>
                    <Circle className="h-2 w-2 fill-[var(--ide-text-muted)] text-[var(--ide-text-muted)]" />
                    <span className="text-[var(--ide-text-muted)]">Stopped</span>
                  </>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
              {isRunning ? 'Server is running' : 'Server is stopped'}
            </TooltipContent>
          </Tooltip>

          {(problems.errors > 0 || problems.warnings > 0) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-1.5 h-full px-2',
                    'hover:bg-[var(--ide-surface)] transition-colors'
                  )}
                  data-testid="status-problems"
                >
                  {problems.errors > 0 && (
                    <span className="flex items-center gap-0.5 text-red-500">
                      <AlertCircle className="h-3 w-3" />
                      {problems.errors}
                    </span>
                  )}
                  {problems.warnings > 0 && (
                    <span className="flex items-center gap-0.5 text-amber-500">
                      <AlertCircle className="h-3 w-3" />
                      {problems.warnings}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[11px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
                {problems.errors} errors, {problems.warnings} warnings
              </TooltipContent>
            </Tooltip>
          )}

          {deploymentStatus !== 'idle' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onDeployClick}
                  className={cn(
                    'flex items-center gap-1.5 h-full px-2',
                    'hover:bg-[var(--ide-surface)] transition-colors'
                  )}
                  data-testid="status-deployment"
                >
                  {deploymentStatus === 'deploying' && (
                    <>
                      <Loader2 className="h-3 w-3 text-[#7C65CB] animate-spin" />
                      <span className="text-[#7C65CB]">Deploying...</span>
                    </>
                  )}
                  {deploymentStatus === 'live' && (
                    <>
                      <Globe className="h-3 w-3 text-[#0CCE6B]" />
                      <span className="text-[#0CCE6B]">Live</span>
                    </>
                  )}
                  {deploymentStatus === 'failed' && (
                    <>
                      <XCircle className="h-3 w-3 text-red-500" />
                      <span className="text-red-500">Failed</span>
                    </>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[11px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
                {deploymentStatus === 'deploying' && 'Deployment in progress...'}
                {deploymentStatus === 'live' && (deploymentUrl ? `Live at ${deploymentUrl}` : 'Deployment is live')}
                {deploymentStatus === 'failed' && 'Deployment failed - click to view logs'}
              </TooltipContent>
            </Tooltip>
          )}

          {wsStatus && wsStatus !== 'none' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={wsStatus === 'running' ? onStopWorkspace : onStartWorkspace}
                  disabled={wsLoading}
                  className={cn(
                    'flex items-center gap-1 h-full px-1.5 transition-colors',
                    wsStatus === 'running' ? 'text-[#0CCE6B] hover:bg-[#0CCE6B]/10' : 'text-[var(--ide-text-muted)] hover:bg-[var(--ide-surface)]',
                  )}
                  data-testid="status-workspace"
                >
                  <span className={cn(
                    'w-[5px] h-[5px] rounded-full',
                    wsStatus === 'running' ? 'bg-[#0CCE6B]' : wsStatus === 'starting' ? 'bg-amber-400 animate-pulse' : wsStatus === 'error' ? 'bg-red-400' : 'bg-[var(--ide-text-muted)]',
                  )} />
                  <span className="font-medium capitalize">{wsLoading ? 'Loading...' : `WS: ${wsStatus}`}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
                {wsStatus === 'running' ? 'Click to stop workspace' : 'Click to start workspace'}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center h-full">
          {lastSaved && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'flex items-center gap-1 h-full px-2',
                    'text-[var(--ide-text-muted)]',
                    'hover:bg-[var(--ide-surface)] transition-colors cursor-default'
                  )}
                >
                  <CheckCircle className="h-3 w-3 text-[#0CCE6B]" />
                  <span>{formatTime(lastSaved)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[11px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
                Last saved: {lastSaved.toLocaleString()}
              </TooltipContent>
            </Tooltip>
          )}

          {(cpuUsage !== undefined || memoryUsage !== undefined) && (
            <div className="flex items-center gap-2 h-full px-2 text-[var(--ide-text-muted)]">
              {cpuUsage !== undefined && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 cursor-default">
                      <Cpu className="h-3 w-3" />
                      {cpuUsage}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[11px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
                    CPU Usage: {cpuUsage}%
                  </TooltipContent>
                </Tooltip>
              )}
              {memoryUsage !== undefined && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 cursor-default">
                      <HardDrive className="h-3 w-3" />
                      {memoryUsage}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[11px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
                    Memory Usage: {memoryUsage}%
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-1 h-full px-1.5',
                  'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]',
                  'hover:bg-[var(--ide-surface)] transition-colors',
                  'font-mono text-[9px]'
                )}
                data-testid="status-cursor"
              >
                <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
              Go to Line
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  'flex items-center h-full px-1.5',
                  'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]',
                  'hover:bg-[var(--ide-surface)] transition-colors'
                )}
                data-testid="status-language"
              >
                {language}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
              Select Language Mode
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  'flex items-center h-full px-1.5',
                  'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]',
                  'hover:bg-[var(--ide-surface)] transition-colors'
                )}
                data-testid="status-encoding"
              >
                {encoding}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
              Select Encoding
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-1 h-full px-1.5',
                  'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]',
                  'hover:bg-[var(--ide-surface)] transition-colors'
                )}
                onClick={() => {
                  const current = localStorage.getItem('editor-engine') || 'monaco';
                  const next = current === 'monaco' ? 'codemirror' : 'monaco';
                  localStorage.setItem('editor-engine', next);
                  window.location.reload();
                }}
                data-testid="status-editor-engine"
              >
                {(localStorage.getItem('editor-engine') || 'monaco') === 'monaco' ? (
                  <><Code2 className="h-3 w-3 text-blue-400" /><span>Monaco</span></>
                ) : (
                  <><Braces className="h-3 w-3 text-green-400" /><span>CodeMirror</span></>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
              Switch Editor Engine (Monaco / CodeMirror)
            </TooltipContent>
          </Tooltip>

          {notifications > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-1 h-full px-2',
                    'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]',
                    'hover:bg-[var(--ide-surface)] transition-colors'
                  )}
                >
                  <Bell className="h-3 w-3" />
                  <span className="font-medium">{notifications}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[11px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
                {notifications} notification{notifications > 1 ? 's' : ''}
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onShowShortcuts}
                data-testid="button-show-shortcuts"
                className={cn(
                  'h-full px-2 rounded-none',
                  'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]',
                  'hover:bg-[var(--ide-surface)]'
                )}
              >
                <Command className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[11px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
              Keyboard Shortcuts
            </TooltipContent>
          </Tooltip>

          <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1 px-2">
            <img src="/logo.png" alt="Vibe Companion" width={9} height={9} className="rounded" style={{ objectFit: 'contain' }} />
            Vibe Companion
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}
