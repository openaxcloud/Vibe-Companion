import { useState } from 'react';
import {
  ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, Clock, Timer,
  FilePlus, FileEdit, Eye, Trash2, FolderOpen, Terminal, Package, Globe,
  Search, Database, AlertTriangle, Brain, Lightbulb, ListChecks, Play,
  type LucideIcon
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface ActionCardProps {
  id: string;
  icon?: LucideIcon;
  iconName?: string;
  title: string;
  subtitle?: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  duration?: number;
  children?: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
  create_file: FilePlus,
  edit_file: FileEdit,
  read_file: Eye,
  delete_file: Trash2,
  list_directory: FolderOpen,
  run_command: Terminal,
  install_package: Package,
  web_search: Globe,
  search_code: Search,
  get_project_structure: Database,
  get_diagnostics: AlertTriangle,
  reasoning: Brain,
  planning: Lightbulb,
  execution: Play,
  verification: ListChecks,
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    iconClass: 'text-slate-400',
    bgClass: 'bg-muted',
    borderClass: 'border-border',
    cardBg: '',
  },
  running: {
    icon: Loader2,
    iconClass: 'text-blue-500 animate-spin',
    bgClass: 'bg-blue-900/40',
    borderClass: 'border-blue-800/60',
    cardBg: 'bg-blue-950/20',
  },
  complete: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-500',
    bgClass: 'bg-emerald-900/40',
    borderClass: 'border-emerald-800/60',
    cardBg: 'bg-emerald-950/10',
  },
  error: {
    icon: XCircle,
    iconClass: 'text-red-500',
    bgClass: 'bg-red-900/40',
    borderClass: 'border-red-800/60',
    cardBg: 'bg-red-950/20',
  },
} as const;

export function ActionCard({
  id,
  icon,
  iconName,
  title,
  subtitle,
  status,
  duration,
  children,
  defaultExpanded = false,
  className,
}: ActionCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const StatusIcon = config.icon;
  const ContentIcon = icon || (iconName ? ICON_MAP[iconName] : null) || Terminal;
  const hasContent = !!children;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card
        className={cn(
          'border transition-all duration-200',
          config.borderClass,
          config.cardBg,
          className
        )}
        data-testid={`action-card-${id}`}
      >
        <CollapsibleTrigger asChild disabled={!hasContent}>
          <div
            className={cn(
              'flex items-center gap-3 px-3 py-3 sm:px-4 sm:py-3.5 rounded-lg transition-colors',
              hasContent && 'cursor-pointer hover:bg-muted/20'
            )}
          >
            <div
              className={cn(
                'flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg',
                config.bgClass
              )}
            >
              <ContentIcon className="h-[18px] w-[18px] text-muted-foreground" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-[13px] font-medium text-foreground truncate">{title}</h4>
                <StatusIcon className={cn('h-4 w-4 flex-shrink-0', config.iconClass)} />
              </div>
              {subtitle && (
                <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {duration != null && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  <span className="text-[11px] tabular-nums font-mono">
                    {formatDuration(duration)}
                  </span>
                </div>
              )}
              {hasContent && (
                isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        {hasContent && (
          <CollapsibleContent>
            <div className="px-3 sm:px-4 pb-3 pt-0">
              <div className="pl-12 pt-2 border-t border-border/40">
                {children}
              </div>
            </div>
          </CollapsibleContent>
        )}
      </Card>
    </Collapsible>
  );
}
