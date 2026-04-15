import { memo, useCallback, type ElementType } from 'react';
import {
  Rocket, Monitor, MoreHorizontal, Sparkles, FolderOpen,
  GitBranch, AlertCircle, Wifi, WifiOff, Terminal, Database,
  Lock, Settings, History, Layers, Package, Bug, Shield,
  Users, Search, Workflow, Puzzle, X, Globe, MessageSquare,
  Server, Network, BookOpen, Key, Cpu, TestTube, Archive,
  Wrench, Inbox, Github, Plug, Bot, Merge, Activity, Code,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface OpenTab {
  id: string;
  name: string;
  icon: string;
}

interface BadgeCounts {
  git?: number;
  errors?: number;
}

interface ReplitBottomTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  openTabs?: OpenTab[];
  onCloseTab?: (tabId: string) => void;
  badgeCounts?: BadgeCounts;
  isConnected?: boolean;
  inline?: boolean;
}

const CORE_TAB_IDS = new Set(['files', 'preview', 'agent', 'deploy', 'more']);

const iconMap: Record<string, ElementType> = {
  files: FolderOpen, preview: Monitor, agent: Sparkles, deploy: Rocket,
  more: MoreHorizontal, terminal: Terminal, database: Database,
  secrets: Lock, settings: Settings, history: History, checkpoints: Layers,
  packages: Package, debug: Bug, security: Shield, collaboration: Users,
  search: Search, workflows: Workflow, extensions: Puzzle, git: GitBranch,
  console: Terminal, shell: Terminal, auth: Key, themes: Wrench,
  'visual-editor': Globe, slides: Layers, video: Layers, animation: Layers,
  design: Layers, storage: Database, testing: TestTube, tests: TestTube,
  automations: Bot, config: Settings, feedback: Inbox, github: Github,
  integrations: Plug, mcp: Cpu, 'merge-conflicts': Merge, monitoring: Activity,
  networking: Network, publishing: Globe, skills: BookOpen, ssh: Server,
  threads: MessageSquare, 'test-runner': TestTube, 'security-scanner': Shield,
  backup: Archive, tasks: Layers, code: Code,
};

function getIcon(id: string): ElementType {
  return iconMap[id] || Layers;
}

