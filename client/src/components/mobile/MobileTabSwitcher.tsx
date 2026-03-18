import { cn } from '@/lib/utils';
import { X, Plus, Key, Database, Shield } from 'lucide-react';

interface OpenTab {
  id: string;
  name: string;
  icon: string;
}

interface MobileTabSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  openTabs: OpenTab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onNewTab: () => void;
  onQuickAccess?: (toolId: string) => void;
}

export function MobileTabSwitcher({
  isOpen, onClose, openTabs, activeTabId, onTabSelect, onTabClose, onNewTab, onQuickAccess,
}: MobileTabSwitcherProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--ide-bg)]/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between h-11 px-4 border-b border-[var(--ide-border)]">
        <h2 className="text-sm font-semibold text-[var(--ide-text)]">Open Tabs</h2>
        <div className="flex items-center gap-2">
          <button onClick={onNewTab} className="text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]">
            <Plus className="w-5 h-5" />
          </button>
          <button onClick={onClose} className="text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3 grid grid-cols-2 gap-2 content-start">
        {openTabs.map(tab => (
          <div
            key={tab.id}
            className={cn(
              'relative p-3 rounded-xl border transition-all active:scale-95',
              activeTabId === tab.id
                ? 'border-[#0079F2] bg-[#0079F2]/10'
                : 'border-[var(--ide-border)] bg-[var(--ide-panel)]'
            )}
            onClick={() => { onTabSelect(tab.id); onClose(); }}
          >
            <span className="text-xs font-medium text-[var(--ide-text)]">{tab.name}</span>
            <button
              className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)]"
              onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      {onQuickAccess && (
        <div className="border-t border-[var(--ide-border)] p-3">
          <p className="text-[10px] text-[var(--ide-text-muted)] uppercase tracking-wider mb-2 font-bold">Quick Access</p>
          <div className="flex gap-2">
            {[
              { id: 'secrets', icon: Key, label: 'Secrets' },
              { id: 'database', icon: Database, label: 'Database' },
              { id: 'auth', icon: Shield, label: 'Auth' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => { onQuickAccess(id); onClose(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--ide-panel)] border border-[var(--ide-border)] text-xs text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)] transition-colors"
              >
                <Icon className="w-3 h-3" /> {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
