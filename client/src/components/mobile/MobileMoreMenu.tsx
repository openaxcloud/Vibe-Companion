import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  X, GitBranch, Package, Key, Database, Settings, Bug,
  Users, GitMerge, Clock, Puzzle, Shield, Rocket, Globe,
  Zap, Layers, Search, Keyboard, Terminal,
  Bot, FileCode, Inbox, Github, Plug, Cpu, Network,
  Upload, Sparkles, Server, MessageCircle, FlaskConical,
  ShieldCheck, HardDrive, Wrench,
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
  onOpenAutomations?: () => void;
  onOpenConfig?: () => void;
  onOpenFeedback?: () => void;
  onOpenGitHub?: () => void;
  onOpenIntegrations?: () => void;
  onOpenMCP?: () => void;
  onOpenMergeConflicts?: () => void;
  onOpenMonitoring?: () => void;
  onOpenNetworking?: () => void;
  onOpenSkills?: () => void;
  onOpenSSH?: () => void;
  onOpenThreads?: () => void;
  onOpenTestRunner?: () => void;
  onOpenSecurityScanner?: () => void;
  onOpenBackup?: () => void;
  problemsCount?: number;
}

export function MobileMoreMenu({ isOpen, inline, onClose, ...handlers }: MobileMoreMenuProps) {
  if (!isOpen && !inline) return null;

  const menuItems = [
    { label: 'Search', icon: Search, color: '#4B9EF5', action: handlers.onOpenGlobalSearch },
    { label: 'Checkpoints', icon: Layers, color: '#10B981', action: handlers.onOpenCheckpoints },
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
    { label: 'GitHub', icon: Github, color: '#F0F6FC', action: handlers.onOpenGitHub },
    { label: 'Automations', icon: Bot, color: '#0CCE6B', action: handlers.onOpenAutomations },
    { label: 'Config', icon: FileCode, color: '#0079F2', action: handlers.onOpenConfig },
    { label: 'Feedback', icon: Inbox, color: '#F5A623', action: handlers.onOpenFeedback },
    { label: 'Integrations', icon: Plug, color: '#7C65CB', action: handlers.onOpenIntegrations },
    { label: 'MCP', icon: Cpu, color: '#0079F2', action: handlers.onOpenMCP },
    { label: 'Conflicts', icon: GitMerge, color: '#E54D4D', action: handlers.onOpenMergeConflicts },
    { label: 'Monitoring', icon: Zap, color: '#10B981', action: handlers.onOpenMonitoring },
    { label: 'Networking', icon: Network, color: '#0079F2', action: handlers.onOpenNetworking },
    { label: 'Skills', icon: Sparkles, color: '#F5A623', action: handlers.onOpenSkills },
    { label: 'SSH', icon: Server, color: '#6B7280', action: handlers.onOpenSSH },
    { label: 'Threads', icon: MessageCircle, color: '#7C65CB', action: handlers.onOpenThreads },
    { label: 'Test Runner', icon: FlaskConical, color: '#0CCE6B', action: handlers.onOpenTestRunner },
    { label: 'Scanner', icon: ShieldCheck, color: '#E54D4D', action: handlers.onOpenSecurityScanner },
    { label: 'Backup', icon: HardDrive, color: '#0079F2', action: handlers.onOpenBackup },
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
              className="flex flex-col items-center justify-center gap-1.5 py-3 min-h-[56px] rounded-xl hover:bg-[var(--ide-surface)] transition-all active:scale-95"
              onClick={() => action?.()}
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
    <div className="fixed inset-0 z-[999] flex flex-col justify-end" data-testid="mobile-more-overlay" style={{ touchAction: 'manipulation' }}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} onTouchEnd={(e) => { e.preventDefault(); onClose(); }} />
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
              className="flex flex-col items-center justify-center gap-1.5 py-3 min-h-[56px] rounded-xl hover:bg-[var(--ide-surface)] transition-all active:scale-95"
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
