import { memo, useCallback } from 'react';
import { 
  ArrowLeft, History, Plus, MoreVertical, Monitor, Globe, X,
  FolderTree, Search, GitBranch, Package, Lock, Database, Terminal,
  Settings, Puzzle, Workflow, Bug, Save, ShieldCheck, Users, Zap, Wrench,
  Code, Rocket, HardDrive, Share2, Command, Radio
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MobileTab } from './ReplitMobileNavigation';

const ReplitAgentIcon = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <circle cx="7" cy="7" r="2.5" />
    <circle cx="17" cy="7" r="2.5" />
    <circle cx="7" cy="17" r="2.5" />
    <circle cx="17" cy="17" r="2.5" />
  </svg>
));
ReplitAgentIcon.displayName = 'ReplitAgentIcon';

interface ReplitMobileHeaderProps {
  activeTab: MobileTab;
  onBack?: () => void;
  onHistory?: () => void;
  onNewTab?: () => void;
  onMore?: () => void;
  onClose?: () => void;
  showClose?: boolean;
  title?: string;
}

const tabConfig: Record<string, { icon: any; label: string; iconColor?: string }> = {
  preview: { icon: Monitor, label: 'Preview' },
  agent: { icon: ReplitAgentIcon, label: 'Agent', iconColor: '#7C65C1' },
  deploy: { icon: Globe, label: 'Deploy' },
  files: { icon: FolderTree, label: 'Files' },
  search: { icon: Search, label: 'Search' },
  git: { icon: GitBranch, label: 'Git' },
  packages: { icon: Package, label: 'Packages' },
  secrets: { icon: Lock, label: 'Secrets' },
  database: { icon: Database, label: 'Database' },
  terminal: { icon: Terminal, label: 'Terminal' },
  console: { icon: Terminal, label: 'Console' },
  shell: { icon: Terminal, label: 'Shell' },
  settings: { icon: Settings, label: 'Settings' },
  history: { icon: History, label: 'History' },
  extensions: { icon: Puzzle, label: 'Extensions' },
  workflows: { icon: Workflow, label: 'Workflows' },
  debug: { icon: Bug, label: 'Debug' },
  checkpoints: { icon: Save, label: 'Checkpoints' },
  security: { icon: ShieldCheck, label: 'Security' },
  collaboration: { icon: Users, label: 'Collaboration' },
  actions: { icon: Zap, label: 'Actions' },
  tools: { icon: Wrench, label: 'Tools' },
  more: { icon: MoreVertical, label: 'More' },
  assistant: { icon: Code, label: 'Assistant' },
  publishing: { icon: Rocket, label: 'Publishing' },
  'app-storage': { icon: HardDrive, label: 'App Storage' },
  auth: { icon: ShieldCheck, label: 'Auth' },
  developer: { icon: Code, label: 'Developer' },
  integrations: { icon: Package, label: 'Integrations' },
  multiplayer: { icon: Users, label: 'Multiplayer' },
  web: { icon: Globe, label: 'Web' },
  commands: { icon: Command, label: 'Commands' },
  collaborate: { icon: Users, label: 'Collaborate' },
  share: { icon: Share2, label: 'Share' },
  radio: { icon: Radio, label: 'Radio' },
};

export const ReplitMobileHeader = memo(function ReplitMobileHeader({
  activeTab,
  onBack,
  onHistory,
  onNewTab,
  onMore,
  onClose,
  showClose = false,
  title,
}: ReplitMobileHeaderProps) {
  const config = tabConfig[activeTab] || tabConfig.preview;
  const Icon = config.icon;
  const displayTitle = title || config.label;

  const handleBack = useCallback(() => onBack?.(), [onBack]);
  const handleHistory = useCallback(() => onHistory?.(), [onHistory]);
  const handleNewTab = useCallback(() => onNewTab?.(), [onNewTab]);
  const handleMore = useCallback(() => onMore?.(), [onMore]);
  const handleClose = useCallback(() => onClose?.(), [onClose]);

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#1C1C1C]/95 backdrop-blur-xl border-b border-gray-200/80 dark:border-gray-700/50">
      <div className="flex items-center justify-between h-12 px-3">
        <div className="flex items-center gap-2">
          {showClose ? (
            <button
              onClick={handleClose}
              className="p-2 -ml-2 rounded-lg active:bg-gray-100 dark:active:bg-[#2A2A2A] active:scale-95 transition-all touch-manipulation"
              data-testid="button-close"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          ) : (
            <>
              <button
                onClick={handleBack}
                className="p-2 -ml-2 rounded-lg active:bg-gray-100 dark:active:bg-[#2A2A2A] active:scale-95 transition-all touch-manipulation"
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>

              <button
                onClick={handleHistory}
                className="p-2 rounded-lg active:bg-gray-100 dark:active:bg-[#2A2A2A] active:scale-95 transition-all touch-manipulation"
                data-testid="button-history"
              >
                <History className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'agent' ? (
            <ReplitAgentIcon className="h-5 w-5 text-[#7C65C1]" />
          ) : (
            <Icon 
              className="h-5 w-5" 
              style={{ color: config.iconColor || '#6B7280' }} 
            />
          )}
          <span className="font-medium text-gray-900 dark:text-white text-[13px]">
            {displayTitle}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleNewTab}
            className="p-2 rounded-lg active:bg-gray-100 dark:active:bg-[#2A2A2A] active:scale-95 transition-all touch-manipulation"
            data-testid="button-new-tab"
          >
            <Plus className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>

          <button
            onClick={handleMore}
            className="p-2 -mr-2 rounded-lg active:bg-gray-100 dark:active:bg-[#2A2A2A] active:scale-95 transition-all touch-manipulation"
            data-testid="button-more"
          >
            <MoreVertical className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>
    </header>
  );
});
