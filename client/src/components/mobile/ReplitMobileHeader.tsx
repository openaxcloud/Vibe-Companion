import { cn } from '@/lib/utils';
import { ChevronLeft, Clock, Plus, MoreHorizontal, Play, Square } from 'lucide-react';
import type { MobileTab } from './ReplitMobileNavigation';

interface ReplitMobileHeaderProps {
  activeTab: MobileTab;
  onBack: () => void;
  onHistory?: () => void;
  onNewTab?: () => void;
  onMore?: () => void;
  isRunning?: boolean;
  onRunStop?: () => void;
  projectName?: string;
}

const tabLabels: Record<string, string> = {
  preview: 'Preview',
  agent: 'AI Agent',
  deploy: 'Deploy',
  git: 'Git',
  packages: 'Packages',
  secrets: 'Secrets',
  database: 'Database',
  terminal: 'Terminal',
  files: 'Files',
  settings: 'Settings',
  search: 'Search',
  history: 'History',
  tasks: 'Tasks',
  workflows: 'Workflows',
  extensions: 'Extensions',
  checkpoints: 'Checkpoints',
  collaboration: 'Collaboration',
  security: 'Security',
  debug: 'Debug',
  automations: 'Automations',
  config: 'Config',
  feedback: 'Feedback',
  github: 'GitHub',
  integrations: 'Integrations',
  mcp: 'MCP',
  monitoring: 'Monitoring',
  networking: 'Networking',
  publishing: 'Publishing',
  skills: 'Skills',
  ssh: 'SSH',
  threads: 'Threads',
  'test-runner': 'Tests',
  'security-scanner': 'Security Scan',
  backup: 'Backup',
  'merge-conflicts': 'Merge',
  logs: 'Logs',
  resources: 'Resources',
  console: 'Console',
};

export function ReplitMobileHeader({ activeTab, onBack, onHistory, onNewTab, onMore, isRunning, onRunStop, projectName }: ReplitMobileHeaderProps) {
  return (
    <header
      className="flex items-center justify-between h-12 px-2 bg-[var(--ide-bg)] border-b border-[var(--ide-border)] shrink-0 z-50 relative"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <button
          onClick={onBack}
          className="w-11 h-11 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] active:bg-[var(--ide-surface)] rounded-xl transition-colors shrink-0"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col min-w-0">
          {projectName && (
            <span className="text-[10px] text-[var(--ide-text-muted)] leading-tight truncate">{projectName}</span>
          )}
          <span className="text-[13px] font-semibold text-[var(--ide-text)] leading-tight truncate">
            {tabLabels[activeTab] || activeTab}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onRunStop && (
          <button
            onClick={onRunStop}
            className={cn(
              'h-8 px-3 flex items-center justify-center gap-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95',
              isRunning
                ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                : 'bg-[#0CCE6B] text-[#0E1525] shadow-[0_0_8px_rgba(12,206,107,0.3)]'
            )}
            aria-label={isRunning ? 'Stop' : 'Run'}
          >
            {isRunning ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
            {isRunning ? 'Stop' : 'Run'}
          </button>
        )}
        {onHistory && (
          <button onClick={onHistory} className="w-11 h-11 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] active:bg-[var(--ide-surface)] rounded-xl transition-colors">
            <Clock className="w-4.5 h-4.5" />
          </button>
        )}
        {onNewTab && (
          <button onClick={onNewTab} className="w-11 h-11 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] active:bg-[var(--ide-surface)] rounded-xl transition-colors">
            <Plus className="w-4.5 h-4.5" />
          </button>
        )}
        {onMore && (
          <button onClick={onMore} className="w-11 h-11 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] active:bg-[var(--ide-surface)] rounded-xl transition-colors">
            <MoreHorizontal className="w-4.5 h-4.5" />
          </button>
        )}
      </div>
    </header>
  );
}
