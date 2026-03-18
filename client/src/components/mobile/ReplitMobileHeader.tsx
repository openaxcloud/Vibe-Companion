import { cn } from '@/lib/utils';
import { ChevronLeft, Clock, Plus, MoreHorizontal } from 'lucide-react';
import type { MobileTab } from './ReplitMobileNavigation';

interface ReplitMobileHeaderProps {
  activeTab: MobileTab;
  onBack: () => void;
  onHistory?: () => void;
  onNewTab?: () => void;
  onMore?: () => void;
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
};

export function ReplitMobileHeader({ activeTab, onBack, onHistory, onNewTab, onMore }: ReplitMobileHeaderProps) {
  return (
    <header className="flex items-center justify-between h-11 px-2 bg-[var(--ide-bg)] border-b border-[var(--ide-border)] shrink-0 z-40">
      <div className="flex items-center gap-1">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-[13px] font-semibold text-[var(--ide-text)]">
          {tabLabels[activeTab] || activeTab}
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        {onHistory && (
          <button onClick={onHistory} className="w-8 h-8 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] rounded-lg transition-colors">
            <Clock className="w-4 h-4" />
          </button>
        )}
        {onNewTab && (
          <button onClick={onNewTab} className="w-8 h-8 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        )}
        {onMore && (
          <button onClick={onMore} className="w-8 h-8 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] rounded-lg transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}
