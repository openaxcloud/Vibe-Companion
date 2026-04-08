import { memo, useCallback, useRef, useState, useEffect } from 'react';
import { 
  Play, 
  Square, 
  Monitor, 
  Radio, 
  Plus, 
  MoreVertical,
  Bot,
  Terminal,
  Database,
  GitBranch,
  Lock,
  Users,
  Rocket,
  Code,
  FileCode,
  FolderTree,
  Package,
  Shield,
  HardDrive,
  Search,
  Settings,
  LayoutGrid,
  Zap,
  Wrench,
  History,
  Puzzle,
  Workflow,
  Bug,
  Save,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileTab = 'preview' | 'agent' | 'deploy' | 'more' | 'files' | 'editor' | 'search' | 'git' | 'packages' | 'secrets' | 'database' | 'terminal' | 'settings' | 'history' | 'extensions' | 'workflows' | 'debug' | 'checkpoints' | 'security' | 'collaboration' | 'actions' | 'tools' | 'shell' | 'storage' | 'themes' | 'multiplayers' | 'testing';

export interface OpenTab {
  id: string;
  name: string;
  icon: string;
}

interface ReplitMobileNavigationProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  isRunning?: boolean;
  onPlayStop?: () => void;
  isPanelOpen?: boolean;
  onPanelToggle?: () => void;
  onMorePress?: () => void;
  openTabs?: OpenTab[];
  activeOpenTabId?: string;
  onOpenTabSelect?: (tabId: string) => void;
  onAddTab?: () => void;
  onTabSwitcherOpen?: () => void;
}

