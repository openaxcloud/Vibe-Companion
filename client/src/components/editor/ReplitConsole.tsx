import { useEffect, useRef, useState, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Trash2, Copy, Download, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConsoleLog {
  id: string;
  type: 'info' | 'error' | 'warn' | 'log' | 'debug' | 'stdout' | 'stderr' | 'system' | 'exit';
  message: string;
  timestamp: Date;
  stack?: string;
}

interface ReplitConsoleProps {
  projectId: string | number;
  userId?: string | number;
  isRunning?: boolean;
  executionId?: string;
  className?: string;
}

export function ReplitConsole({ projectId, userId, isRunning, executionId, className }: ReplitConsoleProps) {
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [isConnected, setIsConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const previewWsRef = useRef<WebSocket | null>(null);
  const previewReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewDisposedRef = useRef(false);

  const runtimeWsRef = useRef<WebSocket | null>(null);
  const runtimeDisposedRef = useRef(false);

  const addLog = useCallback((type: ConsoleLog['type'], message: string) => {
    if (previewDisposedRef.current && runtimeDisposedRef.current) return;
    const entry: ConsoleLog = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: new Date(),
    };
    setLogs(prev => [...prev, entry]);
    if (autoScrollRef.current && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 10);
    }
  }, []);

  const connectPreviewWs = useCallback(() => {
    if (!projectId || previewDisposedRef.current) return;
    if (previewWsRef.current && previewWsRef.current.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/preview`;

    try {
      const ws = new WebSocket(wsUrl);
      previewWsRef.current = ws;

      ws.onopen = () => {
        if (previewDisposedRef.current) { ws.close(); return; }
        setIsConnected(true);
        ws.send(JSON.stringify({ type: 'subscribe', projectId: String(projectId) }));
      };

      ws.onmessage = (event) => {
        if (previewDisposedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }
          if (String(data.projectId) !== String(projectId)) return;

          switch (data.type) {
            case 'preview:log':
              if (data.log) {
                const isError = data.log.includes('ERROR') || data.log.includes('Error');
                addLog(isError ? 'stderr' : 'stdout', data.log.trim());
              }
              break;
            case 'preview:start':
              addLog('system', 'Starting preview server...');
              break;
            case 'preview:ready':
              addLog('system', 'Preview server is ready.');
              break;
            case 'preview:stop':
              addLog('system', 'Preview server stopped.');
              break;
            case 'preview:error':
              addLog('error', data.error || 'Preview error');
              break;
            case 'preview:status':
              if (data.logs && Array.isArray(data.logs)) {
                for (const log of data.logs) {
                  const isError = log.includes('ERROR') || log.includes('Error');
                  addLog(isError ? 'stderr' : 'stdout', log.trim());
                }
              }
              break;
          }
        } catch {}
      };

      ws.onclose = () => {
        previewWsRef.current = null;
        if (previewDisposedRef.current) return;
        setIsConnected(false);
        if (previewReconnectRef.current) clearTimeout(previewReconnectRef.current);
        previewReconnectRef.current = setTimeout(connectPreviewWs, 3000);
      };

      ws.onerror = (err) => {
        console.error('[ReplitConsole] Preview WebSocket error:', err);
      };
    } catch (err) {
      console.error('[ReplitConsole] Preview WebSocket setup failed:', err);
    }
  }, [projectId, addLog]);

  useEffect(() => {
    previewDisposedRef.current = false;
    connectPreviewWs();
    return () => {
      previewDisposedRef.current = true;
      if (previewReconnectRef.current) clearTimeout(previewReconnectRef.current);
      if (previewWsRef.current) { previewWsRef.current.close(); previewWsRef.current = null; }
    };
  }, [connectPreviewWs]);

  const connectRuntimeWs = useCallback((execId: string) => {
    if (!projectId || runtimeDisposedRef.current) return;
    if (runtimeWsRef.current) { runtimeWsRef.current.close(); runtimeWsRef.current = null; }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({
      projectId: String(projectId),
      userId: String(userId || 'anonymous'),
      executionId: execId,
    });
    const wsUrl = `${protocol}//${window.location.host}/api/runtime/logs/ws?${params.toString()}`;

    try {
      const ws = new WebSocket(wsUrl);
      runtimeWsRef.current = ws;

      ws.onopen = () => {
        if (runtimeDisposedRef.current) { ws.close(); return; }
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        if (runtimeDisposedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'initial' && Array.isArray(data.logs)) {
            for (const log of data.logs) {
              addLog(log.type === 'stderr' ? 'stderr' : 'stdout', log.message || '');
            }
            return;
          }
          if (data.type === 'log' && data.log) {
            addLog(data.log.type === 'stderr' ? 'stderr' : data.log.type || 'stdout', data.log.message || '');
            return;
          }
          if (data.type === 'exit') {
            addLog('exit', `Process exited with code ${data.exitCode ?? 'unknown'}`);
          }
        } catch {}
      };

      ws.onclose = () => {
        runtimeWsRef.current = null;
        if (runtimeDisposedRef.current) return;
      };

      ws.onerror = (err) => {
        console.error('[ReplitConsole] Runtime WebSocket error:', err);
      };
    } catch (err) {
      console.error('[ReplitConsole] Runtime WebSocket setup failed:', err);
    }
  }, [projectId, userId, addLog]);

  useEffect(() => {
    runtimeDisposedRef.current = false;
    if (isRunning && executionId) {
      setLogs([]);
      connectRuntimeWs(executionId);
    }
    return () => {
      runtimeDisposedRef.current = true;
      if (runtimeWsRef.current) { runtimeWsRef.current.close(); runtimeWsRef.current = null; }
    };
  }, [isRunning, executionId, connectRuntimeWs]);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'error') return log.type === 'error' || log.type === 'stderr';
    return log.type === filter;
  });

  const clearLogs = () => setLogs([]);

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
      case 'error':
      case 'stderr':
        return 'text-red-500';
      case 'warn': 
        return 'text-yellow-500';
      case 'info':
      case 'system':
        return 'text-blue-500';
      case 'debug': 
        return 'text-muted-foreground';
      case 'stdout':
      case 'log':
        return 'text-foreground';
      case 'exit':
        return 'text-green-500';
      default: 
        return 'text-foreground';
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-[var(--ecode-background)]", className)}>
      <div className="h-8 flex items-center justify-between px-2 border-b border-[var(--ecode-border)]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium">Console</span>
          </div>
          
          {isRunning && (
            <div className="flex items-center gap-1">
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                isConnected ? "bg-green-500" : "bg-yellow-500"
              )} />
              <span className="text-[11px] text-muted-foreground">
                {isConnected ? 'Live' : 'Connecting...'}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => setFilter('all')}
          >
            All ({logs.length})
          </Button>
          <Button
            variant={filter === 'error' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => setFilter('error')}
          >
            Errors ({logs.filter(l => l.type === 'error' || l.type === 'stderr').length})
          </Button>
          
          <div className="w-px h-4 bg-border mx-1" />
          
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearLogs} title="Clear logs">
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyLogs} title="Copy logs">
            <Copy className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={downloadLogs} title="Download logs">
            <Download className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <ScrollArea 
        className="flex-1 font-mono text-[11px]"
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
