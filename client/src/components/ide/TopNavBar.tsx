import { useState } from 'react';
import { RunnerWorkspaceButton } from '@/components/ide/RunnerWorkspaceButton';
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
  Code, 
  Play, 
  Square, 
  Settings, 
  User, 
  LogOut, 
  Plus,
  X,
  Menu,
  Eye,
  FileCode,
  MoreHorizontal,
  Home,
  Shield,
  Crown,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  Bell,
  Clock,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { WorkspaceSettings } from '@/components/WorkspaceSettings';
import { AddTabMenu } from './AddTabMenu';
import { ReplitPublishButton } from './ReplitPublishButton';
import { useTheme } from '@/components/ThemeProvider';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';

interface Tab {
  id: string;
  label: string;
  icon?: any;
  closable?: boolean;
}

interface AvailableTool {
  id: string;
  label: string;
  icon: string;
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
  availableTools?: AvailableTool[];
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
}: TopNavBarProps) {
  const { t } = useTranslation();
  const { user, logoutMutation } = useAuth();
  const { theme, setTheme } = useTheme();
  const [, navigate] = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  
  const handleLogout = async () => {
    logoutMutation.mutate();
    navigate('/login');
  };
  
  // Check if user is admin (using role field)
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  
  return (
    <div className="h-11 border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)] flex items-center px-2 gap-1" data-testid="top-nav">
      {/* Main Menu Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0 hover:bg-[var(--ecode-sidebar-hover)] transition-colors rounded-md"
          >
            <Menu className="w-4 h-4 text-[var(--ecode-text-muted)]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">
          <DropdownMenuItem onClick={() => navigate('/dashboard')}>
            <Home className="w-4 h-4 mr-2" />
            {t('ide.nav.home')}
          </DropdownMenuItem>
          
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="py-2"
                onClick={() => navigate('/admin')}
              >
                <Shield className="w-4 h-4 mr-2 text-[var(--ecode-accent)]" />
                <span className="font-medium">{t('ide.nav.adminDashboard')}</span>
                <Badge 
                  variant="default"
                  className="ml-auto text-[10px] h-4 px-1.5"
                >
                  {t('ide.nav.admin')}
                </Badge>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Logo & Project Name - Replit style */}
      <div className="flex items-center gap-1.5 pl-1 group cursor-default">
        <span className="text-[12px] text-[var(--ecode-accent)] font-bold tracking-tight">E-Code</span>
        <span className="text-[var(--ecode-text-muted)] text-[10px]">/</span>
        <div className="relative flex items-center gap-1">
          <span className="text-[12px] font-medium truncate max-w-[140px] text-[var(--ecode-text)]">{projectName}</span>
          {projectDescription && (
            <div className="absolute left-0 top-full mt-1 w-64 p-2 bg-[var(--ecode-surface)] border border-[var(--ecode-border)] rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] text-[11px] text-[var(--ecode-text-muted)] leading-relaxed">
              {projectDescription}
            </div>
          )}
        </div>
      </div>
      
      {/* Tabs with Drag-and-Drop Reorder - All tabs visible with scroll */}
      {showTabs ? (
        <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--ecode-border)] dark:scrollbar-thumb-[var(--ecode-border)]">
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
                  "hover:bg-[var(--ecode-sidebar-hover)] hover:shadow-sm",
                  activeTab === tab.id 
                    ? "bg-[var(--ecode-sidebar-bg)] shadow-sm border border-[var(--ecode-border)]" 
                    : "bg-[var(--ecode-surface)]"
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />}
                <span className="max-w-[120px] truncate font-medium">{tab.label}</span>
                {tab.closable && (
                  <X
                    className="h-3 w-3 opacity-70 hover:opacity-100 hover:text-destructive transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTabClose(tab.id);
                    }}
                  />
                )}
              </button>
            );
          })}
          
          {/* Enhanced Add Tab Menu */}
          {onAddTool && <AddTabMenu onAddTool={onAddTool} availableTools={availableTools} onOpenToolsSheet={onOpenToolsSheet} />}
        </div>
      ) : (
        <div className="flex-1" />
      )}
      
      {/* Right Actions */}
      <div className="flex items-center gap-0.5">
        {/* Collaboration Toggle */}
        {onToggleCollaboration && (
          <Button
            variant={showCollaboration ? "secondary" : "ghost"}
            size="sm"
            onClick={onToggleCollaboration}
            data-testid="button-toggle-collaboration"
            className={cn(
              "h-8 w-8 p-0 rounded-md",
              showCollaboration && "bg-[var(--ecode-sidebar-hover)]"
            )}
          >
            <Users className="h-4 w-4" />
            {collaboratorCount > 0 && (
              <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[9px] font-bold">
                {collaboratorCount}
              </Badge>
            )}
          </Button>
        )}
        
        {/* File Explorer Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleFileExplorer}
          data-testid="button-toggle-explorer"
          className="h-8 w-8 p-0 rounded-md hover:bg-[var(--ecode-sidebar-hover)]"
        >
          <FileCode className="h-4 w-4 text-[var(--ecode-text-muted)]" />
        </Button>
        
        {/* Divider */}
        <div className="h-5 w-px bg-[var(--ecode-border)] mx-1" />
        
        {/* Run/Stop Button - Replit style green */}
        <Button
          variant={isRunning ? "destructive" : "default"}
          size="sm"
          onClick={onRun}
          data-testid="button-run-stop"
          className={cn(
            "h-7 px-3 gap-1.5 text-[12px] font-semibold rounded-md transition-all",
            isRunning 
              ? "bg-red-500 hover:bg-red-600 text-white" 
              : "bg-[hsl(142,72%,42%)] hover:bg-[hsl(142,72%,38%)] text-white"
          )}
        >
          {isRunning ? (
            <>
              <Square className="h-3 w-3 fill-current" />
              <span>{t('ide.nav.stop')}</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3 fill-current" />
              <span>{t('ide.nav.run')}</span>
            </>
          )}
        </Button>
        
        {/* Runner Workspace — only visible when RUNNER_BASE_URL is configured */}
        <RunnerWorkspaceButton projectId={projectId} />

        {/* Publish Button */}
        <ReplitPublishButton
          projectId={projectId}
          onOpenLogs={onOpenDeployLogs}
          onOpenAnalytics={onOpenDeployAnalytics}
        />
        
        {/* Theme Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 rounded-md hover:bg-[var(--ecode-sidebar-hover)]"
            >
              {theme === "light" ? (
                <Sun className="h-4 w-4 text-[var(--ecode-text-muted)]" />
              ) : theme === "dark" ? (
                <Moon className="h-4 w-4 text-[var(--ecode-text-muted)]" />
              ) : (
                <Monitor className="h-4 w-4 text-[var(--ecode-text-muted)]" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => setTheme("light")} className="text-[13px]">
              <Sun className="w-4 h-4 mr-2" />
              {t('ide.nav.light')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")} className="text-[13px]">
              <Moon className="w-4 h-4 mr-2" />
              {t('ide.nav.dark')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")} className="text-[13px]">
              <Monitor className="w-4 h-4 mr-2" />
              {t('ide.nav.system')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-full p-0 hover:ring-2 hover:ring-[var(--ecode-accent)]/30 transition-all"
              data-testid="button-user-menu"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="text-[11px] bg-[var(--ecode-accent)] text-white font-semibold">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-[13px] font-medium">{user?.username || t('ide.nav.user')}</p>
                <p className="text-[11px] text-[var(--ecode-text-muted)]">{user?.email || ''}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')} className="text-[13px]">
              <User className="mr-2 h-4 w-4" />
              {t('ide.nav.profile')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowSettings(true)} className="text-[13px]">
              <Settings className="mr-2 h-4 w-4" />
              {t('ide.nav.settings')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-[13px] text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              {t('ide.nav.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl max-h-[80vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0 border-b border-border">
            <DialogTitle className="text-base">{t('ide.nav.userSettings')}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            <WorkspaceSettings />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
