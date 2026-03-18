import { cn } from '@/lib/utils';
import {
  FolderOpen, Search, GitBranch, Package, Bug, Terminal,
  Bot, Rocket, Key, Database, Globe, GitMerge, Clock,
  Puzzle, Settings, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type ActivityItem =
  | 'files' | 'search' | 'git' | 'packages' | 'debug'
  | 'terminal' | 'agent' | 'deploy' | 'secrets' | 'database'
  | 'preview' | 'workflows' | 'history' | 'extensions' | 'settings';

interface ActivityBarItem {
  id: ActivityItem;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  section: 'top' | 'bottom';
}

const activityItems: ActivityBarItem[] = [
  { id: 'files', icon: FolderOpen, label: 'Files', section: 'top' },
  { id: 'search', icon: Search, label: 'Search', section: 'top' },
  { id: 'git', icon: GitBranch, label: 'Version Control', section: 'top' },
  { id: 'packages', icon: Package, label: 'Packages', section: 'top' },
  { id: 'debug', icon: Bug, label: 'Debug', section: 'top' },
  { id: 'terminal', icon: Terminal, label: 'Terminal', section: 'top' },
  { id: 'agent', icon: Bot, label: 'AI Agent', section: 'top' },
  { id: 'deploy', icon: Rocket, label: 'Deploy', section: 'top' },
  { id: 'preview', icon: Globe, label: 'Preview', section: 'top' },
  { id: 'settings', icon: Settings, label: 'Settings', section: 'bottom' },
];

interface ReplitActivityBarProps {
  activeItem: ActivityItem;
  onItemClick: (item: ActivityItem) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  badgeCounts?: Partial<Record<ActivityItem, number>>;
}

export function ReplitActivityBar({
  activeItem, onItemClick, isCollapsed, onToggleCollapse, badgeCounts = {}
}: ReplitActivityBarProps) {
  const topItems = activityItems.filter(i => i.section === 'top');
  const bottomItems = activityItems.filter(i => i.section === 'bottom');

  return (
    <div className="flex flex-col items-center w-12 bg-[var(--ide-bg)] border-r border-[var(--ide-border)] py-2 shrink-0">
      <TooltipProvider delayDuration={300}>
        <div className="flex flex-col items-center gap-1 flex-1">
          {topItems.map(item => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onItemClick(item.id)}
                  className={cn(
                    'relative w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150',
                    activeItem === item.id
                      ? 'bg-[var(--ide-surface)] text-[#0079F2]'
                      : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/50'
                  )}
                  data-testid={`activity-${item.id}`}
                >
                  {activeItem === item.id && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-[#0079F2] rounded-r-full" />
                  )}
                  <item.icon className="w-[18px] h-[18px]" />
                  {badgeCounts[item.id] && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-[#0079F2] text-white text-[8px] font-bold px-1">
                      {badgeCounts[item.id]}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">
                {item.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="flex flex-col items-center gap-1 mt-auto">
          {bottomItems.map(item => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onItemClick(item.id)}
                  className={cn(
                    'w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150',
                    activeItem === item.id
                      ? 'bg-[var(--ide-surface)] text-[#0079F2]'
                      : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/50'
                  )}
                  data-testid={`activity-${item.id}`}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">
                {item.label}
              </TooltipContent>
            </Tooltip>
          ))}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapse}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/50 transition-all duration-150"
                data-testid="toggle-sidebar"
              >
                {isCollapsed ? <PanelLeftOpen className="w-[18px] h-[18px]" /> : <PanelLeftClose className="w-[18px] h-[18px]" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">
              {isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
