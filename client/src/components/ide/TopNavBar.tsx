import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Play,
  Square,
  Settings,
  User,
  LogOut,
  X,
  Menu,
  FileCode,
  Home,
  Shield,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  Users,
  Search,
  Rocket,
  FolderOpen,
  PanelLeftClose,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/components/ThemeProvider';
import { useLocation } from 'wouter';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Tab {
  id: string;
  label: string;
  icon?: any;
  closable?: boolean;
}

interface TopNavBarProps {
  projectName: string;
  projectDescription?: string;
  projectSlug: string;
  ownerUsername: string;
  projectId: string;
  isDeployed: boolean;
  onRun: () => void;
  isRunning: boolean;
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabReorder?: (fromIndex: number, toIndex: number) => void;
  onAddTab?: () => void;
  onOpenToolsSheet?: () => void;
  availableTools?: string[];
  onAddTool?: (toolId: string) => void;
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
  onProjectSettings?: () => void;
  onPublish?: () => void;
  onInvite?: () => void;
  onFork?: () => void;
}

export function TopNavBar({
  projectName,
  projectDescription,
  projectSlug,
  ownerUsername,
  projectId,
  isDeployed,
  onRun,
  isRunning,
  tabs,
  activeTab,
  onTabChange,
  onTabClose,
  onTabReorder,
  onAddTab,
  onOpenToolsSheet,
  availableTools,
  onAddTool,
  showFileExplorer,
  onToggleFileExplorer,
  showCollaboration,
  onToggleCollaboration,
  collaboratorCount = 0,
  onOpenDeployLogs,
  onOpenDeployAnalytics,
  showTabs = true,
  onOpenCommandPalette,
  onOpenGlobalSearch,
  onProjectSettings,
  onPublish,
  onInvite,
  onFork,
}: TopNavBarProps) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [, navigate] = useLocation();
  const [showSettings, setShowSettings] = useState(false);

  const handleLogout = async () => {
    logout.mutate();
    navigate('/login');
  };

  const isAdmin = (user as any)?.role === 'admin' || (user as any)?.role === 'super_admin' || (user as any)?.isAdmin;

  return (
    <div className="h-11 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] flex items-center px-2 gap-1 shrink-0 z-40" data-testid="top-nav">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-[var(--ide-surface)] transition-colors rounded-md"
          >
            <Menu className="w-4 h-4 text-[var(--ide-text-muted)]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">
          <DropdownMenuItem onClick={() => navigate('/dashboard')}>
            <Home className="w-4 h-4 mr-2" />
            Home
          </DropdownMenuItem>

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="py-2"
                onClick={() => navigate('/admin')}
              >
                <Shield className="w-4 h-4 mr-2 text-[#7C65CB]" />
                <span className="font-medium">Admin Dashboard</span>
                <Badge
                  variant="default"
                  className="ml-auto text-[10px] h-4 px-1.5"
                >
                  ADMIN
                </Badge>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-center gap-1.5 pl-1 group cursor-default">
        <button
          className="shrink-0 hover:opacity-80 transition-opacity"
          onClick={() => navigate('/dashboard')}
          title="Home"
        >
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
            <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#F26522"/>
            <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#F26522"/>
            <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#F26522"/>
          </svg>
        </button>
        <span className="text-[12px] text-[#F26522] font-bold tracking-tight">E-Code</span>
        <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" />
        <div className="relative flex items-center gap-1">
          <span className="text-[12px] font-medium truncate max-w-[140px] text-[var(--ide-text)]" data-testid="text-project-name">{projectName}</span>
          {projectDescription && (
            <div className="absolute left-0 top-full mt-1 w-64 p-2 bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] text-[11px] text-[var(--ide-text-muted)] leading-relaxed">
              {projectDescription}
            </div>
          )}
        </div>
      </div>

      {showTabs ? (
        <div className="flex-1 flex items-center gap-1 overflow-x-auto ml-2" style={{ scrollbarWidth: 'none' }}>
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                draggable={onTabReorder !== undefined}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', String(index));
                  e.dataTransfer.effectAllowed = 'move';
                  (e.target as HTMLElement).style.opacity = '0.5';
                }}
                onDragEnd={(e) => {
                  (e.target as HTMLElement).style.opacity = '1';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                  if (onTabReorder && fromIndex !== index) {
                    onTabReorder(fromIndex, index);
                  }
                }}
                onClick={() => onTabChange(tab.id)}
                data-testid={`tab-${tab.id}`}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-md transition-all duration-200 cursor-grab active:cursor-grabbing",
                  "hover:bg-[var(--ide-surface)] hover:shadow-sm",
                  activeTab === tab.id
                    ? "bg-[var(--ide-surface)] shadow-sm border border-[var(--ide-border)]"
                    : "bg-transparent"
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span className="max-w-[120px] truncate font-medium">{tab.label}</span>
                {tab.closable && (
                  <X
                    className="h-3 w-3 opacity-70 hover:opacity-100 hover:text-red-500 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTabClose(tab.id);
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="flex items-center gap-0.5">
        {onToggleCollaboration && (
          <Button
            variant={showCollaboration ? "secondary" : "ghost"}
            size="sm"
            onClick={onToggleCollaboration}
            data-testid="button-toggle-collaboration"
            className={cn(
              "h-8 w-8 p-0 rounded-md relative",
              showCollaboration && "bg-[var(--ide-surface)]"
            )}
          >
            <Users className="h-4 w-4 text-[var(--ide-text-muted)]" />
            {collaboratorCount > 0 && (
              <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[9px] font-bold">
                {collaboratorCount}
              </Badge>
            )}
          </Button>
        )}

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded-md"
                onClick={onToggleFileExplorer}
                data-testid="button-toggle-explorer"
              >
                {showFileExplorer ? <PanelLeftClose className="w-3.5 h-3.5" /> : <FolderOpen className="w-3.5 h-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">
              {showFileExplorer ? 'Hide Files' : 'Show Files'}
            </TooltipContent>
          </Tooltip>

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
              Command Palette
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="h-5 w-px bg-[var(--ide-border)] mx-1" />

        <Button
          variant={isRunning ? "destructive" : "default"}
          size="sm"
          onClick={onRun}
          data-testid="button-run"
          className={cn(
            "h-7 px-3 gap-1.5 text-[12px] font-semibold rounded-full transition-all",
            isRunning
              ? "bg-red-500 hover:bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]"
              : "bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] shadow-[0_0_12px_rgba(12,206,107,0.3)]"
          )}
        >
          {isRunning ? (
            <><Square className="h-3 w-3 fill-current" /><span>Stop</span></>
          ) : (
            <><Play className="h-3 w-3 fill-current" /><span>Run</span></>
          )}
        </Button>

        {onPublish && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded-md" onClick={onPublish} data-testid="button-publish">
                  <Rocket className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Publish</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {onInvite && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded-md" onClick={onInvite} data-testid="button-invite">
                  <Users className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Invite</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <div className="h-5 w-px bg-[var(--ide-border)] mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-md hover:bg-[var(--ide-surface)]"
            >
              {theme === "light" ? (
                <Sun className="h-4 w-4 text-[var(--ide-text-muted)]" />
              ) : (
                <Moon className="h-4 w-4 text-[var(--ide-text-muted)]" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => setTheme("light")} className="text-[13px]">
              <Sun className="w-4 h-4 mr-2" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")} className="text-[13px]">
              <Moon className="w-4 h-4 mr-2" />
              Dark
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-full p-0 hover:ring-2 hover:ring-[#7C65CB]/30 transition-all"
              data-testid="button-user-menu"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={(user as any)?.profileImageUrl || undefined} />
                <AvatarFallback className="text-[11px] bg-[#7C65CB] text-white font-semibold">
                  {(user as any)?.username?.charAt(0).toUpperCase() || (user as any)?.displayName?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-[13px] font-medium">{(user as any)?.username || (user as any)?.displayName || 'User'}</p>
                <p className="text-[11px] text-[var(--ide-text-muted)]">{(user as any)?.email || ''}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')} className="text-[13px]">
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            {onProjectSettings && (
              <DropdownMenuItem onClick={onProjectSettings} className="text-[13px]">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-[13px] text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
