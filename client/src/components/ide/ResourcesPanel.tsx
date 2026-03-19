import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, Cpu, HardDrive, Activity, RefreshCw, Gauge,
} from "lucide-react";

interface MonitoringSummary {
  requests: number;
  errors: number;
  avgResponseMs: number;
  uptime: number;
  cpuPercent: number;
  memoryMb: number;
  systemMemory?: {
    totalMb: number;
    usedMb: number;
    freeMb: number;
    usedPercent: number;
  };
  loadAverage?: {
    load1: number;
    load5: number;
    load15: number;
  };
}

interface DeployProcess {
  process: {
    port: number;
    status: string;
    startedAt: string;
    restartCount: number;
    resourceLimits: { maxMemoryMB: number; maxCpuPercent: number };
    resourceUsage: { cpuPercent?: number; memoryMb?: number } | null;
    healthStatus: string;
    pid: number;
    uptime: number;
  } | null;
  liveUrl: string | null;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  percent,
  color,
}: {
  icon: typeof Cpu;
  label: string;
  value: string | number;
  unit?: string;
  percent?: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-6 h-6 rounded flex items-center justify-center ${color}`}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-[12px] text-[var(--ide-text-muted)]">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[20px] font-semibold text-[var(--ide-text)] tabular-nums">{value}</span>
        {unit && <span className="text-[12px] text-[var(--ide-text-muted)]">{unit}</span>}
      </div>
      {percent !== undefined && (
        <div className="mt-2">
          <div className="h-1.5 bg-[var(--ide-border)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percent > 80 ? "bg-red-500" : percent > 60 ? "bg-yellow-500" : "bg-green-500"
              }`}
              style={{ width: `${Math.min(100, percent)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

export function ResourcesPanel({ projectId }: { projectId: string }) {
  const [recordingMetrics, setRecordingMetrics] = useState(false);

  // Fetch monitoring summary (real server metrics)
  const summaryQuery = useQuery<MonitoringSummary>({
    queryKey: ["/api/projects", projectId, "monitoring/summary"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/monitoring/summary`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load metrics");
      return res.json();
    },
    refetchInterval: 10000,
  });

  // Fetch deploy process info
  const processQuery = useQuery<DeployProcess>({
    queryKey: ["/api/projects", projectId, "deploy/process"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/deploy/process`, { credentials: "include" });
      if (!res.ok) return { process: null, liveUrl: null };
      return res.json();
    },
    refetchInterval: 10000,
  });

  // Auto-record metrics periodically
  useEffect(() => {
    const record = async () => {
      if (recordingMetrics) return;
      setRecordingMetrics(true);
      try {
        await fetch(`/api/projects/${projectId}/monitoring/record`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
      } catch { /* silent */ }
      setRecordingMetrics(false);
    };

    record();
    const interval = setInterval(record, 30000);
    return () => clearInterval(interval);
  }, [projectId]);

  const summary = summaryQuery.data;
  const proc = processQuery.data?.process;
  const isLoading = summaryQuery.isLoading;

  const cpuPercent = proc?.resourceUsage?.cpuPercent ?? summary?.cpuPercent ?? 0;
  const memoryMb = proc?.resourceUsage?.memoryMb ?? summary?.memoryMb ?? 0;
  const maxMemoryMb = proc?.resourceLimits?.maxMemoryMB ?? summary?.systemMemory?.totalMb ?? 512;
  const memoryPercent = maxMemoryMb > 0 ? (memoryMb / maxMemoryMb) * 100 : 0;

  return (
    <div className="h-full flex flex-col bg-[var(--ide-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-[var(--ide-border)] shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
          <span className="text-[13px] font-medium text-[var(--ide-text)]">Resources</span>
        </div>
        <button
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--ide-surface)] transition-colors"
          onClick={() => { summaryQuery.refetch(); processQuery.refetch(); }}
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[var(--ide-text-muted)] ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-[var(--ide-text-muted)] text-[13px]">
            Loading metrics...
          </div>
        ) : (
          <>
            {/* Process status */}
            {proc && (
              <div className="rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-medium text-[var(--ide-text)]">Process</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded ${
                    proc.status === "running" ? "bg-green-500/10 text-green-400" :
                    proc.status === "stopped" ? "bg-gray-500/10 text-gray-400" :
                    "bg-yellow-500/10 text-yellow-400"
                  }`}>
                    {proc.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <span className="text-[var(--ide-text-muted)]">PID</span>
                    <div className="text-[var(--ide-text)] tabular-nums">{proc.pid || "—"}</div>
                  </div>
                  <div>
                    <span className="text-[var(--ide-text-muted)]">Port</span>
                    <div className="text-[var(--ide-text)] tabular-nums">{proc.port || "—"}</div>
                  </div>
                  <div>
                    <span className="text-[var(--ide-text-muted)]">Uptime</span>
                    <div className="text-[var(--ide-text)] tabular-nums">{proc.uptime ? formatUptime(proc.uptime) : "—"}</div>
                  </div>
                  <div>
                    <span className="text-[var(--ide-text-muted)]">Restarts</span>
                    <div className="text-[var(--ide-text)] tabular-nums">{proc.restartCount}</div>
                  </div>
                  <div>
                    <span className="text-[var(--ide-text-muted)]">Health</span>
                    <div className={`tabular-nums ${proc.healthStatus === "healthy" ? "text-green-400" : proc.healthStatus === "unhealthy" ? "text-red-400" : "text-[var(--ide-text-muted)]"}`}>
                      {proc.healthStatus || "unknown"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Resource metrics */}
            <div className="grid grid-cols-2 gap-2">
              <MetricCard
                icon={Cpu}
                label="CPU"
                value={cpuPercent.toFixed(1)}
                unit="%"
                percent={cpuPercent}
                color="bg-blue-500"
              />
              <MetricCard
                icon={HardDrive}
                label="Memory"
                value={memoryMb.toFixed(0)}
                unit={`/ ${maxMemoryMb} MB`}
                percent={memoryPercent}
                color="bg-purple-500"
              />
            </div>

            {/* System memory breakdown */}
            {summary?.systemMemory && (
              <div className="rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <HardDrive className="w-3 h-3 text-[var(--ide-text-muted)]" />
                  <span className="text-[12px] font-medium text-[var(--ide-text)]">System Memory</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--ide-text-muted)]">Used</span>
                    <span className="text-[var(--ide-text)] tabular-nums">{summary.systemMemory.usedMb.toFixed(0)} MB</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--ide-text-muted)]">Free</span>
                    <span className="text-[var(--ide-text)] tabular-nums">{summary.systemMemory.freeMb.toFixed(0)} MB</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--ide-text-muted)]">Total</span>
                    <span className="text-[var(--ide-text)] tabular-nums">{summary.systemMemory.totalMb.toFixed(0)} MB</span>
                  </div>
                  <div className="h-1.5 bg-[var(--ide-border)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        summary.systemMemory.usedPercent > 85 ? "bg-red-500" :
                        summary.systemMemory.usedPercent > 70 ? "bg-yellow-500" : "bg-green-500"
                      }`}
                      style={{ width: `${summary.systemMemory.usedPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Load average */}
            {summary?.loadAverage && (
              <div className="rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-3 h-3 text-[var(--ide-text-muted)]" />
                  <span className="text-[12px] font-medium text-[var(--ide-text)]">Load Average</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "1 min", value: summary.loadAverage.load1 },
                    { label: "5 min", value: summary.loadAverage.load5 },
                    { label: "15 min", value: summary.loadAverage.load15 },
                  ].map((la) => (
                    <div key={la.label} className="text-center">
                      <div className="text-[16px] font-semibold text-[var(--ide-text)] tabular-nums">
                        {la.value.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-[var(--ide-text-muted)]">{la.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Request stats */}
            {summary && (
              <div className="rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge className="w-3 h-3 text-[var(--ide-text-muted)]" />
                  <span className="text-[12px] font-medium text-[var(--ide-text)]">Performance</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[11px] text-[var(--ide-text-muted)]">Requests</div>
                    <div className="text-[14px] font-medium text-[var(--ide-text)] tabular-nums">{summary.requests}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[var(--ide-text-muted)]">Errors</div>
                    <div className={`text-[14px] font-medium tabular-nums ${summary.errors > 0 ? "text-red-400" : "text-[var(--ide-text)]"}`}>
                      {summary.errors}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[var(--ide-text-muted)]">Avg Response</div>
                    <div className="text-[14px] font-medium text-[var(--ide-text)] tabular-nums">{summary.avgResponseMs.toFixed(0)} ms</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[var(--ide-text-muted)]">Uptime</div>
                    <div className={`text-[14px] font-medium tabular-nums ${summary.uptime >= 99 ? "text-green-400" : summary.uptime >= 95 ? "text-yellow-400" : "text-red-400"}`}>
                      {summary.uptime.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* No process running */}
            {!proc && !isLoading && (
              <div className="text-center py-4">
                <p className="text-[12px] text-[var(--ide-text-muted)]">
                  No active process. Deploy your project to see resource usage.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
