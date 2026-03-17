import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Activity, Loader2, X, Globe, Rocket, Copy, Check, ExternalLink,
  RefreshCw, BarChart3, Search, Clock, Cpu, HardDrive, FileText, Eye,
  Smartphone, Monitor, MapPin, ArrowUpRight, AlertCircle, QrCode,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { QRCodeSVG as RealQRCode } from "qrcode.react";

type TabId = "overview" | "logs" | "resources" | "analytics";

interface OverviewData {
  isPublished: boolean;
  slug: string;
  url: string;
  deploymentType: string;
  status: string;
  version: number;
  createdAt: string | null;
  healthStatus: string;
  processStatus: string | null;
}

interface DeploymentLog {
  id: string;
  projectId: string;
  deploymentId: string | null;
  level: string;
  message: string;
  source: string;
  createdAt: string;
}

interface ResourceData {
  snapshots: { id: string; cpuPercent: number; memoryMb: number; heapMb: number | null; recordedAt: string }[];
  current: { cpuPercent: number; memoryMb: number; heapMb: number; uptimeSeconds: number; systemMemory: { totalMb: number; freeMb: number; usedMb: number; usedPercent: number }; loadAverage: { load1: number; load5: number; load15: number } };
}

interface AnalyticsData {
  pageViews: number;
  uniqueVisitors: number;
  topUrls: { url: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  statusDistribution: { status: number; count: number }[];
  durationHistogram: { bucket: string; count: number }[];
  topBrowsers: { browser: string; count: number }[];
  topDevices: { device: string; count: number }[];
  topCountries: { country: string; count: number }[];
  trafficByDay: { date: string; views: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  live: "#10B981",
  building: "#F59E0B",
  failed: "#EF4444",
  stopped: "#6B7280",
  none: "#6B7280",
};

const CHART_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

function QRCodeDisplay({ url }: { url: string }) {
  return <RealQRCode value={url} size={120} level="M" bgColor="#ffffff" fgColor="#000000" />;
}

function OverviewTab({ projectId }: { projectId: string }) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const queryClient = useQueryClient();

  const overviewQuery = useQuery<OverviewData>({
    queryKey: ["/api/projects", projectId, "publishing", "overview"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/publishing/overview`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load overview");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const republishMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/projects/${projectId}/deploy`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "publishing"] });
    },
  });

  const overview = overviewQuery.data;

  if (overviewQuery.isLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--ide-text-muted)]" /></div>;

  const fullUrl = overview?.url ? (overview.url.startsWith("http") ? overview.url : `${window.location.origin}${overview.url}`) : "";

  return (
    <div className="p-3 space-y-3">
      <div className="bg-[var(--ide-surface)] rounded-lg p-3 border border-[var(--ide-border)]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[overview?.status || "none"] }} />
          <span className="text-sm font-semibold text-[var(--ide-text)]" data-testid="text-deployment-status">
            {overview?.status === "live" ? "Published" : overview?.status === "building" ? "Building..." : overview?.status === "failed" ? "Failed" : "Not Published"}
          </span>
          {overview?.deploymentType && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 uppercase font-semibold" data-testid="text-deployment-type">
              {overview.deploymentType}
            </span>
          )}
          {overview?.version ? (
            <span className="text-[10px] text-[var(--ide-text-muted)]" data-testid="text-deployment-version">v{overview.version}</span>
          ) : null}
        </div>

        {overview?.isPublished && fullUrl && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
              <span className="text-[11px] text-[var(--ide-accent)] truncate flex-1" data-testid="text-deployment-url">{fullUrl}</span>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 text-[var(--ide-text-muted)]"
                onClick={() => { navigator.clipboard.writeText(fullUrl); setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000); }}
                data-testid="button-copy-url"
              >
                {copiedUrl ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              </Button>
              <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" data-testid="link-open-deployment">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {overview.healthStatus && (
              <div className="flex items-center gap-2 text-[10px]">
                <Activity className="w-3 h-3" />
                <span className="text-[var(--ide-text-muted)]">Health:</span>
                <span className={overview.healthStatus === "healthy" ? "text-green-400" : overview.healthStatus === "unhealthy" ? "text-red-400" : "text-yellow-400"} data-testid="text-health-status">
                  {overview.healthStatus}
                </span>
              </div>
            )}

            {overview.createdAt && (
              <div className="flex items-center gap-2 text-[10px] text-[var(--ide-text-muted)]">
                <Clock className="w-3 h-3" />
                <span>Last deployed: {new Date(overview.createdAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {overview?.isPublished && fullUrl && (
        <div className="bg-[var(--ide-surface)] rounded-lg p-3 border border-[var(--ide-border)] flex flex-col items-center">
          <span className="text-[10px] text-[var(--ide-text-muted)] uppercase mb-2 font-semibold">QR Code for Mobile Access</span>
          <div className="bg-white p-2 rounded" data-testid="qr-code-container">
            <QRCodeDisplay url={fullUrl} />
          </div>
          <span className="text-[9px] text-[var(--ide-text-muted)] mt-1">Scan to open on mobile</span>
        </div>
      )}

      <Button
        className="w-full h-8 text-xs"
        onClick={() => republishMutation.mutate()}
        disabled={republishMutation.isPending}
        data-testid="button-republish"
      >
        {republishMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Rocket className="w-3.5 h-3.5 mr-1.5" />}
        {overview?.isPublished ? "Republish" : "Publish"}
      </Button>
    </div>
  );
}

function LogsTab({ projectId }: { projectId: string }) {
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState("24h");

  const sinceDate = useMemo(() => {
    const now = Date.now();
    switch (dateRange) {
      case "1h": return new Date(now - 60 * 60 * 1000).toISOString();
      case "6h": return new Date(now - 6 * 60 * 60 * 1000).toISOString();
      case "24h": return new Date(now - 24 * 60 * 60 * 1000).toISOString();
      case "7d": return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      default: return new Date(now - 24 * 60 * 60 * 1000).toISOString();
    }
  }, [dateRange]);

  const logsQuery = useQuery<DeploymentLog[]>({
    queryKey: ["/api/projects", projectId, "publishing", "logs", errorsOnly, searchQuery, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (errorsOnly) params.set("errorsOnly", "true");
      if (searchQuery) params.set("search", searchQuery);
      params.set("since", sinceDate);
      const res = await fetch(`/api/projects/${projectId}/publishing/logs?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load logs");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const logs = logsQuery.data || [];

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-[var(--ide-border)] space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1">
            <Search className="w-3 h-3 text-[var(--ide-text-muted)]" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-6 text-[10px] bg-[var(--ide-bg)] flex-1"
              data-testid="input-log-search"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-[var(--ide-text-muted)]">Errors</span>
            <Switch checked={errorsOnly} onCheckedChange={setErrorsOnly} className="scale-75" data-testid="toggle-errors-only" />
          </div>
        </div>
        <div className="flex gap-1">
          {["1h", "6h", "24h", "7d"].map((range) => (
            <button
              key={range}
              className={`text-[9px] px-1.5 py-0.5 rounded ${dateRange === range ? "bg-[var(--ide-accent)] text-white" : "bg-[var(--ide-surface)] text-[var(--ide-text-muted)]"}`}
              onClick={() => setDateRange(range)}
              data-testid={`button-range-${range}`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-[10px]">
        {logsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" /></div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[var(--ide-text-muted)]">
            <FileText className="w-6 h-6 mb-2 opacity-50" />
            <span className="text-[11px]">No logs found</span>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`px-2 py-0.5 border-b border-[var(--ide-border)] hover:bg-[var(--ide-surface)] ${log.level === "error" ? "bg-red-500/5" : ""}`}
              data-testid={`log-entry-${log.id}`}
            >
              <span className="text-[9px] text-[var(--ide-text-muted)]">{new Date(log.createdAt).toLocaleTimeString()}</span>
              <span className={`ml-1.5 px-1 py-0 rounded text-[8px] uppercase font-semibold ${
                log.level === "error" ? "bg-red-500/20 text-red-400" :
                log.level === "warn" ? "bg-yellow-500/20 text-yellow-400" :
                "bg-blue-500/20 text-blue-400"
              }`}>{log.level}</span>
              <span className="ml-1.5 text-[var(--ide-text)]">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ResourcesTab({ projectId }: { projectId: string }) {
  const resourcesQuery = useQuery<ResourceData>({
    queryKey: ["/api/projects", projectId, "publishing", "resources"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/publishing/resources`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load resources");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const data = resourcesQuery.data;

  if (resourcesQuery.isLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--ide-text-muted)]" /></div>;

  const cpuData = (data?.snapshots || []).map(s => ({
    time: new Date(s.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    cpu: s.cpuPercent,
  }));

  const memData = (data?.snapshots || []).map(s => ({
    time: new Date(s.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    memory: s.memoryMb,
  }));

  return (
    <div className="p-3 space-y-3 overflow-y-auto">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]" data-testid="metric-current-cpu">
          <div className="flex items-center gap-1.5 mb-1">
            <Cpu className="w-3 h-3 text-blue-400" />
            <span className="text-[9px] text-[var(--ide-text-muted)] uppercase">CPU</span>
          </div>
          <span className="text-lg font-bold text-[var(--ide-text)]">{data?.current.cpuPercent ?? 0}<span className="text-xs text-[var(--ide-text-muted)]">%</span></span>
        </div>
        <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]" data-testid="metric-current-memory">
          <div className="flex items-center gap-1.5 mb-1">
            <HardDrive className="w-3 h-3 text-purple-400" />
            <span className="text-[9px] text-[var(--ide-text-muted)] uppercase">Memory</span>
          </div>
          <span className="text-lg font-bold text-[var(--ide-text)]">{data?.current.memoryMb ?? 0}<span className="text-xs text-[var(--ide-text-muted)]">MB</span></span>
        </div>
      </div>

      <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]">
        <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase block mb-2">CPU Usage Over Time</span>
        {cpuData.length > 0 ? (
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={cpuData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ide-border)" />
              <XAxis dataKey="time" tick={{ fontSize: 8, fill: "var(--ide-text-muted)" }} />
              <YAxis tick={{ fontSize: 8, fill: "var(--ide-text-muted)" }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "var(--ide-surface)", border: "1px solid var(--ide-border)", fontSize: 10, color: "var(--ide-text)" }} />
              <Line type="monotone" dataKey="cpu" stroke="#3B82F6" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-[10px] text-[var(--ide-text-muted)] text-center py-4">No CPU data yet</div>
        )}
      </div>

      <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]">
        <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase block mb-2">Memory Usage Over Time</span>
        {memData.length > 0 ? (
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={memData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ide-border)" />
              <XAxis dataKey="time" tick={{ fontSize: 8, fill: "var(--ide-text-muted)" }} />
              <YAxis tick={{ fontSize: 8, fill: "var(--ide-text-muted)" }} />
              <Tooltip contentStyle={{ background: "var(--ide-surface)", border: "1px solid var(--ide-border)", fontSize: 10, color: "var(--ide-text)" }} />
              <Line type="monotone" dataKey="memory" stroke="#8B5CF6" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-[10px] text-[var(--ide-text-muted)] text-center py-4">No memory data yet</div>
        )}
      </div>

      {data?.current && (
        <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]">
          <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase block mb-2">System Info</span>
          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between"><span className="text-[var(--ide-text-muted)]">Uptime</span><span className="text-[var(--ide-text)]">{Math.floor(data.current.uptimeSeconds / 3600)}h {Math.floor((data.current.uptimeSeconds % 3600) / 60)}m</span></div>
            <div className="flex justify-between"><span className="text-[var(--ide-text-muted)]">Heap</span><span className="text-[var(--ide-text)]">{data.current.heapMb} MB</span></div>
            <div className="flex justify-between"><span className="text-[var(--ide-text-muted)]">System Memory</span><span className="text-[var(--ide-text)]">{data.current.systemMemory.usedMb}/{data.current.systemMemory.totalMb} MB ({data.current.systemMemory.usedPercent}%)</span></div>
            <div className="flex justify-between"><span className="text-[var(--ide-text-muted)]">Load (1m/5m/15m)</span><span className="text-[var(--ide-text)]">{data.current.loadAverage.load1} / {data.current.loadAverage.load5} / {data.current.loadAverage.load15}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticsTab({ projectId }: { projectId: string }) {
  const [dateRange, setDateRange] = useState("30d");

  const sinceDate = useMemo(() => {
    const now = Date.now();
    switch (dateRange) {
      case "24h": return new Date(now - 24 * 60 * 60 * 1000).toISOString();
      case "7d": return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      case "30d": return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
      case "90d": return new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
      default: return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  }, [dateRange]);

  const analyticsQuery = useQuery<AnalyticsData>({
    queryKey: ["/api/projects", projectId, "publishing", "analytics", dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/publishing/analytics?since=${sinceDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const data = analyticsQuery.data;

  if (analyticsQuery.isLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--ide-text-muted)]" /></div>;

  return (
    <div className="p-3 space-y-3 overflow-y-auto">
      <div className="flex gap-1 mb-2">
        {["24h", "7d", "30d", "90d"].map((range) => (
          <button
            key={range}
            className={`text-[9px] px-1.5 py-0.5 rounded ${dateRange === range ? "bg-[var(--ide-accent)] text-white" : "bg-[var(--ide-surface)] text-[var(--ide-text-muted)]"}`}
            onClick={() => setDateRange(range)}
            data-testid={`button-analytics-range-${range}`}
          >
            {range}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]" data-testid="metric-page-views">
          <div className="flex items-center gap-1.5 mb-1">
            <Eye className="w-3 h-3 text-blue-400" />
            <span className="text-[9px] text-[var(--ide-text-muted)] uppercase">Page Views</span>
          </div>
          <span className="text-lg font-bold text-[var(--ide-text)]">{data?.pageViews ?? 0}</span>
        </div>
        <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]" data-testid="metric-unique-visitors">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="w-3 h-3 text-green-400" />
            <span className="text-[9px] text-[var(--ide-text-muted)] uppercase">Unique Visitors</span>
          </div>
          <span className="text-lg font-bold text-[var(--ide-text)]">{data?.uniqueVisitors ?? 0}</span>
        </div>
      </div>

      <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]">
        <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase block mb-2">Traffic Over Time</span>
        {(data?.trafficByDay?.length ?? 0) > 0 ? (
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={data!.trafficByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ide-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 7, fill: "var(--ide-text-muted)" }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 8, fill: "var(--ide-text-muted)" }} />
              <Tooltip contentStyle={{ background: "var(--ide-surface)", border: "1px solid var(--ide-border)", fontSize: 10, color: "var(--ide-text)" }} />
              <Bar dataKey="views" fill="#3B82F6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-[10px] text-[var(--ide-text-muted)] text-center py-4">No traffic data yet</div>
        )}
      </div>

      <TopList title="Top URLs" icon={<Globe className="w-3 h-3 text-blue-400" />} items={data?.topUrls?.map(u => ({ label: u.url, value: u.count })) || []} testId="top-urls" />
      <TopList title="Top Referrers" icon={<ArrowUpRight className="w-3 h-3 text-green-400" />} items={data?.topReferrers?.map(r => ({ label: r.referrer || "(direct)", value: r.count })) || []} testId="top-referrers" />

      <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]">
        <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase block mb-2">HTTP Status Distribution</span>
        {(data?.statusDistribution?.length ?? 0) > 0 ? (
          <div className="space-y-1">
            {data!.statusDistribution.map(s => (
              <div key={s.status} className="flex items-center gap-2 text-[10px]" data-testid={`status-${s.status}`}>
                <span className={`font-mono ${s.status < 300 ? "text-green-400" : s.status < 400 ? "text-blue-400" : s.status < 500 ? "text-yellow-400" : "text-red-400"}`}>{s.status}</span>
                <div className="flex-1 h-1.5 bg-[var(--ide-border)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(5, (s.count / (data!.pageViews || 1)) * 100)}%`, backgroundColor: s.status < 300 ? "#10B981" : s.status < 400 ? "#3B82F6" : s.status < 500 ? "#F59E0B" : "#EF4444" }} />
                </div>
                <span className="text-[var(--ide-text-muted)] w-8 text-right">{s.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-[var(--ide-text-muted)] text-center py-2">No data</div>
        )}
      </div>

      <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]">
        <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase block mb-2">Response Duration</span>
        {(data?.durationHistogram?.length ?? 0) > 0 ? (
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={data!.durationHistogram}>
              <XAxis dataKey="bucket" tick={{ fontSize: 7, fill: "var(--ide-text-muted)" }} />
              <YAxis tick={{ fontSize: 8, fill: "var(--ide-text-muted)" }} />
              <Tooltip contentStyle={{ background: "var(--ide-surface)", border: "1px solid var(--ide-border)", fontSize: 10, color: "var(--ide-text)" }} />
              <Bar dataKey="count" fill="#8B5CF6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-[10px] text-[var(--ide-text-muted)] text-center py-2">No data</div>
        )}
      </div>

      <TopList title="Top Browsers" icon={<Monitor className="w-3 h-3 text-cyan-400" />} items={data?.topBrowsers?.map(b => ({ label: b.browser, value: b.count })) || []} testId="top-browsers" />
      <TopList title="Top Devices" icon={<Smartphone className="w-3 h-3 text-purple-400" />} items={data?.topDevices?.map(d => ({ label: d.device, value: d.count })) || []} testId="top-devices" />
      <TopList title="Top Countries" icon={<MapPin className="w-3 h-3 text-orange-400" />} items={data?.topCountries?.map(c => ({ label: c.country, value: c.count })) || []} testId="top-countries" />
    </div>
  );
}

function TopList({ title, icon, items, testId }: { title: string; icon: React.ReactNode; items: { label: string; value: number }[]; testId: string }) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]" data-testid={testId}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase">{title}</span>
      </div>
      <div className="space-y-1">
        {items.slice(0, 8).map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px]">
            <span className="text-[var(--ide-text)] truncate flex-1">{item.label}</span>
            <div className="w-16 h-1.5 bg-[var(--ide-border)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--ide-accent)] rounded-full" style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
            <span className="text-[var(--ide-text-muted)] w-6 text-right font-mono">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PublishingPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const tabs: { id: TabId; label: string; icon: typeof Globe }[] = [
    { id: "overview", label: "Overview", icon: Globe },
    { id: "logs", label: "Logs", icon: FileText },
    { id: "resources", label: "Resources", icon: Cpu },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="flex flex-col h-full" data-testid="publishing-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Publishing</span>
        <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-publishing">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex border-b border-[var(--ide-border)] shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[var(--ide-accent)] text-[var(--ide-accent)]"
                  : "border-transparent text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
              }`}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "overview" && <OverviewTab projectId={projectId} />}
        {activeTab === "logs" && <LogsTab projectId={projectId} />}
        {activeTab === "resources" && <ResourcesTab projectId={projectId} />}
        {activeTab === "analytics" && <AnalyticsTab projectId={projectId} />}
      </div>
    </div>
  );
}
