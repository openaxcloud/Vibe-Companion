import { memo, useCallback, useState, useEffect, useRef } from 'react';
import { 
  X, 
  Search, 
  Plus,
  Lock,
  Database,
  Users,
  FileCode,
  Bot,
  Rocket,
  Terminal,
  GitBranch,
  Package,
  Shield,
  Code,
  FolderTree,
  HardDrive,
  Settings,
  Monitor,
  Radio
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useDebouncedCallback } from 'use-debounce';

export interface OpenTab {
  id: string;
  name: string;
  icon: string;
}

const iconMap: Record<string, React.ElementType> = {
  search: Search,
  files: FolderTree,
  agent: Bot,
  assistant: Code,
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
};

const ReplitAgentIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <circle cx="7" cy="7" r="3" />
    <circle cx="17" cy="7" r="3" />
    <circle cx="7" cy="17" r="3" />
    <circle cx="17" cy="17" r="3" />
  </svg>
));
ReplitAgentIcon.displayName = 'ReplitAgentIcon';

const quickAccessTools = [
  { id: 'secrets', name: 'Secrets', icon: Lock },
  { id: 'database', name: 'Database', icon: Database },
  { id: 'auth', name: 'Auth', icon: Users },
];

interface MobileTabSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  openTabs: OpenTab[];
  activeTabId: string;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  onQuickAccess: (toolId: string) => void;
}

export const MobileTabSwitcher = memo(function MobileTabSwitcher({
  isOpen,
  onClose,
  openTabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewTab,
  onQuickAccess,
}: MobileTabSwitcherProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstTabRef = useRef<HTMLDivElement>(null);

  const debouncedSetQuery = useDebouncedCallback((value: string) => {
    setDebouncedQuery(value);
  }, 200);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    debouncedSetQuery(e.target.value);
  }, [debouncedSetQuery]);

  useEffect(() => {
    if (isOpen) {
      // Focus first element (button if no tabs, first tab if tabs exist)
      if (openTabs.length === 0) {
        buttonRef.current?.focus();
      } else {
        firstTabRef.current?.focus();
      }
      setSearchQuery('');
      setDebouncedQuery('');
    }
  }, [isOpen, openTabs.length]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabTrap);
    return () => container.removeEventListener('keydown', handleTabTrap);
  }, [isOpen, openTabs]);

  const handleTabSelect = useCallback((tabId: string) => {
    if ('vibrate' in navigator) navigator.vibrate(10);
    onTabSelect(tabId);
    onClose();
  }, [onTabSelect, onClose]);

  const handleTabClose = useCallback((e: React.MouseEvent | React.KeyboardEvent, tabId: string) => {
    e.stopPropagation();
    if ('vibrate' in navigator) navigator.vibrate(10);
    onTabClose(tabId);
  }, [onTabClose]);

  const handleNewTab = useCallback(() => {
    if ('vibrate' in navigator) navigator.vibrate(10);
    onNewTab();
    onClose();
  }, [onNewTab, onClose]);

  const handleQuickAccess = useCallback((toolId: string) => {
    if ('vibrate' in navigator) navigator.vibrate(10);
    onQuickAccess(toolId);
    onClose();
  }, [onQuickAccess, onClose]);

  const getIcon = useCallback((iconName: string) => {
    if (iconName === 'agent') {
      return <ReplitAgentIcon className="h-5 w-5" />;
    }
    const Icon = iconMap[iconName] || FileCode;
    return <Icon className="h-5 w-5" />;
  }, []);

  const filteredTabs = debouncedQuery
    ? openTabs.filter(tab => 
        tab.name.toLowerCase().includes(debouncedQuery.toLowerCase())
      )
    : openTabs;

  if (!isOpen) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label="Tab switcher"
      data-testid="mobile-tab-switcher"
    >
      <div className="flex flex-col h-full">
        {/* Main content area with tabs */}
        <div className="flex-1 overflow-auto p-4">
          {openTabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <FileCode className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-[15px] font-medium mb-2">No tabs open</h3>
              <p className="text-[13px] text-muted-foreground mb-4">
                Open a tool to get started
              </p>
              <button
                ref={buttonRef}
                onClick={handleNewTab}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
                aria-label="Open a new tool"
                data-testid="button-open-first-tab"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Open Tool
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredTabs.map((tab, index) => (
                <div
                  key={tab.id}
                  role="button"
                  tabIndex={0}
                  ref={index === 0 ? firstTabRef : undefined}
                  onClick={() => handleTabSelect(tab.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTabSelect(tab.id); }}
                  className={cn(
                    "relative flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer",
                    "active:scale-95 touch-manipulation min-h-[100px]",
                    activeTabId === tab.id
                      ? "bg-primary/10 border-primary"
                      : "bg-surface-secondary-solid border-border hover:border-primary/50"
                  )}
                  aria-label={`Switch to ${tab.name}`}
                  aria-current={activeTabId === tab.id ? 'true' : undefined}
                  data-testid={`tab-card-${tab.id}`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleTabClose(e, tab.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTabClose(e, tab.id); }}
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
                    aria-label={`Close ${tab.name} tab`}
                    data-testid={`button-close-tab-${tab.id}`}
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </div>
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-lg mb-2",
                    activeTabId === tab.id ? "text-primary" : "text-muted-foreground"
                  )} aria-hidden="true">
                    {getIcon(tab.icon)}
                  </div>
                  <span className={cn(
                    "text-[13px] font-medium capitalize",
                    activeTabId === tab.id ? "text-primary" : "text-foreground"
                  )}>
                    {tab.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom section with quick access and search */}
        <div className="border-t border-border bg-surface-solid p-4 pb-safe">
          {/* Quick access tools */}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto" role="group" aria-label="Quick access tools">
            {quickAccessTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => handleQuickAccess(tool.id)}
                  className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-surface-secondary-solid border border-border hover:border-primary/50 transition-colors min-w-[70px]"
                  aria-label={`Quick access: ${tool.name}`}
                  data-testid={`quick-access-${tool.id}`}
                >
                  <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  <span className="text-[11px] text-muted-foreground">{tool.name}</span>
                </button>
              );
            })}
            <button
              onClick={handleNewTab}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-surface-secondary-solid border border-border hover:border-primary/50 transition-colors min-w-[70px]"
              aria-label="Open new tab"
              data-testid="button-new-tab"
            >
              <Plus className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <span className="text-[11px] text-muted-foreground">New Tab</span>
            </button>
          </div>

          {/* Search bar and close */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <FileCode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search tabs..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-9"
                aria-label="Search open tabs"
                data-testid="input-search-tabs"
              />
            </div>
            <button
              onClick={() => {
                if ('vibrate' in navigator) navigator.vibrate(10);
                setSearchQuery('');
                setDebouncedQuery('');
              }}
              className="p-2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
              data-testid="button-clear-search"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              onClick={() => {
                if ('vibrate' in navigator) navigator.vibrate(10);
                onClose();
              }}
              className="p-2 text-muted-foreground hover:text-foreground"
              aria-label="Close tab switcher"
              data-testid="button-close-switcher"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
