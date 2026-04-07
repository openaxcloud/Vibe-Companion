import React, { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Trash2, Copy, Download, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ConsoleLog {
  id: number;
  type: 'info' | 'error' | 'warn' | 'log' | 'debug';
  message: string;
  timestamp: Date;
  stack?: string;
}

interface ReplitConsoleProps {
  projectId: number;
  isRunning?: boolean;
  executionId?: string;
  className?: string;
}

export function ReplitConsole({ projectId, isRunning, executionId, className }: ReplitConsoleProps) {
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Fetch initial logs
  const { data: initialLogs } = useQuery<ConsoleLog[]>({
    queryKey: [`/api/projects/${projectId}/logs`],
    enabled: !!projectId,
  });

  // WebSocket connection for real-time logs
  useEffect(() => {
    if (!isRunning || !executionId) return;

    const ws = new WebSocket(`ws://${window.location.host}/api/projects/${projectId}/logs/stream?executionId=${executionId}`);
    
    ws.onmessage = (event) => {
      const log = JSON.parse(event.data);
      setLogs(prev => [...prev, {
        ...log,
        id: Date.now() + Math.random(),
        timestamp: new Date(log.timestamp)
      }]);
      
      if (autoScrollRef.current) {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [projectId, isRunning, executionId]);

  // Initialize with any existing logs
  useEffect(() => {
    if (initialLogs) {
      setLogs(initialLogs);
    }
  }, [initialLogs]);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.type === filter;
  });

  const clearLogs = () => {
    setLogs([]);
  };

  const copyLogs = () => {
    const text = filteredLogs
      .map(log => `[${log.timestamp.toLocaleTimeString()}] ${log.type.toUpperCase()}: ${log.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
  };

  const downloadLogs = () => {
    const text = filteredLogs
      .map(log => `[${log.timestamp.toISOString()}] ${log.type.toUpperCase()}: ${log.message}${log.stack ? '\n' + log.stack : ''}`)
      .join('\n\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-logs-${projectId}-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLogColor = (type: ConsoleLog['type']) => {
    switch (type) {
      case 'error': return 'text-red-500';
      case 'warn': return 'text-yellow-500';
      case 'info': return 'text-blue-500';
      case 'debug': return 'text-gray-500';
      default: return 'text-[var(--ecode-text)]';
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-[var(--ecode-background)]", className)}>
      {/* Console Header */}
      <div className="h-8 flex items-center justify-between px-2 border-b border-[var(--ecode-border)]">
        <div className="flex items-center gap-1">
          <Button
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setFilter('all')}
          >
            All ({logs.length})
          </Button>
          <Button
            variant={filter === 'error' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setFilter('error')}
          >
            Errors ({logs.filter(l => l.type === 'error').length})
          </Button>
          <Button
            variant={filter === 'warn' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setFilter('warn')}
          >
            Warnings ({logs.filter(l => l.type === 'warn').length})
          </Button>
        </div>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearLogs}>
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyLogs}>
            <Copy className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={downloadLogs}>
            <Download className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Console Output */}
      <ScrollArea 
        className="flex-1 font-mono text-xs"
        onScroll={(e) => {
          const target = e.target as HTMLElement;
          const isAtBottom = target.scrollHeight - target.scrollTop === target.clientHeight;
          autoScrollRef.current = isAtBottom;
        }}
      >
        <div className="p-2 space-y-0.5">
          {filteredLogs.length === 0 ? (
            <div className="text-[var(--ecode-text-muted)] text-center py-8">
              {isRunning ? 'Waiting for output...' : 'Click "Run" to see output'}
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="group hover:bg-[var(--ecode-sidebar-hover)] px-2 py-0.5 rounded">
                <div className="flex items-start gap-2">
                  <span className="text-[var(--ecode-text-muted)] shrink-0">
                    [{log.timestamp.toLocaleTimeString()}]
                  </span>
                  <span className={cn("font-semibold uppercase text-[10px]", getLogColor(log.type))}>
                    {log.type}
                  </span>
                  <span className="break-all whitespace-pre-wrap">{log.message}</span>
                </div>
                {log.stack && (
                  <pre className="ml-16 mt-1 text-[var(--ecode-text-muted)] text-[10px] whitespace-pre-wrap">
                    {log.stack}
                  </pre>
                )}
              </div>
            ))
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
    </div>
  );
}