import { useState, useRef, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { 
  Trash2, 
  Copy, 
  Download, 
  Play,
  Square,
  CheckCircle, 
  XCircle,
  Loader2,
  ChevronDown,
  MoreVertical,
  Sparkles,
  Settings,
  Terminal,
  X,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRuntimeLogs, RuntimeLogEntry } from '@/hooks/useRuntimeLogs';
import { useServerLogs, ServerLogEntry } from '@/hooks/useServerLogs';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ConsoleLog {
  id: string;
  type: 'info' | 'error' | 'warn' | 'log' | 'debug' | 'stdout' | 'stderr' | 'system' | 'exit' | 'http';
  message: string;
  timestamp: Date;
  stack?: string;
  method?: string;
  path?: string;
  status?: number;
  duration?: number;
}

interface Workflow {
  id: string;
  name: string;
  command: string;
  description?: string;
  icon?: string;
  isDefault?: boolean;
  isSystem?: boolean;
  isRunning?: boolean;
}

interface ReplitConsolePanelProps {
  projectId: string | number;
  userId?: string | number;
  isRunning?: boolean;
  executionId?: string;
  className?: string;
  onRunWorkflow?: (workflow: Workflow) => void;
  onStopWorkflow?: (workflowId: string) => void;
  onAskAgent?: () => void;
  onManageWorkflows?: () => void;
  onCloseTab?: () => void;
}

const DEFAULT_WORKFLOWS: Workflow[] = [
  { id: 'run-command', name: 'Run .replit run command', command: '.replit run', isSystem: true },
  { id: 'project', name: 'Project', command: 'npm run dev', isDefault: true, isSystem: true },
  { id: 'start-application', name: 'Start application', command: 'npm run dev', isSystem: true },
];

export function ReplitConsolePanel({ 
  projectId, 
  userId, 
  isRunning, 
  executionId, 
  className,
  onRunWorkflow,
  onStopWorkflow,
  onAskAgent,
  onManageWorkflows,
  onCloseTab
}: ReplitConsolePanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [showOnlyLatest, setShowOnlyLatest] = useState(false);
  const [latestRunStartIndex, setLatestRunStartIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [runningWorkflowIds, setRunningWorkflowIds] = useState<Set<string>>(new Set());
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const { data: customWorkflows } = useQuery<Workflow[]>({
    queryKey: ['/api/workflows', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/workflows?projectId=${projectId}`, {
        credentials: 'include'
      });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : (data && typeof data === 'object' && 'workflows' in data && Array.isArray(data.workflows) ? data.workflows : []);
    },
    enabled: !!projectId
  });

  const allWorkflows = [...DEFAULT_WORKFLOWS, ...(customWorkflows || [])];

  const runWorkflowMutation = useMutation({
    mutationFn: async (workflow: Workflow) => {
      return apiRequest('POST', `/api/preview/projects/${projectId}/preview/start`, {
        workflow: workflow.id,
        command: workflow.command
      });
    },
    onMutate: (workflow) => {
      setRunningWorkflowIds(prev => new Set(prev).add(workflow.id));
      setLatestRunStartIndex(logs.length);
    },
    onSuccess: (_, workflow) => {
      toast({ title: `Running: ${workflow.name}` });
      onRunWorkflow?.(workflow);
    },
    onError: (error: Error, workflow) => {
      setRunningWorkflowIds(prev => {
        const next = new Set(prev);
        next.delete(workflow.id);
        return next;
      });
      toast({ title: 'Failed to run workflow', description: error.message, variant: 'destructive' });
    }
  });

  const stopWorkflowMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      return apiRequest('POST', `/api/preview/projects/${projectId}/preview/stop`, {
        workflow: workflowId
      });
    },
    onSuccess: (_, workflowId) => {
      setRunningWorkflowIds(prev => {
        const next = new Set(prev);
        next.delete(workflowId);
        return next;
      });
      toast({ title: 'Workflow stopped' });
      onStopWorkflow?.(workflowId);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to stop workflow', description: error.message, variant: 'destructive' });
    }
  });

  const handleLog = useCallback((log: RuntimeLogEntry) => {
    const consoleLog: ConsoleLog = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: log.type === 'stderr' ? 'error' : log.type === 'exit' ? 'info' : log.type,
      message: log.content,
      timestamp: new Date(log.timestamp),
    };

    if (log.content.match(/^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+/)) {
      const httpMatch = log.content.match(/^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+(\S+)\s+(\d{3})?\s*(\d+ms)?/);
      if (httpMatch) {
        consoleLog.type = 'http';
        consoleLog.method = httpMatch[1];
        consoleLog.path = httpMatch[2];
        consoleLog.status = httpMatch[3] ? parseInt(httpMatch[3]) : undefined;
        consoleLog.duration = httpMatch[4] ? parseInt(httpMatch[4]) : undefined;
      }
    }
    
    setLogs(prev => [...prev, consoleLog]);
    
    if (autoScrollRef.current && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 10);
    }
  }, []);

  const handleServerLog = useCallback((log: ServerLogEntry) => {
    const formatLogMessage = (log: ServerLogEntry): string => {
      const timestamp = log.timestamp ? new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 23) : '';
      const service = log.service ? `[${log.service}]` : '';
      const level = log.level?.toUpperCase() || 'INFO';
      return `${timestamp} ${service} ${level.toLowerCase()}: ${log.message}`;
    };

    const consoleLog: ConsoleLog = {
      id: `server_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: log.level === 'error' ? 'error' : log.level === 'warn' ? 'warn' : log.level === 'debug' ? 'debug' : 'info',
      message: formatLogMessage(log),
      timestamp: new Date(log.timestamp || Date.now()),
    };

    setLogs(prev => {
      const newLogs = [...prev, consoleLog];
      if (newLogs.length > 2000) {
        return newLogs.slice(-2000);
      }
      return newLogs;
    });
    
    if (autoScrollRef.current && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 10);
    }
  }, []);

  const { isConnected, isComplete, exitCode, connect, disconnect, clearLogs: clearWsLogs } = useRuntimeLogs({
    projectId,
    userId,
    executionId,
    enabled: Boolean(isRunning && executionId),
    onLog: handleLog,
  });

  const { 
    isConnected: isServerLogsConnected, 
    clearLogs: clearServerLogs 
  } = useServerLogs({
    projectId,
    userId,
    enabled: true,
    onLog: handleServerLog,
    autoReconnect: true,
  });

  const initialLogsFetched = useRef(false);
  const logsRef = useRef(logs);
  logsRef.current = logs;
  useEffect(() => {
    if (initialLogsFetched.current) return;
    initialLogsFetched.current = true;
    const timer = setTimeout(() => {
      if (logsRef.current.length > 0) return;
      fetch('/api/server/logs', { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.logs?.length && logsRef.current.length === 0) {
            data.logs.forEach((log: ServerLogEntry) => handleServerLog(log));
          }
        })
        .catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [handleServerLog]);

  const previewWsRef = useRef<WebSocket | null>(null);
  const previewReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewDisposedRef = useRef(false);
  const recentPreviewMessagesRef = useRef<Set<string>>(new Set());

  const addPreviewLog = useCallback((entry: { type: 'stdout' | 'stderr' | 'system' | 'exit'; content: string; timestamp: number }) => {
    if (previewDisposedRef.current) return;
    const dedupeKey = `${entry.type}:${entry.content}`;
    if (recentPreviewMessagesRef.current.has(dedupeKey)) return;
    recentPreviewMessagesRef.current.add(dedupeKey);
    setTimeout(() => recentPreviewMessagesRef.current.delete(dedupeKey), 500);
    handleLog(entry);
  }, [handleLog]);

  const connectPreviewLogs = useCallback(() => {
    if (!projectId || previewDisposedRef.current) return;
    if (previewWsRef.current && previewWsRef.current.readyState === WebSocket.OPEN) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/preview`;
    try {
      const ws = new WebSocket(wsUrl);
      previewWsRef.current = ws;
      ws.onopen = () => {
        if (previewDisposedRef.current) { ws.close(); return; }
        ws.send(JSON.stringify({ type: 'subscribe', projectId: String(projectId) }));
      };
      ws.onmessage = (event) => {
        if (previewDisposedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }
          if (String(data.projectId) !== String(projectId)) return;
          if (data.type === 'preview:log' && data.log) {
            const isErr = data.log.includes('ERROR') || data.log.includes('Error');
            addPreviewLog({ type: isErr ? 'stderr' : 'stdout', content: data.log.trim(), timestamp: Date.now() });
          } else if (data.type === 'preview:start') {
            addPreviewLog({ type: 'system', content: 'Starting preview server...', timestamp: Date.now() });
          } else if (data.type === 'preview:ready') {
            addPreviewLog({ type: 'system', content: 'Preview server is ready.', timestamp: Date.now() });
          } else if (data.type === 'preview:error') {
            addPreviewLog({ type: 'stderr', content: data.error || 'Preview error', timestamp: Date.now() });
          } else if (data.type === 'preview:status' && Array.isArray(data.logs)) {
            for (const log of data.logs) {
              addPreviewLog({ type: 'stdout', content: log.trim(), timestamp: Date.now() });
            }
          }
        } catch {}
      };
      ws.onclose = () => {
        previewWsRef.current = null;
        if (previewDisposedRef.current) return;
        if (previewReconnectRef.current) clearTimeout(previewReconnectRef.current);
        previewReconnectRef.current = setTimeout(connectPreviewLogs, 3000);
      };
      ws.onerror = () => {};
    } catch {}
  }, [projectId, addPreviewLog]);

  useEffect(() => {
    previewDisposedRef.current = false;
    connectPreviewLogs();
    return () => {
      previewDisposedRef.current = true;
      if (previewReconnectRef.current) clearTimeout(previewReconnectRef.current);
      if (previewWsRef.current) { previewWsRef.current.close(); previewWsRef.current = null; }
    };
  }, [connectPreviewLogs]);

  useEffect(() => {
    if (isRunning && executionId) {
      setLatestRunStartIndex(logs.length);
      connect(executionId);
    } else if (!isRunning) {
      disconnect();
      setRunningWorkflowIds(new Set());
    }
  }, [isRunning, executionId, connect, disconnect]);

  const displayedLogs = showOnlyLatest 
    ? logs.slice(latestRunStartIndex) 
    : logs;

  const errorCount = displayedLogs.filter(log => log.type === 'error' || log.type === 'stderr').length;

  const clearLogs = () => {
    setLogs([]);
    setLatestRunStartIndex(0);
    clearWsLogs();
    clearServerLogs();
  };

  const clearPastRuns = () => {
    // Keep only the current run's logs, clear all previous runs
    setLogs(prev => prev.slice(latestRunStartIndex));
    setLatestRunStartIndex(0);
    // Also notify backend to clear history
    clearWsLogs();
    toast({ title: 'Past runs cleared' });
  };

  const copyLogs = () => {
    const text = displayedLogs
      .map(log => `[${log.timestamp.toLocaleTimeString()}] ${log.type.toUpperCase()}: ${log.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const downloadLogs = () => {
    const text = displayedLogs
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
        return 'text-destructive';
      case 'warn': 
        return 'text-[hsl(var(--chart-4))]';
      case 'info':
      case 'system':
        return 'text-primary';
      case 'debug': 
        return 'text-muted-foreground';
      case 'http':
        return 'text-blue-500';
      case 'stdout':
      case 'log':
        return 'text-foreground';
      case 'exit':
        return 'text-[hsl(var(--chart-2))]';
      default: 
        return 'text-foreground';
    }
  };

  const getHttpStatusColor = (status?: number) => {
    if (!status) return 'text-muted-foreground';
    if (status >= 200 && status < 300) return 'text-green-500';
    if (status >= 400 && status < 500) return 'text-yellow-500';
    if (status >= 500) return 'text-red-500';
    return 'text-muted-foreground';
  };

  const hasAnyRunning = isRunning || runningWorkflowIds.size > 0;

  return (
    <div className={cn("flex flex-col h-full bg-[var(--ecode-surface)]", className)} data-testid="replit-console-panel">
      <div className="h-9 flex items-center justify-between px-2.5 border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted border border-border">
            <Terminal className="w-4 h-4 text-primary" />
            <span className="text-[11px] font-medium">Console</span>
          </div>
          
          {isServerLogsConnected && (
            <Badge variant="outline" className="h-5 text-[10px] gap-1 border-blue-500/50 bg-blue-500/10 text-blue-600">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-blue-500" />
              Server Live
            </Badge>
          )}
          
          {isRunning && isConnected && (
            <Badge variant="outline" className="h-5 text-[10px] gap-1 border-green-500/50 bg-green-500/10 text-green-600">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-green-500" />
              Runtime
            </Badge>
          )}
          
          {isRunning && !isConnected && (
            <Badge variant="outline" className="h-5 text-[10px] gap-1 border-yellow-500/50 bg-yellow-500/10 text-yellow-600">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-yellow-500" />
              Runtime Connecting...
            </Badge>
          )}
          
          {!isServerLogsConnected && userId && !isRunning && (
            <Badge variant="outline" className="h-5 text-[10px] gap-1 border-yellow-500/50 bg-yellow-500/10 text-yellow-600">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-yellow-500" />
              Connecting...
            </Badge>
          )}
          
          {isComplete && exitCode !== null && (
            <div className="flex items-center gap-1">
              {exitCode === 0 ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-red-500" />
              )}
              <span className={cn("text-[11px]", exitCode === 0 ? "text-green-500" : "text-red-500")}>
                Exit: {exitCode}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6" 
            onClick={() => setMobileMenuOpen(true)} 
            title="More options"
            data-testid="console-menu"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="h-9 flex items-center gap-1 sm:gap-2 px-1 sm:px-2.5 border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)] overflow-x-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 shrink-0" data-testid="workflows-dropdown">
              <Zap className="h-3 w-3" />
              <span className="hidden sm:inline">Workflows</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {allWorkflows.map((workflow) => {
              const isWorkflowRunning = runningWorkflowIds.has(workflow.id);
              return (
                <DropdownMenuItem
                  key={workflow.id}
                  className="flex items-center justify-between py-2"
                  onSelect={(e) => e.preventDefault()}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-[13px] truncate">{workflow.name}</span>
                    {workflow.isDefault && (
                      <Badge variant="outline" className="text-[10px] h-4 shrink-0">Default</Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-6 w-6 shrink-0 ml-2",
                      isWorkflowRunning 
                        ? "text-red-500 hover:text-red-600 hover:bg-red-50" 
                        : "text-green-600 hover:text-green-700 hover:bg-green-50"
                    )}
                    onClick={() => {
                      if (isWorkflowRunning) {
                        stopWorkflowMutation.mutate(workflow.id);
                      } else {
                        runWorkflowMutation.mutate(workflow);
                      }
                    }}
                    disabled={runWorkflowMutation.isPending || stopWorkflowMutation.isPending}
                  >
                    {isWorkflowRunning ? (
                      <Square className="h-3 w-3 fill-current" />
                    ) : (
                      <Play className="h-3 w-3 fill-current" />
                    )}
                  </Button>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onManageWorkflows} className="text-muted-foreground">
              <Settings className="h-3.5 w-3.5 mr-2" />
              Manage Workflows
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-1.5 shrink-0">
          <Switch
            id="show-latest"
            checked={showOnlyLatest}
            onCheckedChange={setShowOnlyLatest}
            className="scale-75"
            data-testid="show-latest-toggle"
          />
          <Label htmlFor="show-latest" className="text-[10px] sm:text-[11px] text-muted-foreground cursor-pointer whitespace-nowrap">
            <span className="hidden sm:inline">Latest Only</span>
            <span className="sm:hidden">Latest</span>
          </Label>
        </div>

        <div className="flex-1 min-w-0" />

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={clearPastRuns}
          title="Clear Past Runs"
          data-testid="clear-past-runs"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] gap-1 text-primary shrink-0"
          onClick={onAskAgent}
          data-testid="ask-agent"
        >
          <Sparkles className="h-3 w-3" />
          <span className="hidden sm:inline">Agent</span>
        </Button>

        {hasAnyRunning && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => {
              runningWorkflowIds.forEach(id => stopWorkflowMutation.mutate(id));
            }}
            disabled={stopWorkflowMutation.isPending}
            data-testid="stop-all-button"
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>
        )}
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
          {displayedLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4" data-testid="console-empty">
              {isRunning ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Waiting for output...</span>
                </div>
              ) : (
                <>
                  <Terminal className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground text-[13px] text-center mb-6">
                    Results of your code will appear here when you run
                  </p>
                  
                  <div className="w-full max-w-sm space-y-4">
                    <div>
                      <h4 className="text-[11px] font-medium text-muted-foreground mb-2">Default</h4>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-2 h-10"
                        onClick={() => {
                          const defaultWorkflow = allWorkflows.find(w => w.isDefault) || allWorkflows[0];
                          if (defaultWorkflow) runWorkflowMutation.mutate(defaultWorkflow);
                        }}
                        disabled={runWorkflowMutation.isPending}
                        data-testid="run-default-workflow"
                      >
                        <div className="h-6 w-6 rounded bg-green-500 flex items-center justify-center">
                          <Play className="h-3 w-3 text-white fill-current" />
                        </div>
                        <span className="text-[13px]">Project</span>
                      </Button>
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Settings className="h-3 w-3 text-muted-foreground" />
                        <h4 className="text-[11px] font-medium text-muted-foreground">Workflows</h4>
                      </div>
                      <div className="space-y-1.5">
                        {allWorkflows.slice(0, 3).map((workflow) => (
                          <Button
                            key={workflow.id}
                            variant="outline"
                            className="w-full justify-start gap-2 h-10"
                            onClick={() => runWorkflowMutation.mutate(workflow)}
                            disabled={runWorkflowMutation.isPending}
                            data-testid={`run-workflow-${workflow.id}`}
                          >
                            <div className="h-6 w-6 rounded bg-green-500 flex items-center justify-center">
                              <Play className="h-3 w-3 text-white fill-current" />
                            </div>
                            <span className="text-[13px]">{workflow.name}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {displayedLogs.map((log) => (
                <div key={log.id} className="group hover:bg-muted/50 px-2 py-0.5 rounded" data-testid={`console-log-${log.id}`}>
                  {log.type === 'http' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground shrink-0">
                        [{log.timestamp.toLocaleTimeString()}]
                      </span>
                      <Badge variant="outline" className={cn("text-[10px] font-mono", getLogColor(log.type))}>
                        {log.method}
                      </Badge>
                      <span className="text-foreground">{log.path}</span>
                      {log.status && (
                        <Badge 
                          variant="outline" 
                          className={cn("text-[10px]", getHttpStatusColor(log.status))}
                        >
                          {log.status}
                        </Badge>
                      )}
                      {log.duration && (
                        <span className="text-muted-foreground text-[10px]">{log.duration}ms</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground shrink-0">
                        [{log.timestamp.toLocaleTimeString()}]
                      </span>
                      <span className={cn("font-semibold uppercase text-[10px]", getLogColor(log.type))}>
                        {log.type}
                      </span>
                      <span className="break-all whitespace-pre-wrap">{log.message}</span>
                    </div>
                  )}
                  {log.stack && (
                    <pre className="ml-16 mt-1 text-muted-foreground text-[10px] whitespace-pre-wrap">
                      {log.stack}
                    </pre>
                  )}
                </div>
              ))}
              <div ref={scrollRef} />
            </>
          )}
        </div>
      </ScrollArea>

      {displayedLogs.length > 0 && (
        <div className="h-7 flex items-center justify-between px-2 border-t bg-muted/30 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>{displayedLogs.length} entries</span>
            {errorCount > 0 && (
              <Badge variant="destructive" className="text-[10px] h-4">
                {errorCount} {errorCount === 1 ? 'error' : 'errors'}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={clearLogs} title="Clear" data-testid="console-clear">
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={copyLogs} title="Copy" data-testid="console-copy">
              <Copy className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={downloadLogs} title="Download" data-testid="console-download">
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[60vh]">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Console
            </SheetTitle>
            <SheetDescription>
              View logs and output from your running code
            </SheetDescription>
          </SheetHeader>
          <div className="py-4 space-y-1">
            <div className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted">
              <Label htmlFor="mobile-show-latest" className="text-[13px] cursor-pointer">
                Show Only Latest Run
              </Label>
              <Switch
                id="mobile-show-latest"
                checked={showOnlyLatest}
                onCheckedChange={setShowOnlyLatest}
                data-testid="mobile-show-latest-toggle"
              />
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-12"
              onClick={() => {
                onAskAgent?.();
                setMobileMenuOpen(false);
              }}
              data-testid="mobile-ask-agent"
            >
              <Sparkles className="h-5 w-5 text-primary" />
              <span>Ask Agent</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-12"
              onClick={() => {
                clearPastRuns();
                setMobileMenuOpen(false);
              }}
              data-testid="mobile-clear-past-runs"
            >
              <Trash2 className="h-5 w-5 text-muted-foreground" />
              <span>Clear Past Runs</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-12"
              onClick={() => {
                copyLogs();
                setMobileMenuOpen(false);
              }}
              data-testid="mobile-copy-logs"
            >
              <Copy className="h-5 w-5 text-muted-foreground" />
              <span>Copy Logs</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-12"
              onClick={() => {
                downloadLogs();
                setMobileMenuOpen(false);
              }}
              data-testid="mobile-download-logs"
            >
              <Download className="h-5 w-5 text-muted-foreground" />
              <span>Download Logs</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-12"
              onClick={() => {
                clearLogs();
                setMobileMenuOpen(false);
              }}
              data-testid="mobile-clear-history"
            >
              <Trash2 className="h-5 w-5 text-destructive" />
              <span>Clear All History</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-12"
              onClick={() => {
                onCloseTab?.();
                setMobileMenuOpen(false);
              }}
              data-testid="mobile-close-tab"
            >
              <X className="h-5 w-5 text-muted-foreground" />
              <span>Close Tab</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
