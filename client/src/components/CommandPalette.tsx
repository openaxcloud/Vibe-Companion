import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import Fuse from 'fuse.js';
import {
  FileIcon,
  FolderIcon,
  Settings,
  User,
  LogOut,
  Home,
  Code,
  Terminal,
  Package,
  GitBranch,
  Rocket,
  Search,
  Zap,
  Users,
  Book,
  MessageCircle,
  BarChart,
  Shield,
  Plus,
  Play,
  Save,
  Copy,
  Clipboard,
  Eye,
  FileCode,
  Database,
  Sparkles,
  Bug,
  TestTube,
  Key,
  Palette,
  History,
  Share2,
  RefreshCw,
  Command,
  type LucideIcon,
} from 'lucide-react';

const RECENT_COMMANDS_KEY = 'command-palette-recent';
const MAX_RECENT_COMMANDS = 10;

export type CommandCategory = 'file' | 'edit' | 'view' | 'ai' | 'tool' | 'action' | 'navigation' | 'recent';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  category: CommandCategory;
  icon?: React.ReactNode;
  keywords?: string[];
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  commands?: CommandItem[];
  files?: Array<{ id: number; path: string; name: string }>;
  onFileSelect?: (fileId: number) => void;
  onToolSelect?: (toolName: string) => void;
  mode?: 'command' | 'file' | 'all';
  className?: string;
}

const categoryConfig: Record<CommandCategory, { label: string; color: string; icon: LucideIcon }> = {
  file: { label: 'File', color: 'bg-muted text-blue-500 border-border', icon: FileIcon },
  edit: { label: 'Edit', color: 'bg-muted text-yellow-500 border-border', icon: Copy },
  view: { label: 'View', color: 'bg-muted text-purple-500 border-border', icon: Eye },
  ai: { label: 'AI', color: 'bg-muted text-pink-500 border-border', icon: Sparkles },
  tool: { label: 'Tool', color: 'bg-muted text-cyan-500 border-border', icon: Settings },
  action: { label: 'Action', color: 'bg-muted text-green-500 border-border', icon: Zap },
  navigation: { label: 'Navigate', color: 'bg-muted text-orange-500 border-border', icon: Home },
  recent: { label: 'Recent', color: 'bg-muted text-gray-500 border-border', icon: History },
};

function getRecentCommands(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_COMMANDS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { /* Storage check - expected to fail in some environments */
    return [];
  }
}

function saveRecentCommand(commandId: string): void {
  try {
    const recent = getRecentCommands();
    const filtered = recent.filter((id) => id !== commandId);
    const updated = [commandId, ...filtered].slice(0, MAX_RECENT_COMMANDS);
    localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(updated));
  } catch { /* Storage check - expected to fail in some environments */
  }
}

function useSafeAuth() {
  try {
    return useAuth();
  } catch { /* Auth context check - expected to fail when outside AuthProvider */
    return { user: null, logoutMutation: { mutate: () => {} } };
  }
}