export const ReplitBottomTabs = memo(function ReplitBottomTabs({
  activeTab,
  onTabChange,
  openTabs,
  onCloseTab,
  badgeCounts = {},
  isConnected = true,
  inline = false,
}: ReplitBottomTabsProps) {
  const isMobile = useIsMobile();

  const handleTabClick = useCallback((tabId: string) => {
    onTabChange(tabId);
    if ('vibrate' in navigator) {
      navigator.vibrate([8, 50, 4]);
    }
  }, [onTabChange]);

  if (!isMobile) {
    return null;
  }

  const displayTabs: { id: string; label: string; icon: ElementType; closable: boolean }[] = [];

  if (openTabs && openTabs.length > 0) {
    for (const t of openTabs) {
      displayTabs.push({
        id: t.id,
        label: t.name,
        icon: getIcon(t.icon || t.id),
        closable: !CORE_TAB_IDS.has(t.id),
      });
    }
    if (!displayTabs.find(t => t.id === 'more')) {
      displayTabs.push({ id: 'more', label: 'Tools', icon: MoreHorizontal, closable: false });
    }
  } else {
    displayTabs.push(
      { id: 'files', label: 'Files', icon: FolderOpen, closable: false },
      { id: 'preview', label: 'Preview', icon: Monitor, closable: false },
      { id: 'agent', label: 'Agent', icon: Sparkles, closable: false },
      { id: 'deploy', label: 'Deploy', icon: Rocket, closable: false },
      { id: 'more', label: 'Tools', icon: MoreHorizontal, closable: false },
    );
  }

  const getBadge = (tabId: string): number | undefined => {
    if (tabId === 'more') {
      const total = (badgeCounts.git || 0) + (badgeCounts.errors || 0);
      return total > 0 ? total : undefined;
    }
    if (tabId === 'git') return badgeCounts.git;
    return undefined;
  };

  const needsScroll = displayTabs.length > 5;

  return (
    <div
      className={inline ? "shrink-0 relative" : "fixed bottom-0 left-0 right-0 z-[60]"}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      data-testid="mobile-bottom-navigation"
    >
      <div
        className="absolute inset-x-0 bottom-0 top-0"
        style={{ background: 'var(--ide-bg, #0d1117)' }}
      />
      <div
        className={inline
          ? "absolute inset-x-3 inset-y-0 rounded-[var(--mobile-nav-radius)]"
          : "absolute inset-x-3 bottom-0 top-0 rounded-[var(--mobile-nav-radius)]"
        }
        style={{
          background: 'var(--mobile-nav-gradient)',
          boxShadow: 'var(--mobile-nav-shadow), var(--mobile-nav-inner-shadow)',
          border: '1px solid var(--mobile-nav-border)',
          borderTop: '1px solid var(--mobile-nav-border-top)',
        }}
      >
        <div
          className="absolute top-0 left-4 right-4 h-px"
          style={{ background: 'var(--mobile-nav-border-top)' }}
        />
      </div>

      {!isConnected && (
        <div className="absolute -top-5 left-4 pointer-events-none z-10">
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full animate-fade-in pointer-events-auto"
            style={{
              background: '#1C2333',
              border: '1px solid #ef4444',
              boxShadow: '0 1px 4px -1px #ef4444',
            }}
            data-testid="indicator-connection-status"
          >
            <WifiOff className="h-2.5 w-2.5 text-red-500" />
            <span className="text-[9px] font-semibold uppercase tracking-wider text-red-500" style={{ fontFamily: 'var(--ecode-font-sans)' }}>
              Offline
            </span>
          </div>
        </div>
      )}

      <nav
        className={cn(
          "relative flex items-center px-4 mx-3 mb-0",
          needsScroll ? "overflow-x-auto gap-0.5 scrollbar-none" : "justify-around"
        )}
        style={{ height: 'var(--mobile-nav-height)' }}
      >
        {displayTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const badge = getBadge(tab.id);

          return (
            <div
              key={tab.id}
              role="tab"
              tabIndex={0}
              aria-selected={isActive}
              onClick={() => handleTabClick(tab.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTabClick(tab.id); } }}
              className={cn(
                "relative flex flex-col items-center justify-center cursor-pointer",
                needsScroll ? "min-w-[56px] px-1.5" : "flex-1",
                "min-w-[48px] max-w-[72px] min-h-[44px]",
                "rounded-[var(--mobile-nav-item-radius)]",
                "touch-manipulation select-none",
                "transition-transform duration-100",
                "active:scale-[0.92]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecode-accent)] focus-visible:ring-offset-2"
              )}
              data-testid={`tab-${tab.id}`}
            >
              {isActive && (
                <div
                  className="absolute inset-1 rounded-[calc(var(--mobile-nav-item-radius)-4px)] animate-scale-in"
                  style={{
                    background: 'var(--mobile-nav-active-bg)',
                    border: '1px solid var(--mobile-nav-active-border)',
                    boxShadow: '0 0 20px -4px var(--mobile-nav-glow), inset 0 1px 0 0 #3D4455',
                  }}
                />
              )}

              <div className="relative z-10">
                <div className={cn("transition-transform duration-150", isActive && "transform -translate-y-0.5 scale-110")}>
                  <Icon
                    className="transition-colors duration-150"
                    style={{
                      width: 'var(--mobile-nav-icon-size)',
                      height: 'var(--mobile-nav-icon-size)',
                      color: isActive ? 'var(--ecode-accent)' : 'var(--ecode-text-muted)',
                      opacity: isActive ? 1 : 'var(--mobile-nav-inactive-opacity)',
                      strokeWidth: isActive ? 2.25 : 1.75,
                    }}
                  />
                </div>

                {badge !== undefined && badge > 0 && (
                  <span
                    className="absolute -top-2 -right-2.5 flex items-center justify-center animate-scale-in"
                    style={{
                      minWidth: '18px', height: '18px', padding: '0 5px',
                      fontSize: '10px', fontWeight: 700, fontFamily: 'var(--ecode-font-sans)',
                      color: 'white', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      borderRadius: '9px', border: '2px solid var(--ecode-surface)',
                      boxShadow: '0 2px 6px -1px #ef4444',
                    }}
                  >
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}

                {tab.closable && onCloseTab && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-[var(--ecode-surface)] border border-[var(--ide-border)] hover:bg-red-600 hover:border-red-600 transition-colors"
                    data-testid={`close-tab-${tab.id}`}
                  >
                    <X className="w-2.5 h-2.5 text-[var(--ecode-text-muted)]" />
                  </button>
                )}
              </div>

              <span
                className={cn(
                  "relative z-10 mt-0.5 font-medium leading-none transition-transform duration-150 truncate max-w-[56px]",
                  isActive && "transform -translate-y-px scale-[1.02]"
                )}
                style={{
                  fontSize: 'var(--mobile-nav-label-size)',
                  fontFamily: 'var(--ecode-font-sans)',
                  color: isActive ? 'var(--ecode-accent)' : 'var(--ecode-text-muted)',
                  opacity: isActive ? 1 : 'var(--mobile-nav-inactive-opacity)',
                  letterSpacing: '0.01em',
                }}
              >
                {tab.label}
              </span>

              {isActive && (
                <div
                  className="absolute -bottom-0.5 rounded-full animate-width-expand"
                  style={{
                    height: '3px',
                    background: 'linear-gradient(90deg, var(--ecode-accent), var(--ecode-accent-hover))',
                    boxShadow: '0 0 16px 2px var(--mobile-nav-glow-strong)',
                  }}
                />
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
});
