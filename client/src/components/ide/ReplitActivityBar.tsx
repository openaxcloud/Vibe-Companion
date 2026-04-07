import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FileText,
  GitBranch,
  Package,
  Bug,
  Settings,
  Terminal,
  Bot,
  Rocket,
  Key,
  Database,
  LayoutGrid,
  Zap,
  Eye,
  ChevronLeft,
  ChevronRight,
  Search,
  ClipboardList,
} from 'lucide-react';

export type ActivityItem = 
  | 'files'
  | 'search'
  | 'git'
  | 'packages'
  | 'debug'
  | 'terminal'
  | 'agent'
  | 'deploy'
  | 'secrets'
  | 'database'
  | 'preview'
  | 'workflows'
  | 'extensions'
  | 'settings'
  | 'history'
  | 'tasks';

interface ActivityBarItem {
  id: ActivityItem;
  icon: typeof FileText;
  label: string;
  shortcut?: string;
  badge?: number | string;
  separator?: boolean;
}

interface ReplitActivityBarProps {
  activeItem: ActivityItem;
  onItemClick: (item: ActivityItem) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
  badgeCounts?: Partial<Record<ActivityItem, number | string>>;
}

const defaultItems: ActivityBarItem[] = [
  { id: 'files', icon: FileText, label: 'Files', shortcut: '⌘⇧E' },
  { id: 'search', icon: Search, label: 'Search', shortcut: '⌘⇧F' },
  { id: 'git', icon: GitBranch, label: 'Git', shortcut: '⌘⇧G' },
  { id: 'packages', icon: Package, label: 'Packages' },
  { id: 'debug', icon: Bug, label: 'Debug', shortcut: '⌘⇧D', separator: true },
  { id: 'terminal', icon: Terminal, label: 'Terminal', shortcut: '⌘`' },
  { id: 'agent', icon: Bot, label: 'AI Agent', shortcut: '⌘⇧A' },
  { id: 'deploy', icon: Rocket, label: 'Deploy' },
  { id: 'secrets', icon: Key, label: 'Secrets' },
  { id: 'database', icon: Database, label: 'Database', separator: true },
  { id: 'preview', icon: Eye, label: 'Preview', shortcut: '⌘⇧P' },
  { id: 'workflows', icon: Zap, label: 'Workflows' },
  { id: 'tasks', icon: ClipboardList, label: 'Tasks', shortcut: '⌘⇧T' },
];

const bottomItems: ActivityBarItem[] = [
  { id: 'extensions', icon: LayoutGrid, label: 'Extensions' },
  { id: 'settings', icon: Settings, label: 'Settings', shortcut: '⌘,' },
];

export function ReplitActivityBar({
  activeItem,
  onItemClick,
  isCollapsed = false,
  onToggleCollapse,
  className,
  badgeCounts = {},
}: ReplitActivityBarProps) {
  const renderItem = (item: ActivityBarItem) => {
    const Icon = item.icon;
    const isActive = activeItem === item.id;
    const badge = badgeCounts[item.id];

    return (
      <div key={item.id} className="relative">
        {item.separator && (
          <div className="mx-2 my-1 border-t border-[var(--ecode-border)]/50" />
        )}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onItemClick(item.id)}
              data-testid={`activity-${item.id}`}
              className={cn(
                'relative w-9 h-9 p-0 rounded-lg transition-all duration-100',
                'hover:bg-[var(--ecode-sidebar-hover)] active:scale-[0.97]',
                'focus-visible:ring-2 focus-visible:ring-[var(--ecode-accent)] focus-visible:ring-offset-0',
                isActive && [
                  'bg-[var(--ecode-accent)]/10',
                  'text-[var(--ecode-accent)]',
                ],
                !isActive && 'text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)]'
              )}
            >
              {isActive && (
                <span 
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-[var(--ecode-accent)]"
                  style={{ marginLeft: '-1px' }}
                />
              )}
              <Icon className={cn(
                "h-[17px] w-[17px] transition-colors duration-100",
                isActive && "text-[var(--ecode-accent)]"
              )} />
              {badge !== undefined && badge !== 0 && (
                <span className={cn(
                  'absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-1',
                  'flex items-center justify-center',
                  'text-[9px] font-bold rounded-full',
                  'bg-[var(--ecode-accent)] text-white',
                  'border border-[var(--ecode-surface)]'
                )}>
                  {typeof badge === 'number' && badge > 99 ? '99+' : badge}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent 
            side="right" 
            sideOffset={12} 
            className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-800 text-white border-zinc-700 shadow-xl"
          >
            <span className="font-medium">{item.label}</span>
            {item.shortcut && (
              <kbd className="ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-zinc-700 dark:bg-zinc-600 rounded text-zinc-300">
                {item.shortcut}
              </kbd>
            )}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'flex flex-col h-full w-11 py-2',
          'bg-[var(--ecode-sidebar-bg)] border-r border-[var(--ecode-border)]',
          className
        )}
        data-testid="activity-bar"
      >
        <div className="flex flex-col items-center gap-0.5 flex-1 px-1">
          {defaultItems.map(renderItem)}
        </div>
        
        <div className="flex flex-col items-center gap-0.5 mt-auto pt-2 border-t border-[var(--ecode-border)]/50 mx-1 px-0">
          {bottomItems.map(renderItem)}
          
          {onToggleCollapse && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleCollapse}
                  data-testid="activity-collapse-toggle"
                  className={cn(
                    'w-9 h-9 p-0 rounded-lg mt-1',
                    'text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)]',
                    'hover:bg-[var(--ecode-sidebar-hover)] active:scale-[0.97]',
                    'transition-all duration-100'
                  )}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronLeft className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent 
                side="right" 
                sideOffset={12}
                className="bg-zinc-900 dark:bg-zinc-800 text-white border-zinc-700"
              >
                {isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
