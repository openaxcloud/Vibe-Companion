import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Play, Square, ChevronRight, ChevronDown, Loader2, Eye, Rocket,
  Users, MoreHorizontal, Settings, Download, Search, Terminal,
  FolderOpen, PanelLeftOpen, PanelLeftClose,
} from 'lucide-react';
import type { TabItem } from '@/hooks';

interface TopNavBarProps {
  projectName: string;
  projectDescription?: string;
  projectSlug: string;
  ownerUsername: string;
  projectId: string;
  isDeployed: boolean;
  onRun: () => void;
  isRunning: boolean;
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabReorder: (from: number, to: number) => void;
  onOpenToolsSheet: () => void;
  availableTools: string[];
  onAddTool: (tool: string) => void;
  showFileExplorer: boolean;
  onToggleFileExplorer: () => void;
  showCollaboration?: boolean;
  onToggleCollaboration?: () => void;
  collaboratorCount?: number;
  onOpenDeployLogs?: () => void;
  onOpenDeployAnalytics?: () => void;
  showTabs?: boolean;
  onOpenCommandPalette?: () => void;
  onOpenGlobalSearch?: () => void;
}

export function TopNavBar({
  projectName,
  projectSlug,
  ownerUsername,
  projectId,
  onRun,
  isRunning,
  showFileExplorer,
  onToggleFileExplorer,
  onOpenCommandPalette,
  onOpenGlobalSearch,
}: TopNavBarProps) {
  return (
    <div className="flex items-center h-11 px-3 bg-[var(--ide-bg)] border-b border-[var(--ide-border)] shrink-0 z-40">
      {/* Left: Logo + Project Name */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 hover:bg-[var(--ide-surface)] transition-colors group"
          onClick={() => window.location.href = '/dashboard'}
          title="Home"
          data-testid="button-back"
        >
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none" className="group-hover:scale-110 transition-transform">
            <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#F26522"/>
            <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#F26522"/>
            <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#F26522"/>
          </svg>
        </button>
        <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />
        <span className="text-[13px] font-medium text-[var(--ide-text)] truncate max-w-[180px]" data-testid="text-project-name">
          {projectName}
        </span>
      </div>

      {/* Center: Run Controls */}
      <div className="flex items-center justify-center gap-1.5">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                className={cn(
                  'h-7 px-4 text-[11px] font-semibold rounded-full gap-1.5 transition-all duration-150',
                  isRunning
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                    : 'bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] shadow-[0_0_12px_rgba(12,206,107,0.3)]'
                )}
                onClick={onRun}
                data-testid="button-run"
              >
                {isRunning ? (
                  <><Square className="w-3 h-3 fill-current" /> Stop</>
                ) : (
                  <><Play className="w-3 h-3 fill-current" /> Run</>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">
              {isRunning ? 'Stop (F5)' : 'Run (F5)'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center justify-end gap-1 flex-1">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded-md"
                onClick={onOpenCommandPalette}
                data-testid="button-command-palette"
              >
                <Search className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">
              Command Palette (⌘K)
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded-md"
                onClick={onToggleFileExplorer}
                data-testid="button-toggle-files"
              >
                {showFileExplorer ? <PanelLeftClose className="w-3.5 h-3.5" /> : <FolderOpen className="w-3.5 h-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">
              {showFileExplorer ? 'Hide Files' : 'Show Files'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
