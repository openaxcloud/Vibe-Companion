import { cn } from '@/lib/utils';
import { Globe, Bot, Rocket, MoreHorizontal, Terminal } from 'lucide-react';

export type MobileTab =
  | 'preview' | 'agent' | 'deploy' | 'more'
  | 'git' | 'packages' | 'secrets' | 'database' | 'auth'
  | 'shell' | 'storage' | 'terminal' | 'files' | 'history'
  | 'themes' | 'multiplayers' | 'checkpoints' | 'settings'
  | 'extensions' | 'workflows' | 'debug' | 'testing' | 'security'
  | 'collaboration' | 'search' | 'actions' | 'tools'
  | 'slides' | 'video' | 'animation' | 'design' | 'tests'
  | 'visual-editor' | 'console' | 'resources' | 'logs'
  | 'automations' | 'config' | 'feedback' | 'github' | 'integrations'
  | 'mcp' | 'merge-conflicts' | 'monitoring' | 'networking' | 'publishing'
  | 'skills' | 'ssh' | 'threads' | 'test-runner' | 'security-scanner' | 'backup'
  | 'tasks';

interface OpenTab {
  id: string;
  name: string;
  icon: string;
}

interface ReplitMobileNavigationProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  isRunning: boolean;
  onPlayStop: () => void;
  isPanelOpen: boolean;
  onPanelToggle: () => void;
  onMorePress: () => void;
  openTabs?: OpenTab[];
  activeOpenTabId?: string;
  onOpenTabSelect?: (tabId: string) => void;
  onAddTab?: () => void;
  onTabSwitcherOpen?: () => void;
}

const coreNavItems = [
  { id: 'preview' as const, icon: Globe, label: 'Preview', color: '#F5A623' },
  { id: 'agent' as const, icon: Bot, label: 'Agent', color: '#7C65CB' },
  { id: 'terminal' as const, icon: Terminal, label: 'Terminal', color: '#4B9EF5' },
  { id: 'deploy' as const, icon: Rocket, label: 'Deploy', color: '#0CCE6B' },
  { id: 'more' as const, icon: MoreHorizontal, label: 'More', color: '#6B7280' },
];

export function ReplitMobileNavigation({
  activeTab,
  onTabChange,
  isRunning,
  onPlayStop,
  onMorePress,
  openTabs = [],
  activeOpenTabId,
  onOpenTabSelect,
  onAddTab,
  onTabSwitcherOpen,
}: ReplitMobileNavigationProps) {
  return (
    <div
      className="flex items-stretch bg-[var(--ide-bg)] border-t border-[var(--ide-border)] shrink-0 z-50 relative"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)', minHeight: '56px' }}
      data-testid="mobile-nav"
    >
      {coreNavItems.map(({ id, icon: Icon, label, color }) => {
        const isActive = activeTab === id || (id === 'more' && !['preview', 'agent', 'terminal', 'deploy'].includes(activeTab));
        return (
          <button
            key={id}
            className="relative flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[48px] transition-all duration-150 active:scale-95"
            style={{ color: isActive ? color : '#9CA3AF' }}
            onClick={() => {
              if (id === 'more') {
                onMorePress();
              } else {
                onTabChange(id);
              }
            }}
            data-testid={`mobile-tab-${id}`}
          >
            {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-b-full" style={{ backgroundColor: color }} />}
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none mt-0.5">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
