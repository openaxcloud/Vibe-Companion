import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  Search, 
  FileCode, 
  Terminal, 
  Settings, 
  GitBranch, 
  Bug, 
  Database,
  Package,
  History,
  Key,
  Bot,
  TestTube,
  FolderOpen
} from 'lucide-react';
import { File } from '@shared/schema';

export interface Command {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category?: 'navigation' | 'tool' | 'file' | 'action';
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands?: Command[];
  files?: File[];
  onFileSelect?: (fileId: number) => void;
  onToolSelect?: (tool: string) => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  commands = [],
  files = [],
  onFileSelect,
  onToolSelect,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase();
    
    const filteredCommands = commands.filter(
      cmd => cmd.title.toLowerCase().includes(q) || 
             cmd.description?.toLowerCase().includes(q)
    );
    
    const filteredFiles = files
      .filter(f => !f.isDirectory && f.name.toLowerCase().includes(q))
      .slice(0, 10)
      .map(f => ({
        id: `file-${f.id}`,
        title: f.name,
        description: f.path || '',
        icon: <FileCode className="h-4 w-4" />,
        action: () => onFileSelect?.(f.id),
        category: 'file' as const,
        shortcut: undefined as string | undefined,
      }));

    return [...filteredCommands, ...filteredFiles];
  }, [query, commands, files, onFileSelect]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          onOpenChange(false);
        }
        break;
      case 'Escape':
        onOpenChange(false);
        break;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden" onKeyDown={handleKeyDown}>
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground mr-2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, files..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-12"
            autoFocus
            data-testid="input-command-palette-search"
          />
        </div>
        
        <ScrollArea className="max-h-80">
          {filteredItems.length === 0 ? (
            <div className="p-4 text-center text-[13px] text-muted-foreground">
              No results found
            </div>
          ) : (
            <div className="p-2">
              {filteredItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onOpenChange(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-[13px]",
                    "hover:bg-accent hover:text-accent-foreground",
                    index === selectedIndex && "bg-accent text-accent-foreground"
                  )}
                  data-testid={`command-item-${item.id}`}
                >
                  <span className="text-muted-foreground">
                    {item.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.title}</div>
                    {item.description && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {item.description}
                      </div>
                    )}
                  </div>
                  {item.shortcut && (
                    <kbd className="text-[11px] bg-muted px-1.5 py-0.5 rounded">
                      {item.shortcut}
                    </kbd>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface GenerateCommandsOptions {
  onToolSelect?: (tool: string) => void;
  onNavigate?: (path: string) => void;
}

export function generateDefaultCommands(options: GenerateCommandsOptions): Command[] {
  const { onToolSelect, onNavigate } = options;
  
  return [
    {
      id: 'tool-files',
      title: 'Files',
      description: 'Open file explorer',
      icon: <FolderOpen className="h-4 w-4" />,
      shortcut: '⌘1',
      action: () => onToolSelect?.('files'),
      category: 'tool',
    },
    {
      id: 'tool-search',
      title: 'Search',
      description: 'Search in project',
      icon: <Search className="h-4 w-4" />,
      shortcut: '⌘⇧F',
      action: () => onToolSelect?.('search'),
      category: 'tool',
    },
    {
      id: 'tool-terminal',
      title: 'Terminal',
      description: 'Open terminal',
      icon: <Terminal className="h-4 w-4" />,
      shortcut: '⌘`',
      action: () => onToolSelect?.('terminal'),
      category: 'tool',
    },
    {
      id: 'tool-git',
      title: 'Git',
      description: 'Version control',
      icon: <GitBranch className="h-4 w-4" />,
      action: () => onToolSelect?.('git'),
      category: 'tool',
    },
    {
      id: 'tool-agent',
      title: 'AI Agent',
      description: 'Open AI assistant',
      icon: <Bot className="h-4 w-4" />,
      action: () => onToolSelect?.('agent'),
      category: 'tool',
    },
    {
      id: 'tool-debugger',
      title: 'Debugger',
      description: 'Debug your code',
      icon: <Bug className="h-4 w-4" />,
      action: () => onToolSelect?.('debugger'),
      category: 'tool',
    },
    {
      id: 'tool-testing',
      title: 'Testing',
      description: 'Run tests',
      icon: <TestTube className="h-4 w-4" />,
      action: () => onToolSelect?.('testing'),
      category: 'tool',
    },
    {
      id: 'tool-database',
      title: 'Database',
      description: 'Database explorer',
      icon: <Database className="h-4 w-4" />,
      action: () => onToolSelect?.('database'),
      category: 'tool',
    },
    {
      id: 'tool-packages',
      title: 'Packages',
      description: 'Manage dependencies',
      icon: <Package className="h-4 w-4" />,
      action: () => onToolSelect?.('packages'),
      category: 'tool',
    },
    {
      id: 'tool-secrets',
      title: 'Secrets',
      description: 'Manage environment variables',
      icon: <Key className="h-4 w-4" />,
      action: () => onToolSelect?.('secrets'),
      category: 'tool',
    },
    {
      id: 'tool-history',
      title: 'History',
      description: 'View project history',
      icon: <History className="h-4 w-4" />,
      action: () => onToolSelect?.('history'),
      category: 'tool',
    },
    {
      id: 'tool-settings',
      title: 'Settings',
      description: 'Project settings',
      icon: <Settings className="h-4 w-4" />,
      shortcut: '⌘,',
      action: () => onToolSelect?.('settings'),
      category: 'tool',
    },
  ];
}
