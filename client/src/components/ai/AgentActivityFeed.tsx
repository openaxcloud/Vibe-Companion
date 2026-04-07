/**
 * Agent Activity Feed Component
 * Real-time activity stream with filters for file ops, commands, and errors
 * Phase 1 UX Enhancement - Nov 2025
 */

import { useState, useMemo } from 'react';
import { 
  FileText, Terminal, Globe, AlertCircle, CheckCircle2, Clock, Loader2,
  ChevronDown, ChevronUp, Filter, Trash2, FilePlus, FileEdit, Package,
  Search, Database, Eye, FolderOpen, Activity, Zap, XCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface ActivityEvent {
  id: string;
  type: 'file_create' | 'file_edit' | 'file_delete' | 'file_read' | 'command' | 'package' | 'search' | 'analysis' | 'error' | 'success';
  target: string;
  description?: string;
  timestamp: Date;
  status: 'pending' | 'running' | 'complete' | 'error';
  duration?: number;
  details?: {
    linesAdded?: number;
    linesRemoved?: number;
    output?: string;
    error?: string;
    filesChanged?: string[];
  };
}

export interface SessionStats {
  duration: number;
  tokensUsed: number;
  estimatedCost: string;
  filesCreated: number;
  filesModified: number;
  filesDeleted: number;
  commandsRun: number;
  errorsCount: number;
  model?: string;
  provider?: string;
}

type ActivityFilter = 'all' | 'files' | 'commands' | 'errors';

const eventIcons: Record<string, React.ElementType> = {
  file_create: FilePlus,
  file_edit: FileEdit,
  file_delete: Trash2,
  file_read: Eye,
  command: Terminal,
  package: Package,
  search: Search,
  analysis: Database,
  error: AlertCircle,
  success: CheckCircle2,
};

const eventLabels: Record<string, string> = {
  file_create: 'Created',
  file_edit: 'Modified',
  file_delete: 'Deleted',
  file_read: 'Read',
  command: 'Command',
  package: 'Package',
  search: 'Search',
  analysis: 'Analysis',
  error: 'Error',
  success: 'Success',
};

const eventCategories: Record<string, ActivityFilter> = {
  file_create: 'files',
  file_edit: 'files',
  file_delete: 'files',
  file_read: 'files',
  command: 'commands',
  package: 'commands',
  search: 'commands',
  analysis: 'commands',
  error: 'errors',
  success: 'commands',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function ActivityEventItem({ event }: { event: ActivityEvent }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = eventIcons[event.type] || Activity;
  const label = eventLabels[event.type] || event.type;
  const hasDetails = event.details?.output || event.details?.error || (event.details?.filesChanged && event.details.filesChanged.length > 0);

  const getStatusColor = () => {
    if (event.status === 'complete' && event.type !== 'error') return 'text-emerald-500';
    if (event.status === 'error' || event.type === 'error') return 'text-red-500';
    if (event.status === 'running') return 'text-blue-500';
    return 'text-slate-400';
  };

  const getStatusIcon = () => {
    if (event.status === 'complete' && event.type !== 'error') {
      return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
    }
    if (event.status === 'error' || event.type === 'error') {
      return <XCircle className="h-3 w-3 text-red-500" />;
    }
    if (event.status === 'running') {
      return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />;
    }
    return <Clock className="h-3 w-3 text-slate-400" />;
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <CollapsibleTrigger asChild>
        <div 
          className={cn(
            "flex items-start gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md cursor-pointer transition-colors",
            "hover:bg-surface-hover-solid",
            event.status === 'error' || event.type === 'error' ? 'bg-red-950' : '',
            event.status === 'running' ? 'bg-blue-950' : ''
          )}
          data-testid={`activity-event-${event.id}`}
        >
          <div className={cn("mt-0.5 shrink-0", getStatusColor())}>
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
          
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 h-4",
                  event.type === 'error' ? 'border-red-500 text-red-500' : ''
                )}
              >
                {label}
              </Badge>
              <code className="text-[10px] sm:text-[11px] bg-muted px-1 rounded truncate max-w-[150px] sm:max-w-[250px]">
                {event.target}
              </code>
            </div>
            
            {event.description && (
              <p className="text-[10px] sm:text-[11px] text-muted-foreground line-clamp-1">
                {event.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] text-muted-foreground shrink-0">
            {event.duration && (
              <span className="hidden sm:inline">{formatDuration(event.duration)}</span>
            )}
            <span>{formatTimestamp(event.timestamp)}</span>
            {getStatusIcon()}
            {hasDetails && (
              isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
            )}
          </div>
        </div>
      </CollapsibleTrigger>

      {hasDetails && (
        <CollapsibleContent>
          <div className="ml-5 sm:ml-6 pl-2 sm:pl-3 border-l-2 border-muted mb-2 space-y-1.5 text-[10px] sm:text-[11px]">
            {event.details?.filesChanged && event.details.filesChanged.length > 0 && (
              <div>
                <span className="text-muted-foreground">Files changed:</span>
                <ul className="mt-0.5 space-y-0.5">
                  {event.details.filesChanged.map((file, i) => (
                    <li key={i}>
                      <code className="bg-muted px-1 rounded">{file}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {event.details?.output && (
              <div>
                <span className="text-muted-foreground">Output:</span>
                <pre className="bg-muted p-1.5 sm:p-2 rounded mt-1 overflow-x-auto max-h-20 sm:max-h-24 overflow-y-auto text-[9px] sm:text-[10px]">
                  {event.details.output}
                </pre>
              </div>
            )}

            {event.details?.error && (
              <div className="text-red-500">
                <span>Error:</span>
                <pre className="bg-red-950 p-1.5 sm:p-2 rounded mt-1 overflow-x-auto max-h-20 overflow-y-auto text-[9px] sm:text-[10px]">
                  {event.details.error}
                </pre>
              </div>
            )}

            {(event.details?.linesAdded !== undefined || event.details?.linesRemoved !== undefined) && (
              <div className="flex items-center gap-2 text-muted-foreground">
                {event.details.linesAdded !== undefined && (
                  <span className="text-emerald-500">+{event.details.linesAdded}</span>
                )}
                {event.details.linesRemoved !== undefined && (
                  <span className="text-red-500">-{event.details.linesRemoved}</span>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

interface AgentActivityFeedProps {
  events: ActivityEvent[];
  stats?: SessionStats;
  isLive?: boolean;
  maxEvents?: number;
  className?: string;
}

export function AgentActivityFeed({ 
  events, 
  stats, 
  isLive = false,
  maxEvents = 100,
  className 
}: AgentActivityFeedProps) {
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [showStats, setShowStats] = useState(true);

  const counts = useMemo(() => {
    const c = { files: 0, commands: 0, errors: 0 };
    (events || []).forEach(e => {
      const cat = eventCategories[e.type] || 'commands';
      if (cat === 'files') c.files++;
      else if (cat === 'commands') c.commands++;
      if (e.type === 'error' || e.status === 'error') c.errors++;
    });
    return c;
  }, [events]);

  const filteredEvents = useMemo(() => {
    const safeEvents = events || [];
    let filtered = safeEvents;
    if (filter === 'files') {
      filtered = safeEvents.filter(e => eventCategories[e.type] === 'files');
    } else if (filter === 'commands') {
      filtered = safeEvents.filter(e => eventCategories[e.type] === 'commands');
    } else if (filter === 'errors') {
      filtered = safeEvents.filter(e => e.type === 'error' || e.status === 'error');
    }
    return filtered.slice(0, maxEvents);
  }, [events, filter, maxEvents]);

  const filterButtons = [
    { id: 'all' as const, label: 'All', count: (events || []).length },
    { id: 'files' as const, label: 'Files', count: counts.files },
    { id: 'commands' as const, label: 'Commands', count: counts.commands },
    { id: 'errors' as const, label: 'Errors', count: counts.errors },
  ];

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3 space-y-2 sm:space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-[13px] sm:text-base">Activity Feed</CardTitle>
            {isLive && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-emerald-950 text-emerald-600 border-emerald-500 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
                Live
              </Badge>
            )}
          </div>
          
          {stats && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => setShowStats(!showStats)}
              data-testid="button-toggle-stats"
            >
              {showStats ? 'Hide Stats' : 'Show Stats'}
            </Button>
          )}
        </div>

        {/* Session Stats */}
        {stats && showStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 sm:p-3 bg-surface-solid rounded-lg text-[10px] sm:text-[11px]" data-testid="session-stats">
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Duration</p>
              <p className="font-medium">{formatDuration(stats.duration)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Tokens</p>
              <p className="font-medium">{stats.tokensUsed.toLocaleString()}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Cost</p>
              <p className="font-medium">{stats.estimatedCost}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Files</p>
              <p className="font-medium">
                <span className="text-emerald-500">+{stats.filesCreated}</span>
                {' / '}
                <span className="text-blue-500">~{stats.filesModified}</span>
                {stats.filesDeleted > 0 && (
                  <>
                    {' / '}
                    <span className="text-red-500">-{stats.filesDeleted}</span>
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 -mb-1">
          {filterButtons.map(({ id, label, count }) => (
            <Button
              key={id}
              variant={filter === id ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                "h-6 px-2 text-[10px] sm:text-[11px] shrink-0",
                filter === id && "bg-surface-tertiary-solid"
              )}
              onClick={() => setFilter(id)}
              disabled={count === 0 && id !== 'all'}
              data-testid={`filter-activity-${id}`}
            >
              {label}
              {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-2 sm:p-3 space-y-0.5 sm:space-y-1">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-[13px] text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No activity yet</p>
              </div>
            ) : (
              filteredEvents.map(event => (
                <ActivityEventItem key={event.id} event={event} />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default AgentActivityFeed;
