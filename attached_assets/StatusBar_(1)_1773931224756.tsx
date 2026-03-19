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
  lastSaved?: Date;
  deploymentStatus?: DeploymentStatus;
  deploymentUrl?: string;
  onDeployClick?: () => void;
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
          'h-[20px] flex items-center text-[10px]',
          'bg-[var(--ecode-surface)] border-t border-[var(--ecode-border)]',
          'font-[var(--ecode-font-sans)]'
        )}
        data-testid="status-bar"
      >
        {/* Left Section */}
        <div className="flex items-center h-full">
          {/* Git Branch */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className={cn(
                  'flex items-center gap-1 h-full px-2',
                  'text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)]',
                  'hover:bg-[var(--ecode-sidebar-hover)] transition-colors'
                )}
                data-testid="status-git-branch"
              >
                <GitBranch className="h-2.5 w-2.5" />
                <span className="font-medium">{gitBranch}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">
              Current branch: {gitBranch}
            </TooltipContent>
          </Tooltip>
          
          {/* Connection Status */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className={cn(
                  'flex items-center gap-1 h-full px-1.5',
                  'hover:bg-[var(--ecode-sidebar-hover)] transition-colors cursor-default'
                )}
              >
                {isConnected ? (
                  <Wifi className="h-2.5 w-2.5 text-[hsl(142,72%,42%)]" />
                ) : (
                  <WifiOff className="h-2.5 w-2.5 text-red-500" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">
              {isConnected ? 'Connected' : 'Disconnected'}
            </TooltipContent>
          </Tooltip>
          
          {/* Running Status */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className={cn(
                  'flex items-center gap-1 h-full px-1.5',
                  'hover:bg-[var(--ecode-sidebar-hover)] transition-colors cursor-default'
                )}
                data-testid="status-running"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-2.5 w-2.5 text-[hsl(142,72%,42%)] animate-spin" />
                    <span className="text-[hsl(142,72%,42%)]">Running</span>
                  </>
                ) : (
                  <>
                    <Circle className="h-2 w-2 fill-[var(--ecode-text-muted)] text-[var(--ecode-text-muted)]" />
                    <span className="text-[var(--ecode-text-muted)]">Stopped</span>
                  </>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">
              {isRunning ? 'Server is running' : 'Server is stopped'}
            </TooltipContent>
          </Tooltip>
          
          {/* Problems */}
          {(problems.errors > 0 || problems.warnings > 0) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  className={cn(
                    'flex items-center gap-1.5 h-full px-2',
                    'hover:bg-[var(--ecode-sidebar-hover)] transition-colors'
                  )}
                  data-testid="status-problems"
                >
                  {problems.errors > 0 && (
                    <span className="flex items-center gap-0.5 text-[hsl(var(--ecode-danger))]">
                      <AlertCircle className="h-3 w-3" />
                      {problems.errors}
                    </span>
                  )}
                  {problems.warnings > 0 && (
                    <span className="flex items-center gap-0.5 text-[hsl(var(--ecode-warning))]">
                      <AlertCircle className="h-3 w-3" />
                      {problems.warnings}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[11px]">
                {problems.errors} errors, {problems.warnings} warnings
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Deployment Status */}
          {deploymentStatus !== 'idle' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={onDeployClick}
                  className={cn(
                    'flex items-center gap-1.5 h-full px-2',
                    'hover:bg-[var(--ecode-sidebar-hover)] transition-colors'
                  )}
                  data-testid="status-deployment"
                >
                  {deploymentStatus === 'deploying' && (
                    <>
                      <Loader2 className="h-3 w-3 text-[hsl(var(--ecode-accent))] animate-spin" />
                      <span className="text-[hsl(var(--ecode-accent))]">Deploying...</span>
                    </>
                  )}
                  {deploymentStatus === 'live' && (
                    <>
                      <Globe className="h-3 w-3 text-[hsl(var(--ecode-green))]" />
                      <span className="text-[hsl(var(--ecode-green))]">Live</span>
                    </>
                  )}
                  {deploymentStatus === 'failed' && (
                    <>
                      <XCircle className="h-3 w-3 text-[hsl(var(--ecode-danger))]" />
                      <span className="text-[hsl(var(--ecode-danger))]">Failed</span>
                    </>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[11px]">
                {deploymentStatus === 'deploying' && 'Deployment in progress...'}
                {deploymentStatus === 'live' && (deploymentUrl ? `Live at ${deploymentUrl}` : 'Deployment is live')}
                {deploymentStatus === 'failed' && 'Deployment failed - click to view logs'}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        
        {/* Spacer */}
        <div className="flex-1" />
        
        {/* Right Section */}
        <div className="flex items-center h-full">
          {/* Last Saved */}
          {lastSaved && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className={cn(
                    'flex items-center gap-1 h-full px-2',
                    'text-[var(--ecode-text-muted)]',
                    'hover:bg-[var(--ecode-sidebar-hover)] transition-colors cursor-default'
                  )}
                >
                  <CheckCircle className="h-3 w-3 text-[hsl(var(--ecode-green))]" />
                  <span>{formatTime(lastSaved)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[11px]">
                Last saved: {lastSaved.toLocaleString()}
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Resource Usage */}
          {(cpuUsage !== undefined || memoryUsage !== undefined) && (
            <div className="flex items-center gap-2 h-full px-2 text-[var(--ecode-text-muted)]">
              {cpuUsage !== undefined && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 cursor-default">
                      <Cpu className="h-3 w-3" />
                      {cpuUsage}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[11px]">
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
                  <TooltipContent side="top" className="text-[11px]">
                    Memory Usage: {memoryUsage}%
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
          
          {/* Cursor Position */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className={cn(
                  'flex items-center gap-1 h-full px-1.5',
                  'text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)]',
                  'hover:bg-[var(--ecode-sidebar-hover)] transition-colors',
                  'font-mono text-[9px]'
                )}
                data-testid="status-cursor"
              >
                <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">
              Go to Line
            </TooltipContent>
          </Tooltip>
          
          {/* Language */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className={cn(
                  'flex items-center h-full px-1.5',
                  'text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)]',
                  'hover:bg-[var(--ecode-sidebar-hover)] transition-colors'
                )}
                data-testid="status-language"
              >
                {language}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">
              Select Language Mode
            </TooltipContent>
          </Tooltip>
          
          {/* Encoding */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className={cn(
                  'flex items-center h-full px-1.5',
                  'text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)]',
                  'hover:bg-[var(--ecode-sidebar-hover)] transition-colors'
                )}
                data-testid="status-encoding"
              >
                {encoding}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">
              Select Encoding
            </TooltipContent>
          </Tooltip>
          
          {/* Notifications */}
          {notifications > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  className={cn(
                    'flex items-center gap-1 h-full px-2',
                    'text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)]',
                    'hover:bg-[var(--ecode-sidebar-hover)] transition-colors'
                  )}
                >
                  <Bell className="h-3 w-3" />
                  <span className="font-medium">{notifications}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[11px]">
                {notifications} notification{notifications > 1 ? 's' : ''}
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Shortcuts Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onShowShortcuts}
                data-testid="button-show-shortcuts"
                className={cn(
                  'h-full px-2 rounded-none',
                  'text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)]',
                  'hover:bg-[var(--ecode-sidebar-hover)]'
                )}
              >
                <Command className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[11px]">
              Keyboard Shortcuts
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
