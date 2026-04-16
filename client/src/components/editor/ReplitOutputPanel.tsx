import { useState, useEffect, useRef, useMemo } from 'react';
import { updateProblemsCount } from '@/hooks/use-problems-count';
import { LazyMotionDiv } from '@/lib/motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { 
  Terminal,
  Trash2,
  Lock,
  Unlock,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { BuildLog } from '@shared/schema';

interface OutputLine {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: string;
}

interface ReplitOutputPanelProps {
  projectId?: string;
}

function ShimmerSkeletonItem({ className }: { className?: string }) {
  return (
    <LazyMotionDiv
      className={cn("rounded-lg bg-muted", className)}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function ShimmerSkeleton() {
  return (
    <div className="p-3 space-y-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <ShimmerSkeletonItem className="h-4 w-16" />
          <ShimmerSkeletonItem className="h-4 w-12" />
          <ShimmerSkeletonItem className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-6">
      <Terminal className="w-12 h-12 mb-4 opacity-40 text-muted-foreground" />
      <h3 className="text-[17px] font-medium leading-tight text-foreground mb-2">
        No output yet
      </h3>
      <p className="text-[15px] leading-[20px] text-muted-foreground max-w-[280px]">
        Run your project to see output, logs, and build information here.
      </p>
    </div>
  );
}

export function ReplitOutputPanel({ projectId }: ReplitOutputPanelProps) {
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedSource, setSelectedSource] = useState('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: initialLogs, isLoading } = useQuery<BuildLog[]>({
    queryKey: ['/api/workspace/projects', projectId, 'build-logs'],
    enabled: !!projectId,
  });

  useEffect(() => {
    if (initialLogs) {
      const logs: OutputLine[] = initialLogs.map(log => ({
        id: log.id,
        timestamp: new Date(log.timestamp).toLocaleTimeString(),
        level: log.level as 'info' | 'warn' | 'error' | 'debug',
        message: log.message,
        source: log.source || 'build',
      }));
      setOutput(logs);
    }
  }, [initialLogs]);

  useEffect(() => {
    if (!projectId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/build-logs/ws?projectId=${projectId}`);

    ws.onopen = () => {};

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'initial') {
          return;
        }
        
        if (data.type === 'log' && data.log) {
          const log = data.log as BuildLog;
          const newLine: OutputLine = {
            id: log.id,
            timestamp: new Date(log.timestamp).toLocaleTimeString(),
            level: log.level as 'info' | 'warn' | 'error' | 'debug',
            message: log.message,
            source: log.source || 'build',
          };
          setOutput(prev => [...prev, newLine]);
        }
        
        if (data.type === 'cleared') {
          setOutput([]);
        }
      } catch (error) {
        console.error('[Output] Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[Output] WebSocket error:', error);
    };

    ws.onclose = () => {};

    return () => {
      ws.close();
    };
  }, [projectId]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output, autoScroll]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      case 'info':
        return 'text-muted-foreground';
      case 'debug':
        return 'text-muted-foreground';
      default:
        return 'text-foreground';
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return (
          <span className="text-[11px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
            ERROR
          </span>
        );
      case 'warn':
        return (
          <span className="text-[11px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400">
            WARN
          </span>
        );
      case 'info':
        return (
          <span className="text-[11px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-card text-muted-foreground">
            INFO
          </span>
        );
      case 'debug':
        return (
          <span className="text-[11px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-card text-muted-foreground">
            DEBUG
          </span>
        );
      default:
        return null;
    }
  };

  const sources = ['all', ...new Set(output.map(line => line.source))];

  const filteredOutput = output.filter(line => {
    if (filter !== 'all' && line.level !== filter) return false;
    if (selectedSource !== 'all' && line.source !== selectedSource) return false;
    if (searchQuery && !line.message.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const clearOutput = async () => {
    if (!projectId) return;
    
    try {
      await apiRequest('DELETE', `/api/workspace/projects/${projectId}/build-logs`, {});
      setOutput([]);
    } catch (error) {
      console.error('[Output] Error clearing logs:', error);
    }
  };

  const errorCount = output.filter(line => line.level === 'error').length;
  const warnCount = output.filter(line => line.level === 'warn').length;

  useEffect(() => {
    if (projectId) {
      updateProblemsCount(projectId, errorCount, warnCount);
    }
  }, [projectId, errorCount, warnCount]);
  const showEmpty = !isLoading && output.length === 0;
  const showNoMatches = !isLoading && output.length > 0 && filteredOutput.length === 0;

  return (
    <div className="h-full flex flex-col bg-[var(--ecode-surface)]">
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">Output</span>
          <span className="text-[9px] px-1 rounded bg-[var(--ecode-sidebar-hover)] text-[var(--ecode-text-muted)]" data-testid="text-output-count">
            {filteredOutput.length}
          </span>
          {errorCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-medium" data-testid="text-error-count">
              {errorCount} error{errorCount !== 1 ? 's' : ''}
            </span>
          )}
          {warnCount > 0 && errorCount === 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-medium" data-testid="text-warn-count">
              {warnCount} warning{warnCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
            className="h-7 w-7 p-0 rounded hover:bg-[var(--ecode-sidebar-hover)]"
            data-testid="button-toggle-autoscroll"
          >
            {autoScroll ? (
              <Unlock className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearOutput}
            className="h-7 w-7 p-0 rounded hover:bg-[var(--ecode-sidebar-hover)]"
            data-testid="button-clear-output"
          >
            <Trash2 className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          </Button>
        </div>
      </div>

      <div className="px-2.5 py-1 border-b border-[var(--ecode-border)] shrink-0">

        <div className="flex items-center gap-2">
          <Select value={selectedSource} onValueChange={setSelectedSource}>
            <SelectTrigger className="h-8 w-32 text-[13px] rounded-lg bg-card border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {sources.map(source => (
                <SelectItem 
                  key={source} 
                  value={source} 
                  className="text-[13px] text-foreground focus:bg-muted focus:text-foreground"
                >
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-28 text-[13px] rounded-lg bg-card border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all" className="text-[13px] text-foreground focus:bg-muted focus:text-foreground">All</SelectItem>
              <SelectItem value="info" className="text-[13px] text-foreground focus:bg-muted focus:text-foreground">Info</SelectItem>
              <SelectItem value="warn" className="text-[13px] text-foreground focus:bg-muted focus:text-foreground">Warnings</SelectItem>
              <SelectItem value="error" className="text-[13px] text-foreground focus:bg-muted focus:text-foreground">Errors</SelectItem>
              <SelectItem value="debug" className="text-[13px] text-foreground focus:bg-muted focus:text-foreground">Debug</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search output..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-9 text-[13px] rounded-lg bg-card border-border text-foreground placeholder:text-muted-foreground"
              data-testid="input-search-output"
            />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1" ref={scrollRef}>
        {isLoading ? (
          <ShimmerSkeleton />
        ) : showEmpty ? (
          <EmptyState />
        ) : showNoMatches ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-6">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
              <Search className="w-[18px] h-[18px] text-muted-foreground" />
            </div>
            <h3 className="text-[17px] font-medium leading-tight text-foreground mb-2">
              No matching output
            </h3>
            <p className="text-[15px] leading-[20px] text-muted-foreground max-w-[280px]">
              Try adjusting your filters or search query.
            </p>
          </div>
        ) : (
          <div className="p-3 font-mono text-[13px]">
            {filteredOutput.map((line) => (
              <div
                key={line.id}
                className="flex items-start gap-3 py-1.5 px-2 hover:bg-card rounded-lg transition-colors"
                data-testid={`output-line-${line.level}`}
              >
                <span className="text-[13px] text-muted-foreground flex-shrink-0 tabular-nums">
                  {line.timestamp}
                </span>
                <span className="flex-shrink-0">
                  {getLevelBadge(line.level)}
                </span>
                <span className={cn("flex-1 break-all whitespace-pre-wrap text-[15px] leading-[20px]", getLevelColor(line.level))}>
                  {line.message}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
