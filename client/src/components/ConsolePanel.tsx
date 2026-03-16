import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Terminal, ChevronRight, ChevronDown, Trash2, Square, Sparkles,
  Loader2, Clock, Eye, EyeOff
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCsrfToken } from "@/lib/queryClient";

interface LogEntry {
  id: number;
  text: string;
  type: "info" | "error" | "success";
}

interface ConsoleRunEntry {
  id: string;
  projectId: string;
  command: string;
  status: string;
  logs: LogEntry[];
  exitCode: number | null;
  startedAt: string;
  finishedAt: string | null;
}

interface ConsolePanelProps {
  projectId: string;
  isRunning: boolean;
  logs: LogEntry[];
  onStop: () => Promise<void> | void;
  onAskAI: (logContent: string) => void;
  activeFileName?: string;
  currentConsoleRunId?: string | null;
}

function parseAnsi(text: string): React.ReactNode {
  const parts: { text: string; color?: string }[] = [];
  const regex = /\x1b\[([\d;]+)m/g;
  let lastIndex = 0;
  let currentColor: string | undefined;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), color: currentColor });
    }
    const colorMap: Record<number, string | undefined> = {
      0: undefined, 31: "#EF4444", 32: "#22C55E", 33: "#EAB308", 34: "#3B82F6",
      35: "#A855F7", 36: "#06B6D4", 37: "#D1D5DB", 39: undefined,
      90: "#6B7280", 91: "#F87171", 92: "#4ADE80", 93: "#FACC15", 94: "#60A5FA",
      95: "#C084FC", 96: "#22D3EE", 97: "#F3F4F6",
    };
    const codes = match[1].split(";").map(Number);
    for (const code of codes) {
      if (code in colorMap) currentColor = colorMap[code];
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), color: currentColor });
  }
  if (parts.length === 0) return <span>{text}</span>;
  return <>{parts.map((p, i) => <span key={i} style={p.color ? { color: p.color } : undefined}>{p.text}</span>)}</>;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function RunEntry({
  run,
  isActive,
  isCollapsed,
  onToggle,
  onAskAI,
  onStop,
}: {
  run: ConsoleRunEntry;
  isActive: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
  onAskAI: (content: string) => void;
  onStop: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && !isCollapsed && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [run.logs.length, isActive, isCollapsed]);

  const statusIcon =
    run.status === "running" ? <Loader2 className="w-3 h-3 animate-spin text-[#0079F2]" /> :
    run.status === "completed" ? <span className="w-2 h-2 rounded-full bg-[#0CCE6B] inline-block" /> :
    <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />;

  const logText = run.logs.map(l => l.text).join("\n");

  return (
    <div className="border-b border-[var(--ide-border)]/50 last:border-b-0" data-testid={`console-run-${run.id}`}>
      <div
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-[var(--ide-surface)]/50 transition-colors select-none"
        onClick={onToggle}
        data-testid={`button-toggle-run-${run.id}`}
      >
        {isCollapsed ? (
          <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />
        ) : (
          <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />
        )}
        {statusIcon}
        <span className="text-[11px] font-mono text-[var(--ide-text-secondary)] truncate">{run.command}</span>
        <span className="text-[10px] text-[var(--ide-text-muted)] ml-auto shrink-0 flex items-center gap-1.5">
          <Clock className="w-2.5 h-2.5" />
          {formatTimestamp(run.startedAt)}
        </span>
        {run.exitCode !== null && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
            run.exitCode === 0 ? "bg-[#0CCE6B]/10 text-[#0CCE6B]" : "bg-red-500/10 text-red-400"
          }`}>
            exit {run.exitCode}
          </span>
        )}
        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          {isActive && run.status === "running" && (
            <Button
              variant="ghost"
              size="icon"
              className="w-5 h-5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
              onClick={onStop}
              title="Stop"
              data-testid={`button-stop-run-${run.id}`}
            >
              <Square className="w-2.5 h-2.5 fill-current" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="w-5 h-5 text-[#7C65CB] hover:text-[#9B8ADB] hover:bg-[#7C65CB]/10 rounded"
            onClick={() => onAskAI(logText)}
            title="Ask AI about this run"
            data-testid={`button-ask-ai-run-${run.id}`}
          >
            <Sparkles className="w-2.5 h-2.5" />
          </Button>
        </div>
      </div>
      {!isCollapsed && (
        <div
          ref={scrollRef}
          className="px-3 py-1 max-h-[300px] overflow-y-auto"
          style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: "12px", lineHeight: "1.6" }}
        >
          {run.logs.length === 0 && run.status === "running" && (
            <div className="flex items-center gap-2 py-1 text-[#0079F2]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[11px]">Running...</span>
            </div>
          )}
          {run.logs.map((log) => (
            <div key={log.id} className={`leading-relaxed ${log.type === "error" ? "text-red-400" : log.type === "success" ? "text-[#0CCE6B]" : "text-[#C5C8D4]"}`}>
              <span className="whitespace-pre-wrap break-all">{log.text.includes('\x1b[') ? parseAnsi(log.text) : log.text}</span>
            </div>
          ))}
          {isActive && run.status === "running" && run.logs.length > 0 && (
            <span className="inline-block w-[7px] h-[14px] bg-[#0079F2] animate-pulse ml-0.5" />
          )}
        </div>
      )}
    </div>
  );
}

export default function ConsolePanel({
  projectId,
  isRunning,
  logs,
  onStop,
  onAskAI,
  activeFileName,
  currentConsoleRunId,
}: ConsolePanelProps) {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showOnlyLatest, setShowOnlyLatest] = useState(false);
  const [collapsedRuns, setCollapsedRuns] = useState<Set<string>>(new Set());
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [localLogs, setLocalLogs] = useState<LogEntry[]>([]);
  const runStartTimeRef = useRef<string | null>(null);

  useEffect(() => {
    setLocalLogs(logs);
  }, [logs]);

  useEffect(() => {
    if (isRunning && currentConsoleRunId && !runStartTimeRef.current) {
      runStartTimeRef.current = new Date().toISOString();
    } else if (!isRunning) {
      runStartTimeRef.current = null;
    }
  }, [isRunning, currentConsoleRunId]);

  const { data: savedRuns = [], isLoading } = useQuery<ConsoleRunEntry[]>({
    queryKey: ["/api/projects", projectId, "console-runs"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/console-runs`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: isRunning ? 5000 : false,
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const excludeParam = currentConsoleRunId ? `?excludeRunId=${currentConsoleRunId}` : "";
      await fetch(`/api/projects/${projectId}/console-runs${excludeParam}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "console-runs"] });
      setClearConfirmOpen(false);
    },
  });

  const activeRun: ConsoleRunEntry | null = currentConsoleRunId && isRunning ? {
    id: currentConsoleRunId,
    projectId,
    command: `run ${activeFileName || "code"}`,
    status: "running",
    logs: localLogs,
    exitCode: null,
    startedAt: runStartTimeRef.current || new Date().toISOString(),
    finishedAt: null,
  } : null;

  const pastRuns = savedRuns.filter(r => !activeRun || r.id !== activeRun.id);
  const allRuns = activeRun ? [activeRun, ...pastRuns] : pastRuns;
  const displayRuns = showOnlyLatest && allRuns.length > 0 ? [allRuns[0]] : allRuns;

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedRuns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localLogs.length]);

  const hasRuns = allRuns.length > 0;

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-[var(--ide-panel)]" data-testid="console-panel">
      <div className="flex items-center justify-between px-2 h-8 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3 h-3 text-[#F5A623]" />
          <span className="text-[11px] text-[var(--ide-text-secondary)] font-medium">Console</span>
          {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse" />}
          {pastRuns.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--ide-surface)] text-[var(--ide-text-muted)]" data-testid="text-run-count">
              {allRuns.length} run{allRuns.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {hasRuns && (
            <Button
              variant="ghost"
              size="icon"
              className={`w-6 h-6 rounded transition-colors duration-150 ${
                showOnlyLatest
                  ? "text-[#0079F2] bg-[#0079F2]/10 hover:bg-[#0079F2]/20"
                  : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
              }`}
              onClick={() => setShowOnlyLatest(!showOnlyLatest)}
              title={showOnlyLatest ? "Show all runs" : "Show only latest"}
              data-testid="button-show-only-latest"
            >
              {showOnlyLatest ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </Button>
          )}
          {pastRuns.length > 0 && !clearConfirmOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-red-400 hover:bg-red-500/10 rounded transition-colors duration-150"
              onClick={() => setClearConfirmOpen(true)}
              title="Clear past runs"
              data-testid="button-clear-past-runs"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
          {clearConfirmOpen && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-red-400">Clear all?</span>
              <Button
                variant="ghost"
                size="icon"
                className="w-5 h-5 text-red-400 hover:bg-red-500/10 rounded text-[10px] font-medium"
                onClick={() => clearMutation.mutate()}
                data-testid="button-confirm-clear"
              >
                Yes
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-5 h-5 text-[var(--ide-text-muted)] hover:bg-[var(--ide-surface)] rounded text-[10px] font-medium"
                onClick={() => setClearConfirmOpen(false)}
                data-testid="button-cancel-clear"
              >
                No
              </Button>
            </div>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto" data-testid="console-runs-list">
        {!hasRuns && !isRunning && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-[var(--ide-text-muted)]" data-testid="text-console-empty">
            <Terminal className="w-6 h-6 mb-2 opacity-40" />
            <p className="text-xs">
              Press <kbd className="px-1.5 py-0.5 mx-1 rounded bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text-secondary)] text-[10px]">F5</kbd> or click <span className="text-[#0CCE6B] font-medium">Run</span> to execute your code
            </p>
          </div>
        )}

        {isLoading && !hasRuns && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" />
          </div>
        )}

        {displayRuns.map((run) => (
          <RunEntry
            key={run.id}
            run={run}
            isActive={activeRun?.id === run.id}
            isCollapsed={collapsedRuns.has(run.id)}
            onToggle={() => toggleCollapse(run.id)}
            onAskAI={onAskAI}
            onStop={onStop}
          />
        ))}
      </div>
    </div>
  );
}