const ReplitAgentIcon = memo(({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    className={className}
    fill="currentColor"
  >
    <circle cx="7" cy="7" r="3" />
    <circle cx="17" cy="7" r="3" />
    <circle cx="7" cy="17" r="3" />
    <circle cx="17" cy="17" r="3" />
  </svg>
));
ReplitAgentIcon.displayName = 'ReplitAgentIcon';

const iconMap: Record<string, React.ElementType> = {
  search: Search,
  files: FolderTree,
  agent: Bot,
  assistant: Code,
  editor: Code,
  publishing: Rocket,
  'app-storage': HardDrive,
  auth: Shield,
  console: Terminal,
  database: Database,
  developer: Code,
  git: GitBranch,
  integrations: Package,
  multiplayer: Users,
  preview: Monitor,
  secrets: Lock,
  deploy: Radio,
  settings: Settings,
  actions: Zap,
  tools: Wrench,
  history: History,
  extensions: Puzzle,
  workflows: Workflow,
  debug: Bug,
  checkpoints: Save,
  security: ShieldCheck,
  collaboration: Users,
  packages: Package,
  terminal: Terminal,
};

const defaultTabs = [
  { id: 'preview' as const, label: 'Preview' },
  { id: 'agent' as const, label: 'Agent' },
  { id: 'deploy' as const, label: 'Deploy' },
] as const;

export const ReplitMobileNavigation = memo(function ReplitMobileNavigation({
  activeTab,
  onTabChange,
  isRunning = false,
  onPlayStop,
  onPanelToggle,
  onMorePress,
  openTabs = [],
  activeOpenTabId,
  onOpenTabSelect,
  onAddTab,
  onTabSwitcherOpen,
}: ReplitMobileNavigationProps) {
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);

  const handleTabClick = useCallback((tabId: MobileTab) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    onTabChange(tabId);
  }, [onTabChange]);

  const handleOpenTabClick = useCallback((tabId: string) => {
    if (isLongPressing) {
      setIsLongPressing(false);
      return;
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    onOpenTabSelect?.(tabId);
  }, [onOpenTabSelect, isLongPressing]);

  const handleLongPressStart = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      setIsLongPressing(true);
      if ('vibrate' in navigator) {
        navigator.vibrate([15, 10, 15]);
      }
      onTabSwitcherOpen?.();
    }, 500);
  }, [onTabSwitcherOpen]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handlePlayStop = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate([15, 10, 15]);
    }
    onPlayStop?.();
  }, [onPlayStop]);

  const handlePanelToggle = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    onPanelToggle?.();
  }, [onPanelToggle]);

  const handleMorePress = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    onMorePress?.();
  }, [onMorePress]);

  const handleAddTab = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    onAddTab?.();
  }, [onAddTab]);

  const handleTabSwitcherOpen = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    onTabSwitcherOpen?.();
  }, [onTabSwitcherOpen]);

  const renderTabIcon = useCallback((tabId: MobileTab | string, isActive: boolean) => {
    const baseClass = "h-5 w-5 transition-colors duration-150";
    const activeClass = tabId === 'agent' ? "text-[#7C65C1]" : "text-gray-900 dark:text-white";
    const inactiveClass = "text-gray-500 dark:text-gray-400";
    const iconClass = cn(baseClass, isActive ? activeClass : inactiveClass);

    if (tabId === 'agent') {
      return <ReplitAgentIcon className={iconClass} />;
    }

    switch (tabId) {
      case 'preview':
        return <Monitor className={iconClass} />;
      case 'deploy':
        return <Radio className={iconClass} />;
      default:
        const Icon = iconMap[tabId] || FileCode;
        return <Icon className={iconClass} />;
    }
  }, []);

  const hasOpenTabs = openTabs.length > 0;
  const visibleTabs = hasOpenTabs ? openTabs.slice(0, 3) : [];
  const showAddButton = !hasOpenTabs || openTabs.length < 4;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 mobile-safe-bottom">
      <div 
        className="absolute inset-0 bg-white/95 dark:bg-[#1C1C1C]/95 backdrop-blur-xl border-t border-gray-200/80 dark:border-gray-700/50"
        style={{ WebkitBackdropFilter: 'blur(20px)' }}
      />
      
      <nav className="relative flex items-center justify-between h-14 px-3">
        <button
          onClick={handlePlayStop}
          className={cn(
            "relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-150",
            "active:scale-95 touch-manipulation",
            isRunning 
              ? "bg-gray-900 dark:bg-white shadow-lg" 
              : "bg-[#B8A5FF] shadow-lg shadow-purple-500/25"
          )}
          aria-label={isRunning ? "Stop running" : "Run project"}
          data-testid="button-play-stop"
        >
          {isRunning ? (
            <Square className="h-4 w-4 text-white dark:text-gray-900" fill="currentColor" aria-hidden="true" />
          ) : (
            <Play className="h-5 w-5 text-white ml-0.5" fill="currentColor" aria-hidden="true" />
          )}
        </button>

        <div 
          className="flex items-center bg-gray-100/80 dark:bg-[#2A2A2A]/80 backdrop-blur-sm rounded-full p-1 shadow-sm"
          style={{ WebkitBackdropFilter: 'blur(8px)' }}
        >
          {hasOpenTabs ? (
            <>
              {/* Dedicated tab switcher button - always visible when tabs exist */}
              <button
                onClick={handleTabSwitcherOpen}
                className={cn(
                  "relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-150",
                  "active:scale-95 active:bg-gray-200 dark:active:bg-[#3A3A3A] touch-manipulation"
                )}
                aria-label="Open tab switcher"
                data-testid="button-tab-switcher"
              >
                <LayoutGrid className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>

              <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5" />

              {visibleTabs.map((tab) => {
                const isActive = activeOpenTabId === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleOpenTabClick(tab.id)}
                    onTouchStart={handleLongPressStart}
                    onTouchEnd={handleLongPressEnd}
                    onTouchCancel={handleLongPressEnd}
                    className={cn(
                      "relative flex items-center justify-center w-11 h-9 rounded-full transition-all duration-150",
                      "active:scale-95 touch-manipulation",
                      isActive && "bg-white dark:bg-[#3A3A3A] shadow-sm"
                    )}
                    aria-label={`Switch to ${tab.name} tab`}
                    aria-pressed={isActive}
                    data-testid={`tab-${tab.id}`}
                  >
                    {renderTabIcon(tab.icon, isActive)}
                    
                    {isActive && (
                      <span 
                        className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#7C65C1] rounded-full"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
              
              {openTabs.length > 3 && (
                <button
                  onClick={handleTabSwitcherOpen}
                  className={cn(
                    "relative flex items-center justify-center w-11 h-9 rounded-full transition-all duration-150",
                    "active:scale-95 active:bg-gray-200 dark:active:bg-[#3A3A3A] touch-manipulation"
                  )}
                  aria-label={`Show ${openTabs.length - 3} more tabs`}
                  data-testid="button-more-tabs"
                >
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    +{openTabs.length - 3}
                  </span>
                </button>
              )}
            </>
          ) : (
            <>
              {defaultTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={cn(
                      "relative flex items-center justify-center w-11 h-9 rounded-full transition-all duration-150",
                      "active:scale-95 touch-manipulation",
                      isActive && "bg-white dark:bg-[#3A3A3A] shadow-sm"
                    )}
                    data-testid={`tab-${tab.id}`}
                  >
                    {renderTabIcon(tab.id, isActive)}
                    
                    {isActive && (
                      <span 
                        className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#7C65C1] rounded-full"
                      />
                    )}
                  </button>
                );
              })}
            </>
          )}
          
          {showAddButton && (
            <>
              <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" aria-hidden="true" />
              
              <button
                onClick={handleAddTab}
                className={cn(
                  "relative flex items-center justify-center w-11 h-9 rounded-full transition-all duration-150",
                  "active:scale-95 active:bg-gray-200 dark:active:bg-[#3A3A3A] touch-manipulation"
                )}
                aria-label="Add new tab"
                data-testid="button-add-tab"
              >
                <Plus className="h-5 w-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        <button
          onClick={handleMorePress}
          className={cn(
            "flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-150",
            "active:scale-95 active:bg-gray-100 dark:active:bg-[#2A2A2A] touch-manipulation"
          )}
          aria-label="More options"
          data-testid="button-more"
        >
          <MoreVertical className="h-5 w-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
});
