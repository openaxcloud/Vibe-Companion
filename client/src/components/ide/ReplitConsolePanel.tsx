import { useState, useRef, useEffect, useCallback } from 'react';

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
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

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
  onAskAgent?: (context?: string) => void;
  onManageWorkflows?: () => void;
  onCloseTab?: () => void;
}

// No DEFAULT_WORKFLOWS hardcoded on the client — workflows are loaded exclusively from
// GET /api/workflows?projectId=... so they reflect the project's actual .replit / backend config.

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
  
  // xterm.js terminal renderer
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  // SIGINT→SIGKILL grace-period timer
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Total log count — drives empty-state display
  const [logCount, setLogCount] = useState(0);
  // Stable ref so re-render effects can read the latest logs without adding them to deps
  const logsRef = useRef<ConsoleLog[]>([]);

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

  const allWorkflows = customWorkflows || [];

  const runWorkflowMutation = useMutation({
    mutationFn: async (workflow: Workflow) => {
      return apiRequest('POST', `/api/preview/projects/${projectId}/preview/start`, {
        workflowId: workflow.id,
      });
    },
    onMutate: (workflow) => {
      setRunningWorkflowIds(prev => new Set(prev).add(workflow.id));
      setLatestRunStartIndex(logs.length);
    },
    onSuccess: (_, workflow) => {
      // Spawn a server-side PTY session so the console receives raw terminal
      // bytes for this execution.  Only the workflowId is sent — the server
      // resolves the command from the project's workflow steps in the database.
      const ws = previewWsRef.current;
      const term = xtermRef.current;
      if (ws?.readyState === WebSocket.OPEN && workflow.id) {
        ws.send(JSON.stringify({
          type: 'pty:start',
          workflowId: workflow.id,
          cols: term?.cols ?? 80,
          rows: term?.rows ?? 24,
        }));
      }
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

  // Stop the active project execution — the server kills the PTY session and the preview
  // service process.  No workflow ID is needed here because PTY sessions are per-project.
  const stopWorkflowMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/preview/projects/${projectId}/preview/stop`, {});
    },
    onMutate: () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    },
    onSuccess: () => {
      if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
      setRunningWorkflowIds(new Set());
      toast({ title: 'Stopped' });
      onStopWorkflow?.('');
    },
    onError: (error: Error) => {
      if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
      toast({ title: 'Failed to stop', description: error.message, variant: 'destructive' });
    }
  });

  // Write a formatted log line to the xterm.js terminal with ANSI colours.
  // This is the sole visual renderer — React state (logs[]) is kept only for
  // copy / download / agent-context purposes.
  const writeToTerminal = useCallback((type: ConsoleLog['type'], message: string, timestamp: Date) => {
    const term = xtermRef.current;
    if (!term) return;
    const RESET = '\x1b[0m';
    const DIM   = '\x1b[2m';
    const colorMap: Record<string, string> = {
      error:  '\x1b[31m',
      stderr: '\x1b[31m',
      warn:   '\x1b[33m',
      info:   '\x1b[36m',
      system: '\x1b[35m',
      debug:  DIM,
      http:   '\x1b[34m',
      exit:   '\x1b[32m',
      stdout: RESET,
      log:    RESET,
    };
    const color = colorMap[type] ?? RESET;
    const timeStr = timestamp.toLocaleTimeString();
    // xterm needs \r\n; convertEol handles bare \n automatically but explicit is safer
    const text = message.replace(/\r?\n/g, '\r\n');
    term.writeln(`${DIM}[${timeStr}]${RESET} ${color}${text}${RESET}`);
  }, []);

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
    setLogCount(prev => prev + 1);
    writeToTerminal(consoleLog.type, consoleLog.message, consoleLog.timestamp);
  }, [writeToTerminal]);

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
    setLogCount(prev => prev + 1);
    writeToTerminal(consoleLog.type, consoleLog.message, consoleLog.timestamp);
  }, [writeToTerminal]);

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
          if (data.type === 'pty:data') {
            // Raw PTY bytes — write directly to xterm without any prefix to
            // preserve cursor sequences, colours, and ANSI control codes exactly
            // as the process emitted them. This is the canonical terminal stream.
            xtermRef.current?.write(data.data);
          } else if (data.type === 'pty:exit') {
            addPreviewLog({ type: 'system', content: `Process exited with code ${data.exitCode ?? 0}`, timestamp: Date.now() });
          } else if (data.type === 'preview:log' && data.log) {
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

  // ── xterm.js initialisation ────────────────────────────────────────────────
  // Mount once; the terminal div is always present in the DOM so FitAddon can
  // measure it immediately when logs start arriving.
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;
    const term = new XTerm({
      convertEol: true,     // auto-convert \n → \r\n
      cursorBlink: true,
      disableStdin: false,  // Accept input and forward to running process via /ws/preview
      scrollback: 5000,
      fontSize: 11,
      fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Consolas, monospace',
      allowTransparency: true,
      theme: {
        background: '#00000000',   // transparent — parent bg shows through
        foreground: '#e2e8f0',
        black:   '#1e1e2e',
        red:     '#ef4444',
        green:   '#22c55e',
        yellow:  '#eab308',
        blue:    '#3b82f6',
        magenta: '#a855f7',
        cyan:    '#06b6d4',
        white:   '#e2e8f0',
        brightBlack:   '#64748b',
        brightRed:     '#f87171',
        brightGreen:   '#4ade80',
        brightYellow:  '#facc15',
        brightBlue:    '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan:    '#22d3ee',
        brightWhite:   '#f1f5f9',
      },
    });
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);
    try { fitAddon.fit(); } catch {}
    searchAddonRef.current = searchAddon;
    // Forward user keystrokes to the running process via the /ws/preview channel.
    // This enables interactive stdin (e.g. answering prompts, Ctrl+C, Ctrl+D).
    const stdinDisposable = term.onData((data) => {
      const ws = previewWsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stdin', data, projectId: String(projectId) }));
      }
    });
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    return () => {
      stdinDisposable.dispose();
      if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
    };
  }, [projectId]);

  // ── FitAddon resize — also forwards new dimensions to the server PTY ─────
  useEffect(() => {
    const el = terminalRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      try {
        fitAddonRef.current?.fit();
        const term = xtermRef.current;
        const ws = previewWsRef.current;
        if (term && ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      } catch (_) {}
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Keep logsRef in sync so the effects below can read current logs without
  // including the array in deps (which would cause O(n²) terminal rewrites).
  useEffect(() => { logsRef.current = logs; }, [logs]);

  // ── Re-render terminal when showOnlyLatest filter toggles ─────────────────
  // Also fires when latestRunStartIndex changes so that if the filter is
  // already ON and a new run starts, the terminal resets to show only the new run.
  // `logs` is read via logsRef to avoid adding it as a dep.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;
    term.reset();
    const all = logsRef.current;
    const logsToShow = showOnlyLatest ? all.slice(latestRunStartIndex) : all;
    logsToShow.forEach(log => writeToTerminal(log.type, log.message, log.timestamp));
  }, [showOnlyLatest, latestRunStartIndex]);

  const displayedLogs = showOnlyLatest 
    ? logs.slice(latestRunStartIndex) 
    : logs;

  const errorCount = displayedLogs.filter(log => log.type === 'error' || log.type === 'stderr').length;

  const clearLogs = async () => {
    setLogs([]);
    setLogCount(0);
    setLatestRunStartIndex(0);
    xtermRef.current?.reset();
    clearWsLogs();
    clearServerLogs();
    // Also clear server-side stored console runs so they don't reappear on reconnect.
    // Use apiRequest so the DELETE carries the X-CSRF-Token header required by csrfProtection.
    try {
      await apiRequest('DELETE', `/api/projects/${projectId}/console-runs`);
    } catch {
      // best-effort: client buffer and terminal are already cleared
    }
  };

  const clearPastRuns = () => {
    const remaining = logs.slice(latestRunStartIndex);
    setLogs(remaining);
    setLogCount(remaining.length);
    setLatestRunStartIndex(0);
    // Rewrite terminal with only the remaining (current-run) logs
    xtermRef.current?.reset();
    remaining.forEach(log => writeToTerminal(log.type, log.message, log.timestamp));
    clearWsLogs();
    // Delete server-side past console runs so they don't reappear on reconnect.
    apiRequest('DELETE', `/api/projects/${projectId}/console-runs`).catch(() => {});
    toast({ title: 'Past runs cleared' });
  };

  // Read exact visible output from the xterm buffer and strip ANSI escape sequences.
  // This is the canonical source for copy/download — it matches what the user sees,
  // including PTY-rendered output, cursor movements, and colour sequences.
  const getTerminalText = (): string => {
    const term = xtermRef.current;
    if (!term) return '';
    const buf = term.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < buf.length; i++) {
      const line = buf.getLine(i);
      if (line) lines.push(line.translateToString(true));
    }
    // Strip ANSI colour/cursor escape sequences for plain-text export.
    return lines.join('\n').replace(/\x1b\[[0-9;]*[mGKHFJABCDsuhl]/g, '').trimEnd();
  };

  const copyLogs = () => {
    const text = getTerminalText();
    navigator.clipboard.writeText(text || displayedLogs.map(l => `[${l.timestamp.toLocaleTimeString()}] ${l.type.toUpperCase()}: ${l.message}`).join('\n'));
    toast({ title: 'Copied to clipboard' });
  };

  const downloadLogs = () => {
    const text = getTerminalText() || displayedLogs.map(l => `[${l.timestamp.toISOString()}] ${l.type.toUpperCase()}: ${l.message}${l.stack ? '\n' + l.stack : ''}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-logs-${projectId}-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
                        stopWorkflowMutation.mutate();
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
          onClick={() => {
            // Attach last ~20 log lines (prioritise errors) as context for the agent
            const recentLogs = displayedLogs.slice(-20);
            const context = recentLogs
              .map(l => `[${l.timestamp.toLocaleTimeString()}] ${l.type.toUpperCase()}: ${l.message}`)
              .join('\n');
            onAskAgent?.(context || undefined);
          }}
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
            onClick={() => { stopWorkflowMutation.mutate(); }}
            disabled={stopWorkflowMutation.isPending}
            data-testid="stop-all-button"
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>
        )}
      </div>

      {/* ── Terminal output area ─────────────────────────────────────── */}
      {/* The xterm.js div is always mounted so FitAddon can measure it.      */}
      {/* The empty-state overlay sits on top when no logs have arrived yet.  */}
      <div className="flex-1 relative overflow-hidden" data-testid="console-output">
        {logCount === 0 && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center py-12 px-4 bg-[var(--ecode-surface)]"
            data-testid="console-empty"
          >
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
                {allWorkflows.length > 0 ? (
                  <div className="w-full max-w-sm space-y-4">
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
                ) : (
                  <p className="text-muted-foreground text-[12px] text-center">
                    No workflows configured. Use the Workflows panel to add one.
                  </p>
                )}
              </>
            )}
          </div>
        )}
        {/* xterm.js terminal — ANSI colours, scrollback 5000 lines, read-only */}
        <div
          ref={terminalRef}
          className="h-full w-full"
          style={{ padding: '4px' }}
          data-testid="console-terminal"
        />
      </div>

      {logCount > 0 && (
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
                const recentLogs = displayedLogs.slice(-20);
                const context = recentLogs
                  .map(l => `[${l.timestamp.toLocaleTimeString()}] ${l.type.toUpperCase()}: ${l.message}`)
                  .join('\n');
                onAskAgent?.(context || undefined);
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
