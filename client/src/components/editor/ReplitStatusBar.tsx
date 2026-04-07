import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  GitBranch,
  AlertCircle,
  AlertTriangle,
  Info,
  Settings,
  Bell,
  Wifi,
  WifiOff,
  Zap,
  Check,
  Loader2,
  Circle,
  Cloud
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

interface ReplitStatusBarProps {
  // File/Editor info
  language?: string;
  lineNumber?: number;
  columnNumber?: number;
  encoding?: string;
  
  // Git info
  gitBranch?: string;
  hasGitChanges?: boolean;
  
  // Problems
  errorCount?: number;
  warningCount?: number;
  infoCount?: number;
  
  // Connection status
  isConnected?: boolean;
  
  // Save status
  saveStatus?: SaveStatus;
  lastSavedAt?: Date | null;
  
  // Callbacks
  onProblemsClick?: () => void;
  onGitClick?: () => void;
  onSettingsClick?: () => void;
  onNotificationsClick?: () => void;
  
  className?: string;
}

export function ReplitStatusBar({
  language = 'plaintext',
  lineNumber = 1,
  columnNumber = 1,
  encoding = 'UTF-8',
  gitBranch,
  hasGitChanges = false,
  errorCount = 0,
  warningCount = 0,
  infoCount = 0,
  isConnected = true,
  saveStatus = 'saved',
  lastSavedAt = null,
  onProblemsClick,
  onGitClick,
  onSettingsClick,
  onNotificationsClick,
  className,
}: ReplitStatusBarProps) {
  const [time, setTime] = useState(new Date());

  const formatLastSaved = (date: Date | null): string => {
    if (!date) return 'Never saved';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffSecs < 5) return 'Just now';
    if (diffSecs < 60) return `${diffSecs} seconds ago`;
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return date.toLocaleString();
  };

  const getSaveStatusDisplay = () => {
    switch (saveStatus) {
      case 'saved':
        return {
          icon: <Check className="h-3.5 w-3.5 text-status-success" />,
          text: 'Saved',
          textColor: 'text-status-success',
          bgColor: 'bg-status-success/10'
        };
      case 'saving':
        return {
          icon: <Loader2 className="h-3.5 w-3.5 text-[var(--ecode-text-secondary)] animate-spin" />,
          text: 'Saving...',
          textColor: 'text-[var(--ecode-text-secondary)]',
          bgColor: 'bg-[var(--ecode-sidebar-hover)]'
        };
      case 'unsaved':
        return {
          icon: <Circle className="h-2.5 w-2.5 fill-status-warning text-status-warning" />,
          text: 'Unsaved',
          textColor: 'text-status-warning',
          bgColor: 'bg-status-warning/10'
        };
    }
  };

  const saveStatusDisplay = getSaveStatusDisplay();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className={cn(
        "h-7 bg-[var(--ecode-surface)] border-t border-[var(--ecode-border)] flex items-center justify-between px-3 flex-shrink-0 text-[11px] font-[family-name:var(--ecode-font-sans)]",
        className
      )}
      data-testid="status-bar"
    >
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Git Branch */}
        {gitBranch && (
          <button
            onClick={onGitClick}
            className="flex items-center gap-1.5 hover:bg-[var(--ecode-sidebar-hover)] px-1.5 py-0.5 rounded transition-colors"
            data-testid="status-bar-git"
          >
            <GitBranch className="h-3.5 w-3.5 text-[var(--ecode-text-secondary)]" />
            <span className="text-[var(--ecode-text)]">{gitBranch}</span>
            {hasGitChanges && (
              <div className="w-1.5 h-1.5 rounded-full bg-status-warning" />
            )}
          </button>
        )}

        {/* Problems Counter */}
        {(errorCount > 0 || warningCount > 0 || infoCount > 0) && (
          <button
            onClick={onProblemsClick}
            className="flex items-center gap-2 hover:bg-[var(--ecode-sidebar-hover)] px-1.5 py-0.5 rounded transition-colors"
            data-testid="status-bar-problems"
          >
            {errorCount > 0 && (
              <div className="flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 text-status-critical" />
                <span className="text-[var(--ecode-text)]">{errorCount}</span>
              </div>
            )}
            {warningCount > 0 && (
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-status-warning" />
                <span className="text-[var(--ecode-text)]">{warningCount}</span>
              </div>
            )}
            {infoCount > 0 && (
              <div className="flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-status-info" />
                <span className="text-[var(--ecode-text)]">{infoCount}</span>
              </div>
            )}
          </button>
        )}

        {/* Connection Status */}
        <HoverCard>
          <HoverCardTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-default">
              {isConnected ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-status-success" />
                  <span className="text-[var(--ecode-text-secondary)]">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-status-critical" />
                  <span className="text-status-critical">Disconnected</span>
                </>
              )}
            </div>
          </HoverCardTrigger>
          <HoverCardContent side="top" className="w-60">
            <div className="text-[11px] space-y-1">
              <p className="font-semibold">Connection Status</p>
              <p className="text-[var(--ecode-text-secondary)]">
                {isConnected
                  ? 'Real-time collaboration and auto-save are active'
                  : 'Connection lost. Changes may not be saved.'}
              </p>
            </div>
          </HoverCardContent>
        </HoverCard>

        {/* Auto-save Status Indicator */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded cursor-default transition-colors",
                  saveStatusDisplay.bgColor
                )}
                data-testid="status-bar-save-indicator"
              >
                <Cloud className="h-3.5 w-3.5 text-[var(--ecode-text-secondary)]" />
                {saveStatusDisplay.icon}
                <span className={cn("text-[11px] font-medium", saveStatusDisplay.textColor)}>
                  {saveStatusDisplay.text}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="text-[11px] space-y-1">
                <p className="font-semibold">Auto-save Status</p>
                <p className="text-muted-foreground">
                  {saveStatus === 'saved' && `Last saved: ${formatLastSaved(lastSavedAt)}`}
                  {saveStatus === 'saving' && 'Syncing your changes to the cloud...'}
                  {saveStatus === 'unsaved' && 'You have unsaved changes that will be synced automatically'}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* File Position */}
        <div className="flex items-center gap-3 text-[var(--ecode-text-secondary)]">
          <span>Ln {lineNumber}, Col {columnNumber}</span>
          <span className="uppercase">{language}</span>
          <span>{encoding}</span>
        </div>

        {/* Performance Indicator */}
        <HoverCard>
          <HoverCardTrigger asChild>
            <div className="flex items-center gap-1 cursor-default">
              <Zap className="h-3.5 w-3.5 text-status-warning" />
            </div>
          </HoverCardTrigger>
          <HoverCardContent side="top" className="w-48">
            <div className="text-[11px] space-y-1">
              <p className="font-semibold">Performance</p>
              <p className="text-[var(--ecode-text-secondary)]">
                Editor is running smoothly
              </p>
            </div>
          </HoverCardContent>
        </HoverCard>

        {/* Notifications */}
        <button
          onClick={onNotificationsClick}
          className="hover:bg-[var(--ecode-sidebar-hover)] p-1 rounded transition-colors"
          data-testid="status-bar-notifications"
        >
          <Bell className="h-3.5 w-3.5 text-[var(--ecode-text-secondary)]" />
        </button>

        {/* Settings */}
        <button
          onClick={onSettingsClick}
          className="hover:bg-[var(--ecode-sidebar-hover)] p-1 rounded transition-colors"
          data-testid="status-bar-settings"
        >
          <Settings className="h-3.5 w-3.5 text-[var(--ecode-text-secondary)]" />
        </button>

        {/* Time */}
        <span className="text-[var(--ecode-text-secondary)] tabular-nums">
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
