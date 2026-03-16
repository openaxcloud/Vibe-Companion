import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Activity, Loader2, Plus, Trash2, X, Bell, Cpu, HardDrive, Clock, Zap,
  ChevronDown, ChevronRight, RefreshCw, BarChart3,
} from "lucide-react";

interface MonitoringMetric {
  id: string;
  projectId: string;
  metricType: string;
  value: number;
  metadata: Record<string, any> | null;
  recordedAt: string;
}

interface MonitoringAlert {
  id: string;
  projectId: string;
  name: string;
  metricType: string;
  condition: string;
  threshold: number;
  enabled: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}

interface MetricsSummary {
  requests: number;
  errors: number;
  avgResponseMs: number;
  uptime: number;
  cpuPercent: number;
  memoryMb: number;
}

const METRIC_ICONS: Record<string, any> = {
  request_count: Zap,
  error_count: Bell,
  response_time: Clock,
  cpu_usage: Cpu,
  memory_usage: HardDrive,
};

export default function MonitoringPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [addAlertMode, setAddAlertMode] = useState(false);
  const [alertName, setAlertName] = useState("");
  const [alertMetric, setAlertMetric] = useState("error_count");
  const [alertThreshold, setAlertThreshold] = useState("5");

  const metricsQuery = useQuery<MonitoringMetric[]>({
    queryKey: ["/api/projects", projectId, "monitoring", "metrics"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/monitoring/metrics`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load metrics");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const summaryQuery = useQuery<MetricsSummary>({
    queryKey: ["/api/projects", projectId, "monitoring", "summary"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/monitoring/summary`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const alertsQuery = useQuery<MonitoringAlert[]>({
    queryKey: ["/api/projects", projectId, "monitoring", "alerts"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/monitoring/alerts`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load alerts");
      return res.json();
    },
  });

  const recordMetricMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/projects/${projectId}/monitoring/record`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "monitoring"] });
    },
  });

  const autoRecordRef = useRef(false);
  useEffect(() => {
    if (!autoRecordRef.current) {
      autoRecordRef.current = true;
      recordMetricMutation.mutate();
    }
    const interval = setInterval(() => {
      recordMetricMutation.mutate();
    }, 30000);
    return () => clearInterval(interval);
  }, [projectId]);

  const createAlertMutation = useMutation({
    mutationFn: async (data: { name: string; metricType: string; threshold: number }) => {
      await apiRequest("POST", `/api/projects/${projectId}/monitoring/alerts`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "monitoring", "alerts"] });
      setAddAlertMode(false);
      setAlertName("");
      setAlertThreshold("5");
      toast({ title: "Alert created" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create alert", description: err.message, variant: "destructive" });
    },
  });

  const toggleAlertMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await apiRequest("PATCH", `/api/projects/${projectId}/monitoring/alerts/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "monitoring", "alerts"] });
    },
  });

  const deleteAlertMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/monitoring/alerts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "monitoring", "alerts"] });
      toast({ title: "Alert deleted" });
    },
  });

  const summary = summaryQuery.data;
  const metrics = metricsQuery.data || [];
  const alerts = alertsQuery.data || [];

  return (
    <div className="flex flex-col h-full" data-testid="monitoring-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Monitoring</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => { recordMetricMutation.mutate(); queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "monitoring"] }); }} disabled={recordMetricMutation.isPending} title="Refresh metrics" data-testid="button-refresh-metrics">
            <RefreshCw className={`w-3.5 h-3.5 ${recordMetricMutation.isPending ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-monitoring">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {summaryQuery.isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--ide-text-muted)]" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 p-3">
              <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]" data-testid="metric-card-requests">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="w-3 h-3 text-blue-400" />
                  <span className="text-[9px] text-[var(--ide-text-muted)] uppercase">Requests</span>
                </div>
                <span className="text-lg font-bold text-[var(--ide-text)]">{summary?.requests ?? 0}</span>
              </div>
              <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]" data-testid="metric-card-errors">
                <div className="flex items-center gap-1.5 mb-1">
                  <Bell className="w-3 h-3 text-red-400" />
                  <span className="text-[9px] text-[var(--ide-text-muted)] uppercase">Errors</span>
                </div>
                <span className="text-lg font-bold text-[var(--ide-text)]">{summary?.errors ?? 0}</span>
              </div>
              <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]" data-testid="metric-card-response">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3 h-3 text-yellow-400" />
                  <span className="text-[9px] text-[var(--ide-text-muted)] uppercase">Avg Response</span>
                </div>
                <span className="text-lg font-bold text-[var(--ide-text)]">{summary?.avgResponseMs ?? 0}<span className="text-xs text-[var(--ide-text-muted)]">ms</span></span>
              </div>
              <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]" data-testid="metric-card-uptime">
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="w-3 h-3 text-green-400" />
                  <span className="text-[9px] text-[var(--ide-text-muted)] uppercase">Uptime</span>
                </div>
                <span className="text-lg font-bold text-[var(--ide-text)]">{summary?.uptime ?? 100}<span className="text-xs text-[var(--ide-text-muted)]">%</span></span>
              </div>
            </div>

            <div className="px-3 pb-2">
              <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase">Resources</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU</span>
                      <span className="text-[10px] font-medium text-[var(--ide-text)]">{summary?.cpuPercent ?? 0}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--ide-border)] rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(summary?.cpuPercent ?? 0, 100)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1"><HardDrive className="w-3 h-3" /> Memory</span>
                      <span className="text-[10px] font-medium text-[var(--ide-text)]">{summary?.memoryMb ?? 0} MB</span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--ide-border)] rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${Math.min((summary?.memoryMb ?? 0) / 5.12, 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {metrics.length > 0 && (
              <div className="px-3 pb-2">
                <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase mb-1.5 block">Recent Events</span>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {metrics.slice(0, 20).map((m) => {
                    const Icon = METRIC_ICONS[m.metricType] || BarChart3;
                    return (
                      <div key={m.id} className="flex items-center gap-2 py-1 px-2 rounded bg-[var(--ide-surface)] text-[11px]" data-testid={`metric-event-${m.id}`}>
                        <Icon className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />
                        <span className="text-[var(--ide-text)] truncate flex-1">{m.metricType.replace(/_/g, " ")}</span>
                        <span className="text-[var(--ide-text-muted)] font-mono">{m.value}</span>
                        <span className="text-[9px] text-[var(--ide-text-muted)]">{new Date(m.recordedAt).toLocaleTimeString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="px-3 pb-3">
              <button className="flex items-center gap-1.5 w-full text-left py-1.5" onClick={() => setAlertsOpen(!alertsOpen)} data-testid="toggle-alerts">
                {alertsOpen ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" />}
                <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase">Alerts ({alerts.length})</span>
                <Button variant="ghost" size="icon" className="w-5 h-5 ml-auto text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={(e) => { e.stopPropagation(); setAddAlertMode(true); setAlertsOpen(true); }} data-testid="button-add-alert">
                  <Plus className="w-3 h-3" />
                </Button>
              </button>

              {alertsOpen && (
                <div className="space-y-1.5 mt-1">
                  {addAlertMode && (
                    <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)] space-y-2">
                      <Input placeholder="Alert name" value={alertName} onChange={(e) => setAlertName(e.target.value)} className="h-7 text-xs bg-[var(--ide-bg)]" data-testid="input-alert-name" />
                      <select value={alertMetric} onChange={(e) => setAlertMetric(e.target.value)} className="w-full h-7 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 text-[var(--ide-text)]" data-testid="select-alert-metric">
                        <option value="error_count">Error Count</option>
                        <option value="response_time">Response Time (ms)</option>
                        <option value="cpu_usage">CPU Usage (%)</option>
                        <option value="memory_usage">Memory Usage (MB)</option>
                        <option value="request_count">Request Count</option>
                      </select>
                      <Input type="number" placeholder="Threshold" value={alertThreshold} onChange={(e) => setAlertThreshold(e.target.value)} className="h-7 text-xs bg-[var(--ide-bg)]" data-testid="input-alert-threshold" />
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-6 text-[10px] flex-1" onClick={() => createAlertMutation.mutate({ name: alertName, metricType: alertMetric, threshold: parseInt(alertThreshold) || 0 })} disabled={!alertName.trim() || createAlertMutation.isPending} data-testid="button-save-alert">
                          {createAlertMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setAddAlertMode(false)} data-testid="button-cancel-alert">Cancel</Button>
                      </div>
                    </div>
                  )}

                  {alerts.map((alert) => (
                    <div key={alert.id} className="flex items-center gap-2 py-1.5 px-2 rounded bg-[var(--ide-surface)] border border-[var(--ide-border)]" data-testid={`alert-${alert.id}`}>
                      <Bell className={`w-3 h-3 shrink-0 ${alert.enabled ? "text-yellow-400" : "text-[var(--ide-text-muted)]"}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] text-[var(--ide-text)] block truncate">{alert.name}</span>
                        <span className="text-[9px] text-[var(--ide-text-muted)]">{alert.metricType.replace(/_/g, " ")} &gt; {alert.threshold}</span>
                      </div>
                      <Switch checked={alert.enabled} onCheckedChange={(checked) => toggleAlertMutation.mutate({ id: alert.id, enabled: checked })} className="scale-75" data-testid={`toggle-alert-${alert.id}`} />
                      <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-red-400" onClick={() => deleteAlertMutation.mutate(alert.id)} data-testid={`delete-alert-${alert.id}`}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}

                  {alerts.length === 0 && !addAlertMode && (
                    <p className="text-[11px] text-[var(--ide-text-muted)] text-center py-2">No alerts configured</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