export function CommandPalette({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  commands: externalCommands,
  files = [],
  onFileSelect,
  onToolSelect,
  mode = 'all',
  className,
}: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([]);
  const [, navigate] = useLocation();
  const { user, logoutMutation } = useSafeAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  useEffect(() => {
    setRecentCommandIds(getRecentCommands());
  }, [open]);

  const handleLogout = useCallback(() => {
    logoutMutation.mutate();
    setOpen(false);
  }, [logoutMutation, setOpen]);

  const defaultCommands = useMemo((): CommandItem[] => {
    const commands: CommandItem[] = [
      {
        id: 'nav-home',
        label: 'Go to Home',
        description: 'Navigate to the home page',
        icon: <Home className="h-4 w-4" />,
        shortcut: '⌘H',
        category: 'navigation',
        keywords: ['home', 'start', 'main'],
        action: () => { navigate('/'); setOpen(false); },
      },
      {
        id: 'nav-dashboard',
        label: 'Go to Dashboard',
        description: 'View your project dashboard',
        icon: <BarChart className="h-4 w-4" />,
        shortcut: '⌘D',
        category: 'navigation',
        keywords: ['dashboard', 'overview', 'projects'],
        action: () => { navigate('/dashboard'); setOpen(false); },
      },
      {
        id: 'nav-projects',
        label: 'Go to Projects',
        description: 'Browse all your projects',
        icon: <FolderIcon className="h-4 w-4" />,
        category: 'navigation',
        keywords: ['projects', 'repls', 'workspace'],
        action: () => { navigate('/projects'); setOpen(false); },
      },
      {
        id: 'nav-templates',
        label: 'Browse Templates',
        description: 'Explore project templates',
        icon: <Book className="h-4 w-4" />,
        category: 'navigation',
        keywords: ['templates', 'starters', 'boilerplate'],
        action: () => { navigate('/templates'); setOpen(false); },
      },
      {
        id: 'nav-community',
        label: 'Go to Community',
        description: 'Visit the community hub',
        icon: <Users className="h-4 w-4" />,
        category: 'navigation',
        keywords: ['community', 'forum', 'discuss'],
        action: () => { navigate('/community'); setOpen(false); },
      },
      {
        id: 'action-new-project',
        label: 'Create New Project',
        description: 'Start a new coding project',
        icon: <Plus className="h-4 w-4" />,
        shortcut: '⌘N',
        category: 'action',
        keywords: ['new', 'create', 'project', 'repl'],
        action: () => {
          window.dispatchEvent(new CustomEvent('create-project'));
          setOpen(false);
        },
      },
      {
        id: 'action-run',
        label: 'Run Project',
        description: 'Execute the current project',
        icon: <Play className="h-4 w-4" />,
        shortcut: '⌘⏎',
        category: 'action',
        keywords: ['run', 'execute', 'start', 'play'],
        action: () => {
          window.dispatchEvent(new CustomEvent('run-project'));
          const runButton = document.querySelector('[data-testid="button-run-project"]') as HTMLButtonElement;
          runButton?.click();
          setOpen(false);
        },
      },
      {
        id: 'action-save',
        label: 'Save File',
        description: 'Save the current file',
        icon: <Save className="h-4 w-4" />,
        shortcut: '⌘S',
        category: 'action',
        keywords: ['save', 'write', 'store'],
        action: () => {
          window.dispatchEvent(new CustomEvent('save-file'));
          setOpen(false);
        },
      },
      {
        id: 'action-search',
        label: 'Global Search',
        description: 'Search across all files',
        icon: <Search className="h-4 w-4" />,
        shortcut: '⌘⇧F',
        category: 'action',
        keywords: ['search', 'find', 'grep', 'global'],
        action: () => {
          window.dispatchEvent(new CustomEvent('global-search'));
          onToolSelect?.('search');
          setOpen(false);
        },
      },
      {
        id: 'action-deploy',
        label: 'Deploy Project',
        description: 'Deploy to production',
        icon: <Rocket className="h-4 w-4" />,
        category: 'action',
        keywords: ['deploy', 'publish', 'production', 'ship'],
        action: () => {
          window.dispatchEvent(new CustomEvent('deploy-project'));
          onToolSelect?.('deployment');
          setOpen(false);
        },
      },
      {
        id: 'action-share',
        label: 'Share Project',
        description: 'Invite collaborators',
        icon: <Share2 className="h-4 w-4" />,
        category: 'action',
        keywords: ['share', 'invite', 'collaborate'],
        action: () => {
          const shareButton = document.querySelector('[data-testid="button-share-project"]') as HTMLButtonElement;
          shareButton?.click();
          setOpen(false);
        },
      },
      {
        id: 'tool-terminal',
        label: 'Open Terminal',
        description: 'Access the command line',
        icon: <Terminal className="h-4 w-4" />,
        shortcut: '⌘`',
        category: 'tool',
        keywords: ['terminal', 'console', 'shell', 'bash', 'command'],
        action: () => {
          window.dispatchEvent(new CustomEvent('toggle-terminal'));
          onToolSelect?.('terminal');
          setOpen(false);
        },
      },
      {
        id: 'tool-packages',
        label: 'Manage Packages',
        description: 'Install and manage dependencies',
        icon: <Package className="h-4 w-4" />,
        category: 'tool',
        keywords: ['packages', 'npm', 'dependencies', 'modules', 'install'],
        action: () => {
          window.dispatchEvent(new CustomEvent('open-packages'));
          onToolSelect?.('packages');
          setOpen(false);
        },
      },
      {
        id: 'tool-git',
        label: 'Git Panel',
        description: 'Version control and commits',
        icon: <GitBranch className="h-4 w-4" />,
        shortcut: '⌘⇧G',
        category: 'tool',
        keywords: ['git', 'version', 'control', 'commit', 'push', 'pull'],
        action: () => {
          window.dispatchEvent(new CustomEvent('open-git'));
          onToolSelect?.('git');
          setOpen(false);
        },
      },
      {
        id: 'tool-database',
        label: 'Database Panel',
        description: 'Browse and manage databases',
        icon: <Database className="h-4 w-4" />,
        category: 'tool',
        keywords: ['database', 'db', 'sql', 'postgres', 'data'],
        action: () => {
          onToolSelect?.('database');
          setOpen(false);
        },
      },
      {
        id: 'tool-debugger',
        label: 'Debugger',
        description: 'Debug your code',
        icon: <Bug className="h-4 w-4" />,
        category: 'tool',
        keywords: ['debug', 'debugger', 'breakpoint', 'inspect'],
        action: () => {
          onToolSelect?.('debugger');
          setOpen(false);
        },
      },
      {
        id: 'tool-testing',
        label: 'Testing Panel',
        description: 'Run and view tests',
        icon: <TestTube className="h-4 w-4" />,
        category: 'tool',
        keywords: ['test', 'testing', 'spec', 'jest', 'vitest'],
        action: () => {
          onToolSelect?.('testing');
          setOpen(false);
        },
      },
      {
        id: 'tool-secrets',
        label: 'Secrets & Environment',
        description: 'Manage environment variables',
        icon: <Key className="h-4 w-4" />,
        category: 'tool',
        keywords: ['secrets', 'env', 'environment', 'variables', 'keys'],
        action: () => {
          onToolSelect?.('secrets');
          setOpen(false);
        },
      },
      {
        id: 'ai-agent',
        label: 'Open AI Agent',
        description: 'Get AI coding assistance',
        icon: <Sparkles className="h-4 w-4" />,
        shortcut: '⌘I',
        category: 'ai',
        keywords: ['ai', 'agent', 'assistant', 'gpt', 'copilot', 'help'],
        action: () => {
          onToolSelect?.('agent');
          setOpen(false);
        },
      },
      {
        id: 'ai-explain',
        label: 'Explain Code',
        description: 'Get AI explanation of selected code',
        icon: <MessageCircle className="h-4 w-4" />,
        category: 'ai',
        keywords: ['explain', 'ai', 'understand', 'code'],
        action: () => {
          window.dispatchEvent(new CustomEvent('ai-explain'));
          setOpen(false);
        },
      },
      {
        id: 'ai-refactor',
        label: 'Refactor with AI',
        description: 'AI-powered code refactoring',
        icon: <RefreshCw className="h-4 w-4" />,
        category: 'ai',
        keywords: ['refactor', 'ai', 'improve', 'clean'],
        action: () => {
          window.dispatchEvent(new CustomEvent('ai-refactor'));
          setOpen(false);
        },
      },
      {
        id: 'view-files',
        label: 'Files Panel',
        description: 'Browse project files',
        icon: <FolderIcon className="h-4 w-4" />,
        category: 'view',
        keywords: ['files', 'explorer', 'tree', 'sidebar'],
        action: () => {
          onToolSelect?.('files');
          setOpen(false);
        },
      },
      {
        id: 'view-themes',
        label: 'Themes & Appearance',
        description: 'Customize appearance',
        icon: <Palette className="h-4 w-4" />,
        category: 'view',
        keywords: ['themes', 'appearance', 'colors', 'dark', 'light', 'mode'],
        action: () => {
          onToolSelect?.('themes');
          setOpen(false);
        },
      },
      {
        id: 'edit-copy',
        label: 'Copy',
        description: 'Copy to clipboard',
        icon: <Copy className="h-4 w-4" />,
        shortcut: '⌘C',
        category: 'edit',
        keywords: ['copy', 'clipboard'],
        action: () => {
          document.execCommand('copy');
          setOpen(false);
        },
      },
      {
        id: 'edit-paste',
        label: 'Paste',
        description: 'Paste from clipboard',
        icon: <Clipboard className="h-4 w-4" />,
        shortcut: '⌘V',
        category: 'edit',
        keywords: ['paste', 'clipboard'],
        action: () => {
          document.execCommand('paste');
          setOpen(false);
        },
      },
      {
        id: 'user-profile',
        label: 'View Profile',
        description: 'View your user profile',
        icon: <User className="h-4 w-4" />,
        category: 'navigation',
        keywords: ['profile', 'account', 'user'],
        action: () => {
          if (user) navigate(`/u/${user.username}`);
          setOpen(false);
        },
      },
      {
        id: 'user-settings',
        label: 'Settings',
        description: 'Configure your preferences',
        icon: <Settings className="h-4 w-4" />,
        shortcut: '⌘,',
        category: 'tool',
        keywords: ['settings', 'preferences', 'config', 'options'],
        action: () => {
          navigate('/user/settings');
          onToolSelect?.('settings');
          setOpen(false);
        },
      },
      {
        id: 'user-logout',
        label: 'Log Out',
        description: 'Sign out of your account',
        icon: <LogOut className="h-4 w-4" />,
        category: 'action',
        keywords: ['logout', 'signout', 'exit'],
        action: handleLogout,
      },
    ];

    if (user?.username === 'admin') {
      commands.push({
        id: 'admin-dashboard',
        label: 'Admin Dashboard',
        description: 'Access admin controls',
        icon: <Shield className="h-4 w-4" />,
        category: 'navigation',
        keywords: ['admin', 'dashboard', 'manage'],
        action: () => { navigate('/admin'); setOpen(false); },
      });
    }

    return commands;
  }, [navigate, user, handleLogout, setOpen, onToolSelect]);

  const allCommands = useMemo(() => {
    const fileCommands: CommandItem[] = files.map((file) => ({
      id: `file-${file.id}`,
      label: file.name,
      description: file.path,
      category: 'file' as const,
      icon: <FileCode className="h-4 w-4" />,
      keywords: [file.name, file.path, 'open', 'edit'],
      action: () => {
        onFileSelect?.(file.id);
        saveRecentCommand(`file-${file.id}`);
        setOpen(false);
      },
    }));

    const commandsToUse = externalCommands || defaultCommands;
    const combined = [...commandsToUse, ...fileCommands];

    if (mode === 'file') {
      return fileCommands;
    }
    if (mode === 'command') {
      return commandsToUse;
    }
    return combined;
  }, [externalCommands, defaultCommands, files, onFileSelect, setOpen, mode]);

  const fuse = useMemo(
    () =>
      new Fuse(allCommands, {
        keys: [
          { name: 'label', weight: 0.4 },
          { name: 'description', weight: 0.2 },
          { name: 'keywords', weight: 0.3 },
          { name: 'category', weight: 0.1 },
        ],
        threshold: 0.4,
        includeScore: true,
        minMatchCharLength: 1,
        ignoreLocation: true,
      }),
    [allCommands]
  );

  const results = useMemo(() => {
    if (!search.trim()) {
      const recentItems = allCommands
        .filter((cmd) => recentCommandIds.includes(cmd.id))
        .sort((a, b) => recentCommandIds.indexOf(a.id) - recentCommandIds.indexOf(b.id))
        .slice(0, 5);

      const otherItems = allCommands.filter((cmd) => !recentCommandIds.includes(cmd.id));
      return [...recentItems, ...otherItems].slice(0, 30);
    }
    return fuse.search(search).map((result) => result.item).slice(0, 30);
  }, [search, fuse, allCommands, recentCommandIds]);

  const groupedResults = useMemo(() => {
    const groups = new Map<CommandCategory, CommandItem[]>();

    results.forEach((cmd) => {
      const category = recentCommandIds.includes(cmd.id) && !search.trim() ? 'recent' : cmd.category;
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(cmd);
    });

    const categoryOrder: CommandCategory[] = ['recent', 'action', 'ai', 'file', 'edit', 'view', 'tool', 'navigation'];
    return Array.from(groups.entries()).sort(
      (a, b) => categoryOrder.indexOf(a[0]) - categoryOrder.indexOf(b[0])
    );
  }, [results, recentCommandIds, search]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedIndex(0);
    } else {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        setOpen(true);
        setSearch('>');
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setOpen(true);
        setSearch('');
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, setOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        const cmd = results[selectedIndex];
        saveRecentCommand(cmd.id);
        setRecentCommandIds((prev) => {
          const filtered = prev.filter((id) => id !== cmd.id);
          return [cmd.id, ...filtered].slice(0, MAX_RECENT_COMMANDS);
        });
        cmd.action();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    },
    [results, selectedIndex, setOpen]
  );

  useEffect(() => {
    if (scrollAreaRef.current) {
      const selectedElement = scrollAreaRef.current.querySelector(
        `[data-command-index="${selectedIndex}"]`
      );
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  let flatIndex = 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        data-testid="dialog-command-palette"
        className={cn(
          "max-w-2xl p-0 gap-0 overflow-hidden",
          className
        )}
        onKeyDown={handleKeyDown}
      >
        <VisuallyHidden.Root asChild>
          <DialogTitle>Command Palette</DialogTitle>
        </VisuallyHidden.Root>
        <VisuallyHidden.Root asChild>
          <DialogDescription>Search for commands, files, and actions</DialogDescription>
        </VisuallyHidden.Root>
        <div className="flex items-center border-b px-3">
          <Command className="h-4 w-4 text-muted-foreground mr-2 flex-shrink-0" />
          <Input
            ref={inputRef}
            data-testid="input-command-palette-search"
            placeholder="Type a command or search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-12"
            autoComplete="off"
          />
          <kbd className="ml-auto px-2 py-1 text-[11px] text-muted-foreground bg-muted rounded font-mono">
            ESC
          </kbd>
        </div>

        <ScrollArea ref={scrollAreaRef} className="max-h-[400px]">
          <div className="py-2">
            {results.length === 0 ? (
              <div 
                data-testid="text-command-palette-empty"
                className="px-4 py-8 text-center text-[13px] text-muted-foreground"
              >
                No results found for "{search}"
              </div>
            ) : (
              groupedResults.map(([category, items]) => {
                const config = categoryConfig[category];
                return (
                  <div key={category}>
                    <div className="px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {config.label}
                    </div>
                    {items.map((item) => {
                      const currentIndex = flatIndex++;
                      const isSelected = currentIndex === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          data-testid={`button-command-${item.id}`}
                          data-command-index={currentIndex}
                          onClick={() => {
                            saveRecentCommand(item.id);
                            item.action();
                          }}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                          className={cn(
                            "w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors",
                            isSelected
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-accent/50"
                          )}
                        >
                          <div className="flex-shrink-0 text-muted-foreground">
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{item.label}</span>
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] px-1.5 py-0 hidden sm:inline-flex", config.color)}
                              >
                                {config.label}
                              </Badge>
                            </div>
                            {item.description && (
                              <div className="text-[11px] text-muted-foreground truncate">
                                {item.description}
                              </div>
                            )}
                          </div>
                          {item.shortcut && (
                            <kbd className="hidden sm:inline-block px-2 py-1 text-[11px] rounded bg-muted font-mono text-muted-foreground">
                              {item.shortcut}
                            </kbd>
                          )}
                          {isSelected && (
                            <kbd className="sm:hidden px-2 py-1 text-[11px] rounded bg-muted font-mono text-muted-foreground">
                              ↵
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="border-t px-4 py-2 text-[11px] text-muted-foreground bg-muted/50">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-background font-mono">↑↓</kbd>
                <span>Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-background font-mono">↵</kbd>
                <span>Select</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-background font-mono">Esc</kbd>
                <span>Close</span>
              </span>
            </span>
            <span data-testid="text-command-palette-count" className="text-muted-foreground/60">
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function generateDefaultCommands(callbacks: {
  onToolSelect?: (tool: string) => void;
  onNavigate?: (path: string) => void;
  onClose?: () => void;
}): CommandItem[] {
  const { onToolSelect, onNavigate, onClose } = callbacks;
  const close = () => onClose?.();

  return [
    {
      id: 'ext-tool-files',
      label: 'Files',
      description: 'Browse project files',
      category: 'view',
      icon: <FolderIcon className="h-4 w-4" />,
      keywords: ['files', 'explorer', 'tree', 'browse'],
      action: () => { onToolSelect?.('files'); close(); },
    },
    {
      id: 'ext-tool-search',
      label: 'Search',
      description: 'Search in files',
      category: 'tool',
      icon: <Search className="h-4 w-4" />,
      keywords: ['search', 'find', 'grep'],
      action: () => { onToolSelect?.('search'); close(); },
    },
    {
      id: 'ext-tool-git',
      label: 'Git',
      description: 'Source control',
      category: 'tool',
      icon: <GitBranch className="h-4 w-4" />,
      keywords: ['git', 'version', 'control', 'commit'],
      action: () => { onToolSelect?.('git'); close(); },
    },
    {
      id: 'ext-tool-terminal',
      label: 'Terminal',
      description: 'Open terminal',
      category: 'tool',
      icon: <Terminal className="h-4 w-4" />,
      keywords: ['terminal', 'console', 'shell', 'bash'],
      action: () => { onToolSelect?.('terminal'); close(); },
    },
    {
      id: 'ext-tool-debugger',
      label: 'Debugger',
      description: 'Debug your code',
      category: 'tool',
      icon: <Bug className="h-4 w-4" />,
      keywords: ['debug', 'breakpoint', 'inspect'],
      action: () => { onToolSelect?.('debugger'); close(); },
    },
    {
      id: 'ext-tool-testing',
      label: 'Testing',
      description: 'Run tests',
      category: 'tool',
      icon: <TestTube className="h-4 w-4" />,
      keywords: ['test', 'testing', 'spec', 'jest'],
      action: () => { onToolSelect?.('testing'); close(); },
    },
    {
      id: 'ext-tool-database',
      label: 'Database',
      description: 'Database management',
      category: 'tool',
      icon: <Database className="h-4 w-4" />,
      keywords: ['database', 'db', 'sql', 'postgres'],
      action: () => { onToolSelect?.('database'); close(); },
    },
    {
      id: 'ext-tool-packages',
      label: 'Packages',
      description: 'Manage dependencies',
      category: 'tool',
      icon: <Package className="h-4 w-4" />,
      keywords: ['packages', 'npm', 'dependencies', 'install'],
      action: () => { onToolSelect?.('packages'); close(); },
    },
    {
      id: 'ext-tool-agent',
      label: 'AI Agent',
      description: 'AI assistant',
      category: 'ai',
      icon: <Sparkles className="h-4 w-4" />,
      keywords: ['ai', 'agent', 'assistant', 'gpt'],
      action: () => { onToolSelect?.('agent'); close(); },
    },
    {
      id: 'ext-tool-settings',
      label: 'Settings',
      description: 'Project settings',
      category: 'tool',
      icon: <Settings className="h-4 w-4" />,
      keywords: ['settings', 'config', 'preferences'],
      action: () => { onToolSelect?.('settings'); close(); },
    },
    {
      id: 'ext-action-run',
      label: 'Run Project',
      description: 'Start the development server',
      category: 'action',
      icon: <Play className="h-4 w-4" />,
      keywords: ['run', 'start', 'dev', 'serve'],
      action: () => { onToolSelect?.('shell'); close(); },
    },
    {
      id: 'ext-action-deploy',
      label: 'Deploy',
      description: 'Deploy to production',
      category: 'action',
      icon: <Rocket className="h-4 w-4" />,
      keywords: ['deploy', 'publish', 'production'],
      action: () => { onToolSelect?.('deployment'); close(); },
    },
  ];
}

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
    setIsOpen,
  };
}

export default CommandPalette;
