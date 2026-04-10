/**
 * ProgressPanel - Replit-style Progress Tab for Tools Dock
 * Shows real-time agent activity feed with file navigation
 * Identical to Replit's Progress tab in the Tools dock
 * Supports WebSocket activity stream for inline chat + Progress dock dual display
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Activity, FileCode, Terminal, Search, Database,
  CheckCircle2, XCircle, Clock, ChevronRight, ChevronDown,
  Loader2, RefreshCw, Filter, ExternalLink, Play, Pause,
  Brain, Wrench, FileEdit, FilePlus, FileX, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { 
  ActivityEvent as StreamActivityEvent,
  ThinkingStep,
  ToolExecutionEvent,
  FileChangeEvent 
} from '@shared/types/agent-activity.types';

interface ActivityEvent {
  id: string;
  type: 'file_create' | 'file_update' | 'file_delete' | 'command' | 'search' | 'database' | 'test' | 'deploy' | 'thinking' | 'tool';
  description: string;
  details?: string;
  filePath?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  timestamp: Date;
  duration?: number;
  thinkingSteps?: ThinkingStep[];
  toolName?: string;
}

interface ProgressPanelProps {
  projectId?: string | number;
  sessionId?: string;
  onFileNavigate?: (filePath: string) => void;
  isLive?: boolean;
  streamEvents?: StreamActivityEvent[];
  isThinking?: boolean;
  thinkingSteps?: ThinkingStep[];
  toolExecutions?: ToolExecutionEvent[];
  fileChanges?: FileChangeEvent[];
}

const getEventIcon = (type: ActivityEvent['type']) => {
  switch (type) {
    case 'file_create':
      return FilePlus;
    case 'file_update':
      return FileEdit;
    case 'file_delete':
      return FileX;
    case 'command':
      return Terminal;
    case 'search':
      return Search;
    case 'database':
      return Database;
    case 'test':
      return Activity;
    case 'deploy':
      return ExternalLink;
    case 'thinking':
      return Brain;
    case 'tool':
      return Wrench;
    default:
      return Activity;
  }
};

const getStatusIcon = (status: ActivityEvent['status']) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case 'failed':
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case 'running':
      return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
    case 'pending':
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return null;
  }
};

const getStatusColor = (status: ActivityEvent['status']) => {
  switch (status) {
    case 'completed':
      return 'border-l-green-500';
    case 'failed':
      return 'border-l-red-500';
    case 'running':
      return 'border-l-blue-500';
    case 'pending':
      return 'border-l-gray-300';
    default:
      return 'border-l-gray-300';
  }
};

function ActivityItem({ 
  event, 
  onFileNavigate,
  isExpanded,
  onToggle 
}: { 
  event: ActivityEvent;
  onFileNavigate?: (filePath: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const Icon = getEventIcon(event.type);
  
  return (
    <div 
      className={cn(
        "border-l-2 pl-3 py-2 hover:bg-surface-hover-solid transition-colors",
        getStatusColor(event.status)
      )}
      data-testid={`activity-event-${event.id}`}
    >
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium truncate">{event.description}</span>
            {getStatusIcon(event.status)}
          </div>
          
          {event.filePath && (
            <button
              onClick={() => onFileNavigate?.(event.filePath!)}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-0.5"
              data-testid={`navigate-file-${event.id}`}
            >
              <FileCode className="h-3 w-3" />
              {event.filePath}
            </button>
          )}
          
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
            </span>
            {event.duration && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                {event.duration}ms
              </Badge>
            )}
          </div>
          
          {event.details && (
            <Collapsible open={isExpanded} onOpenChange={onToggle}>
              <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mt-1">
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Details
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1">
                <pre className="text-[11px] bg-surface-solid rounded p-2 overflow-x-auto max-h-32">
                  {event.details}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProgressPanel({ 
  projectId, 
  sessionId,
  onFileNavigate,
  isLive = true,
  streamEvents,
  isThinking: externalIsThinking,
  thinkingSteps: externalThinkingSteps,
  toolExecutions,
  fileChanges
}: ProgressPanelProps) {
  const [filter, setFilter] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  // Fetch activity events from API
  const { data: actionsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/agent-grid/actions', { sessionId, projectId }],
    enabled: !!sessionId || !!projectId,
    refetchInterval: isLive && !isPaused ? 3000 : false,
  });

  // Transform API data to events
  useEffect(() => {
    if (actionsData?.rows) {
      const transformed: ActivityEvent[] = actionsData.rows.map((row: any) => ({
        id: row.id,
        type: row.actionType?.includes('file') ? 'file_update' : 
              row.actionType?.includes('command') ? 'command' : 
              row.actionType?.includes('search') ? 'search' : 
              row.actionType?.includes('database') ? 'database' : 'command',
        description: row.actionData?.description || row.actionType || 'Action',
        details: row.result ? JSON.stringify(row.result, null, 2) : undefined,
        filePath: row.actionData?.path,
        status: row.status === 'completed' ? 'completed' : 
                row.status === 'failed' ? 'failed' : 
                row.status === 'running' ? 'running' : 'pending',
        timestamp: new Date(row.executedAt || Date.now()),
        duration: row.completedAt && row.executedAt 
          ? new Date(row.completedAt).getTime() - new Date(row.executedAt).getTime()
          : undefined,
      }));
      setEvents(transformed);
    }
  }, [actionsData]);

  // Integrate WebSocket stream events into local events
  useEffect(() => {
    if (!streamEvents?.length) return;
    
    // Transform stream events to ActivityEvents
    const streamToLocalEvents: ActivityEvent[] = [];
    
    (streamEvents || []).forEach(streamEvent => {
      switch (streamEvent.type) {
        case 'thinking_start':
          streamToLocalEvents.push({
            id: streamEvent.id,
            type: 'thinking',
            description: 'Agent is thinking...',
            status: 'running',
            timestamp: new Date(streamEvent.timestamp),
          });
          break;
        case 'thinking_end':
          // Update existing thinking event to completed
          break;
        case 'tool_start':
          if ('toolName' in streamEvent.payload) {
            streamToLocalEvents.push({
              id: streamEvent.id,
              type: 'tool',
              description: `Running ${(streamEvent.payload as ToolExecutionEvent).toolName}`,
              toolName: (streamEvent.payload as ToolExecutionEvent).toolName,
              status: 'running',
              timestamp: new Date(streamEvent.timestamp),
            });
          }
          break;
        case 'tool_complete':
          // Tool completed events handled via toolExecutions prop
          break;
        case 'file_create':
        case 'file_edit':
        case 'file_delete':
          if ('filePath' in streamEvent.payload) {
            const fileEvent = streamEvent.payload as FileChangeEvent;
            streamToLocalEvents.push({
              id: streamEvent.id,
              type: fileEvent.operation === 'create' ? 'file_create' : 
                    fileEvent.operation === 'edit' ? 'file_update' : 'file_delete',
              description: `${fileEvent.operation === 'create' ? 'Created' : 
                           fileEvent.operation === 'edit' ? 'Modified' : 'Deleted'} ${fileEvent.filePath}`,
              filePath: fileEvent.filePath,
              status: 'completed',
              timestamp: new Date(streamEvent.timestamp),
            });
          }
          break;
      }
    });
    
    // Merge with existing events (avoiding duplicates)
    setEvents(prev => {
      const existingIds = new Set(prev.map(e => e.id));
      const newEvents = streamToLocalEvents.filter(e => !existingIds.has(e.id));
      return [...prev, ...newEvents].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    });
  }, [streamEvents]);

  // Update tool execution statuses from props
  useEffect(() => {
    if (!toolExecutions?.length) return;
    
    setEvents(prev => prev.map(event => {
      if (event.type !== 'tool') return event;
      const toolExec = toolExecutions.find(t => t.id === event.id);
      if (!toolExec) return event;
      return {
        ...event,
        status: toolExec.status === 'success' ? 'completed' : 
                toolExec.status === 'error' ? 'failed' : 
                toolExec.status === 'running' ? 'running' : 'pending',
        duration: toolExec.duration,
      };
    }));
  }, [toolExecutions]);

  // Demo events if no real data
  useEffect(() => {
    if (!actionsData?.rows?.length && !isLoading && !streamEvents?.length) {
      setEvents([
        {
          id: 'demo-1',
          type: 'file_create',
          description: 'Created Button component',
          filePath: 'src/components/Button.tsx',
          status: 'completed',
          timestamp: new Date(Date.now() - 60000),
          duration: 234,
        },
        {
          id: 'demo-2',
          type: 'command',
          description: 'Installing dependencies',
          details: 'npm install react-router-dom @tanstack/react-query',
          status: 'completed',
          timestamp: new Date(Date.now() - 45000),
          duration: 3420,
        },
        {
          id: 'demo-3',
          type: 'file_update',
          description: 'Updated App routing',
          filePath: 'src/App.tsx',
          status: 'running',
          timestamp: new Date(Date.now() - 10000),
        },
      ]);
    }
  }, [actionsData, isLoading, streamEvents]);

  // Filter events
  const filteredEvents = filter
    ? events.filter(e => 
        e.description.toLowerCase().includes(filter.toLowerCase()) ||
        e.filePath?.toLowerCase().includes(filter.toLowerCase())
      )
    : events;

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, isPaused]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const stats = {
    total: events.length,
    completed: events.filter(e => e.status === 'completed').length,
    running: events.filter(e => e.status === 'running').length,
    failed: events.filter(e => e.status === 'failed').length,
  };

  return (
    <div className="h-full flex flex-col bg-background" data-testid="progress-panel">
      {/* Header - Replit-style */}
      <div className="px-4 py-3 border-b bg-surface-solid">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-[13px] font-semibold">Progress</h2>
            {isLive && !isPaused && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-900 text-green-400">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1 animate-pulse" />
                Live
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
              className="h-7 w-7 p-0"
              data-testid="button-toggle-live"
            >
              {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="h-7 w-7 p-0"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Thinking indicator */}
        {externalIsThinking && (
          <div className="flex items-center gap-2 mb-2 p-2 bg-surface-solid rounded-md border border-purple-800">
            <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400 animate-pulse" />
            <span className="text-[11px] font-medium text-purple-700 dark:text-purple-300">
              Agent is thinking...
            </span>
            {externalThinkingSteps && externalThinkingSteps.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Step {externalThinkingSteps.length}
              </Badge>
            )}
          </div>
        )}

        {/* Stats bar */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2">
          <span>{stats.total} actions</span>
          <span className="text-green-600">{stats.completed} done</span>
          {stats.running > 0 && <span className="text-blue-600">{stats.running} running</span>}
          {stats.failed > 0 && <span className="text-red-600">{stats.failed} failed</span>}
        </div>

        {/* Filter */}
        <div className="relative">
          <Filter className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter activity..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 pl-8 text-[13px]"
            data-testid="input-filter-activity"
          />
        </div>
      </div>

      {/* Activity Feed */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-[13px] font-medium">No activity yet</p>
              <p className="text-[11px] mt-1">Agent actions will appear here</p>
            </div>
          ) : (
            filteredEvents.map((event) => (
              <ActivityItem
                key={event.id}
                event={event}
                onFileNavigate={onFileNavigate}
                isExpanded={expandedItems.has(event.id)}
                onToggle={() => toggleExpanded(event.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default ProgressPanel;
