import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText, RefreshCw, Trash2, Search, ArrowDown, Filter,
  AlertTriangle, Info, Bug, ChevronDown,
} from "lucide-react";

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  source?: string;
}

const LEVEL_STYLES: Record<string, { color: string; icon: typeof Info; bg: string }> = {
  info: { color: "text-blue-400", icon: Info, bg: "bg-blue-500/10" },
  warn: { color: "text-yellow-400", icon: AlertTriangle, bg: "bg-yellow-500/10" },
  error: { color: "text-red-400", icon: Bug, bg: "bg-red-500/10" },
  debug: { color: "text-gray-400", icon: Bug, bg: "bg-gray-50 dark:bg-gray-8000/10" },
};

function parseLogLine(raw: string): LogEntry {
  const now = new Date().toISOString();
  const lower = raw.toLowerCase();

  let level: LogEntry["level"] = "info";
  if (lower.includes("[error]") || lower.includes("error:") || lower.startsWith("error")) level = "error";
  else if (lower.includes("[warn]") || lower.includes("warning:") || lower.startsWith("warn")) level = "warn";
  else if (lower.includes("[debug]") || lower.startsWith("debug")) level = "debug";

  // Try to extract timestamp from log line
  const tsMatch = raw.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*Z?)\s*/);
  const timestamp = tsMatch ? tsMatch[1] : now;
  const message = tsMatch ? raw.slice(tsMatch[0].length) : raw;

  return { timestamp, level, message };
}

export function LogsViewerPanel({ projectId }: { projectId: string }) {
  const [filter, setFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch deployment logs (real process output)
  const deployLogsQuery = useQuery<string[]>({
    queryKey: ["/api/projects", projectId, "deploy/logs"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/deploy/logs`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.logs || [];
    },
    refetchInterval: 3000,
  });

  // Fetch console run history
  const consoleRunsQuery = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "console-runs-logs"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/console-runs?limit=100`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 5000,
  });

  // Merge and parse all logs
  const allLogs: LogEntry[] = (() => {
    const entries: LogEntry[] = [];

    // Deployment logs
    const rawLogs = deployLogsQuery.data || [];
    for (const line of rawLogs) {
      if (line.trim()) entries.push(parseLogLine(line));
    }

    // Console runs (completed commands + their output)
    const runs = consoleRunsQuery.data || [];
    for (const run of runs) {
      entries.push({
        timestamp: run.createdAt || new Date().toISOString(),
        level: run.status === "failed" ? "error" : "info",
        message: `$ ${run.command}`,
        source: "console",
      });
      if (run.logs && Array.isArray(run.logs)) {
        for (const log of run.logs) {
          const parsed = parseLogLine(typeof log === "string" ? log : log.text || "");
          parsed.timestamp = run.createdAt || parsed.timestamp;
          parsed.source = "console";
          entries.push(parsed);
        }
      }
    }

    // Sort by timestamp
    entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return entries;
  })();

  // Apply filters
  const filteredLogs = allLogs.filter((log) => {
    if (levelFilter !== "all" && log.level !== levelFilter) return false;
    if (filter && !log.message.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs.length, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }, []);

  const handleClear = async () => {
    try {
      await fetch(`/api/projects/${projectId}/console-runs`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      consoleRunsQuery.refetch();
    } catch { /* ignore */ }
  };

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return "";
    }
  };

  const isLoading = deployLogsQuery.isLoading && consoleRunsQuery.isLoading;

  return (
    <div className="h-full flex flex-col bg-[var(--ide-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-[var(--ide-border)] shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
          <span className="text-[13px] font-medium text-[var(--ide-text)]">Logs</span>
          <span className="text-[11px] px-1.5 rounded bg-[var(--ide-surface)] text-[var(--ide-text-muted)] leading-5">
            {filteredLogs.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--ide-surface)] transition-colors"
            onClick={() => { deployLogsQuery.refetch(); consoleRunsQuery.refetch(); }}
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[var(--ide-text-muted)] ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--ide-surface)] transition-colors"
            onClick={handleClear}
            title="Clear console logs"
          >
            <Trash2 className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--ide-border)] shrink-0">
        <div className="flex-1 flex items-center gap-1.5 bg-[var(--ide-surface)] rounded px-2 py-1 border border-[var(--ide-border)]">
          <Search className="w-3 h-3 text-[var(--ide-text-muted)]" />
          <input
            type="text"
            className="flex-1 bg-transparent text-[12px] text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none"
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="relative">
          <button
            className="flex items-center gap-1 px-2 py-1 rounded text-[12px] text-[var(--ide-text-muted)] hover:bg-[var(--ide-surface)] border border-[var(--ide-border)] transition-colors"
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
          >
            <Filter className="w-3 h-3" />
            {levelFilter === "all" ? "All" : levelFilter}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showFilterDropdown && (
            <div className="absolute top-full right-0 mt-1 z-50 min-w-[100px] rounded border border-[var(--ide-border)] bg-[var(--ide-bg)] shadow-lg py-1">
              {["all", "info", "warn", "error", "debug"].map((lvl) => (
                <button
                  key={lvl}
                  className={`w-full px-3 py-1 text-[12px] text-left hover:bg-[var(--ide-surface)] transition-colors ${levelFilter === lvl ? "text-[var(--ide-accent)]" : "text-[var(--ide-text)]"}`}
                  onClick={() => { setLevelFilter(lvl); setShowFilterDropdown(false); }}
                >
                  {lvl === "all" ? "All levels" : lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Log content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto font-mono text-[12px] leading-[1.6]"
        onScroll={handleScroll}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-[var(--ide-text-muted)] text-[13px]">
            Loading logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <FileText className="w-8 h-8 text-[var(--ide-text-muted)] mb-2 opacity-40" />
            <p className="text-[13px] text-[var(--ide-text-muted)]">No logs yet</p>
            <p className="text-[12px] text-[var(--ide-text-muted)] opacity-60 mt-1">
              Run your project or execute commands to see logs here.
            </p>
          </div>
        ) : (
          <div className="px-1 py-1">
            {filteredLogs.map((log, i) => {
              const style = LEVEL_STYLES[log.level] || LEVEL_STYLES.info;
              const Icon = style.icon;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2 px-2 py-0.5 hover:bg-[var(--ide-surface)]/50 rounded ${log.level === "error" ? "bg-red-500/5" : ""}`}
                >
                  <span className="text-[11px] text-[var(--ide-text-muted)] shrink-0 w-[60px] tabular-nums">
                    {formatTime(log.timestamp)}
                  </span>
                  <Icon className={`w-3 h-3 shrink-0 mt-0.5 ${style.color}`} />
                  <span className={`flex-1 break-all ${log.level === "error" ? "text-red-400" : log.level === "warn" ? "text-yellow-400" : "text-[var(--ide-text)]"}`}>
                    {log.message}
                  </span>
                  {log.source && (
                    <span className="text-[10px] text-[var(--ide-text-muted)] opacity-50 shrink-0">{log.source}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && filteredLogs.length > 0 && (
        <button
          className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded bg-[var(--ide-accent)] text-white text-[11px] shadow-lg"
          onClick={() => {
            setAutoScroll(true);
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }}
        >
          <ArrowDown className="w-3 h-3" /> Latest
        </button>
      )}
    </div>
  );
}
