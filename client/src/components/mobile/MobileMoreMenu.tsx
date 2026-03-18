import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  X, GitBranch, Package, Key, Database, Settings, Bug,
  Users, GitMerge, Clock, Puzzle, Shield, Rocket, Globe,
  Zap, Layers, Search, Keyboard, Terminal,
} from 'lucide-react';

interface MobileMoreMenuProps {
  projectId: string;
  isOpen: boolean;
  inline?: boolean;
  onClose: () => void;
  onOpenFiles?: () => void;
  onOpenGit?: () => void;
  onOpenPackages?: () => void;
  onOpenSecrets?: () => void;
  onOpenDatabase?: () => void;
  onOpenSettings?: () => void;
  onOpenDebug?: () => void;
  onOpenCollaboration?: () => void;
  onOpenWorkflows?: () => void;
  onOpenHistory?: () => void;
  onOpenCheckpoints?: () => void;
  onOpenExtensions?: () => void;
  onOpenSecurity?: () => void;
  onOpenActions?: () => void;
  onOpenTools?: () => void;
  onOpenDeploy?: () => void;
  onOpenWeb?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenGlobalSearch?: () => void;
  onOpenQuickFileSearch?: () => void;
  onOpenKeyboardShortcuts?: () => void;
  problemsCount?: number;
}

export function MobileMoreMenu({ isOpen, inline, onClose, ...handlers }: MobileMoreMenuProps) {
  if (!isOpen && !inline) return null;

  const menuItems = [
    { label: 'Git', icon: GitBranch, color: '#F26522', action: handlers.onOpenGit },
    { label: 'Packages', icon: Package, color: '#0CCE6B', action: handlers.onOpenPackages },
    { label: 'Secrets', icon: Key, color: '#F5A623', action: handlers.onOpenSecrets },
    { label: 'Database', icon: Database, color: '#0079F2', action: handlers.onOpenDatabase },
    { label: 'Debug', icon: Bug, color: '#E54D4D', action: handlers.onOpenDebug },
    { label: 'Security', icon: Shield, color: '#7C65CB', action: handlers.onOpenSecurity },
    { label: 'History', icon: Clock, color: '#F5A623', action: handlers.onOpenHistory },
    { label: 'Workflows', icon: GitMerge, color: '#0079F2', action: handlers.onOpenWorkflows },
    { label: 'Extensions', icon: Puzzle, color: '#0CCE6B', action: handlers.onOpenExtensions },
    { label: 'Collaboration', icon: Users, color: '#7C65CB', action: handlers.onOpenCollaboration },
    { label: 'Settings', icon: Settings, color: '#6B7280', action: handlers.onOpenSettings },
    { label: 'Shortcuts', icon: Keyboard, color: '#9CA3AF', action: handlers.onOpenKeyboardShortcuts },
  ];

  if (inline) {
    return (
      <div className="h-full overflow-auto bg-[var(--ide-panel)]">
        <div className="px-4 py-3">
          <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Tools</span>
        </div>
        <div className="grid grid-cols-4 gap-1 px-3 pb-4">
          {menuItems.map(({ label, icon: Icon, color, action }) => (
            <button
              key={label}
              className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl hover:bg-[var(--ide-surface)] transition-all active:scale-95"
              onClick={action}
            >
              <Icon className="w-5 h-5" style={{ color }} />
              <span className="text-[10px] font-medium text-[var(--ide-text-muted)]">{label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" data-testid="mobile-more-overlay">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--ide-bg)] border-t border-[var(--ide-border)] rounded-t-2xl animate-slide-up" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--ide-border)]" />
        </div>
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">More</span>
          <button onClick={onClose} className="text-[var(--ide-text-muted)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1 px-3 pb-4">
          {menuItems.map(({ label, icon: Icon, color, action }) => (
            <button
              key={label}
              className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl hover:bg-[var(--ide-surface)] transition-all active:scale-95"
              onClick={() => { action?.(); onClose(); }}
            >
              <Icon className="w-5 h-5" style={{ color }} />
              <span className="text-[10px] font-medium text-[var(--ide-text-muted)]">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
