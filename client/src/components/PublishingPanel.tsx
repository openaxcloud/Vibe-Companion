import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Activity, Loader2, X, Globe, Rocket, Copy, Check, ExternalLink,
  RefreshCw, BarChart3, Search, Clock, Cpu, HardDrive, FileText, Eye,
  Smartphone, Monitor, MapPin, ArrowUpRight, AlertCircle, QrCode,
  Server, Zap, Calendar, FolderOpen, Key, Plus, Trash2, Shield, Badge,
  MessageSquare, ChevronDown, ChevronRight, Settings, History, Play,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { QRCodeSVG as RealQRCode } from "qrcode.react";

type TabId = "overview" | "configure" | "logs" | "resources" | "analytics";
type DeploymentType = "autoscale" | "static" | "reserved-vm" | "scheduled";

interface DeploymentConfig {
  buildCommand: string;
  runCommand: string;
  machineConfig: { cpu: number; ram: number };
  maxMachines: number;
  cronExpression: string;
  scheduleDescription: string;
  jobTimeout: number;
  publicDirectory: string;
  appType: string;
  deploymentSecrets: Record<string, string>;
  deploymentSecretKeys?: string[];
  portMapping: number;
  isPrivate: boolean;
  showBadge: boolean;
  enableFeedback: boolean;
}

interface DeploymentHistoryItem {
  id: string;
  version: number;
  status: string;
  deploymentType: string;
  createdAt: string | null;
  finishedAt: string | null;
}

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
  config: DeploymentConfig | null;
  history: DeploymentHistoryItem[];
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

const DEPLOYMENT_TYPES: { id: DeploymentType; label: string; icon: typeof Globe; desc: string; color: string }[] = [
  { id: "autoscale", label: "Autoscale", icon: Zap, desc: "Scales up/down based on traffic", color: "text-yellow-400" },
  { id: "static", label: "Static", icon: FolderOpen, desc: "Host static sites (HTML/CSS/JS)", color: "text-blue-400" },
  { id: "reserved-vm", label: "Reserved VM", icon: Server, desc: "Always-on dedicated machine", color: "text-purple-400" },
  { id: "scheduled", label: "Scheduled", icon: Calendar, desc: "Run on a cron schedule", color: "text-green-400" },
];

const MACHINE_PRESETS = [
  { label: "0.25 vCPU / 256 MB", cpu: 0.25, ram: 256 },
  { label: "0.5 vCPU / 512 MB", cpu: 0.5, ram: 512 },
  { label: "1 vCPU / 1 GB", cpu: 1, ram: 1024 },
  { label: "2 vCPU / 2 GB", cpu: 2, ram: 2048 },
  { label: "4 vCPU / 4 GB", cpu: 4, ram: 4096 },
  { label: "8 vCPU / 8 GB", cpu: 8, ram: 8192 },
];

const DEFAULT_CONFIG: DeploymentConfig = {
  buildCommand: "",
  runCommand: "",
  machineConfig: { cpu: 0.5, ram: 512 },
  maxMachines: 1,
  cronExpression: "",
  scheduleDescription: "",
  jobTimeout: 300,
  publicDirectory: "dist",
  appType: "web_server",
  deploymentSecrets: {},
  portMapping: 3000,
  isPrivate: false,
  showBadge: true,
  enableFeedback: false,
};

function QRCodeDisplay({ url }: { url: string }) {
  return <RealQRCode value={url} size={120} level="M" bgColor="#ffffff" fgColor="#000000" />;
}

function SectionHeader({ title, icon: Icon, collapsed, onToggle }: { title: string; icon: typeof Globe; collapsed?: boolean; onToggle?: () => void }) {
  return (
    <button
      className="flex items-center gap-1.5 w-full text-left py-1"
      onClick={onToggle}
      data-testid={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {onToggle && (collapsed ? <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" /> : <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)]" />)}
      <Icon className="w-3 h-3 text-[var(--ide-accent)]" />
      <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wide">{title}</span>
    </button>
  );
}

function ConfigureTab({ projectId, initialConfig, initialType, onDeploy }: {
  projectId: string;
  initialConfig: DeploymentConfig | null;
  initialType: DeploymentType;
  onDeploy: () => void;
}) {
  const queryClient = useQueryClient();
  const [deploymentType, setDeploymentType] = useState<DeploymentType>(initialType);
  const [config, setConfig] = useState<DeploymentConfig>(initialConfig || DEFAULT_CONFIG);
  const [newSecretKey, setNewSecretKey] = useState("");
  const [newSecretValue, setNewSecretValue] = useState("");
  const [showSecrets, setShowSecrets] = useState(false);
  const [convertingSchedule, setConvertingSchedule] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [existingSecretKeys, setExistingSecretKeys] = useState<string[]>([]);

  useEffect(() => {
    if (initialConfig) {
      const { deploymentSecretKeys, ...rest } = initialConfig;
      setConfig({ ...rest, deploymentSecrets: rest.deploymentSecrets || {} });
      if (deploymentSecretKeys) setExistingSecretKeys(deploymentSecretKeys);
    }
    if (initialType) setDeploymentType(initialType);
  }, [initialConfig, initialType]);

  const deployMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/projects/${projectId}/deploy`, {
        deploymentType,
        ...config,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "publishing"] });
      onDeploy();
    },
  });

  const convertScheduleMutation = useMutation({
    mutationFn: async (description: string) => {
      const res = await apiRequest("POST", "/api/deploy/schedule-to-cron", { description });
      return res.json();
    },
    onSuccess: (data: { cronExpression: string }) => {
      setConfig(prev => ({ ...prev, cronExpression: data.cronExpression }));
    },
  });

  const addSecret = () => {
    if (newSecretKey.trim() && newSecretValue.trim()) {
      setConfig(prev => ({
        ...prev,
        deploymentSecrets: { ...prev.deploymentSecrets, [newSecretKey.trim()]: newSecretValue.trim() },
      }));
      setNewSecretKey("");
      setNewSecretValue("");
    }
  };

  const removeSecret = (key: string) => {
    setConfig(prev => {
      const updated = { ...prev.deploymentSecrets };
      delete updated[key];
      return { ...prev, deploymentSecrets: updated };
    });
  };

  const machinePresetIdx = MACHINE_PRESETS.findIndex(
    p => p.cpu === config.machineConfig.cpu && p.ram === config.machineConfig.ram
  );

  return (
    <div className="p-3 space-y-3 overflow-y-auto">
      <div className="space-y-1.5">
        <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wide">Deployment Type</span>
        <div className="grid grid-cols-2 gap-1.5">
          {DEPLOYMENT_TYPES.map((dt) => {
            const Icon = dt.icon;
            const selected = deploymentType === dt.id;
            return (
              <button
                key={dt.id}
                className={`flex flex-col items-start p-2 rounded-lg border transition-all text-left ${
                  selected
                    ? "border-[var(--ide-accent)] bg-[var(--ide-accent)]/10"
                    : "border-[var(--ide-border)] bg-[var(--ide-surface)] hover:border-[var(--ide-text-muted)]"
                }`}
                onClick={() => setDeploymentType(dt.id)}
                data-testid={`deploy-type-${dt.id}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon className={`w-3.5 h-3.5 ${selected ? "text-[var(--ide-accent)]" : dt.color}`} />
                  <span className={`text-[10px] font-semibold ${selected ? "text-[var(--ide-accent)]" : "text-[var(--ide-text)]"}`}>{dt.label}</span>
                </div>
                <span className="text-[8px] text-[var(--ide-text-muted)] leading-tight">{dt.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {(deploymentType === "autoscale" || deploymentType === "reserved-vm") && (
        <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)] space-y-2">
          <SectionHeader title="Machine Power" icon={Cpu} />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-[var(--ide-text-muted)]">
                {config.machineConfig.cpu} vCPU / {config.machineConfig.ram >= 1024 ? `${(config.machineConfig.ram / 1024).toFixed(1)} GB` : `${config.machineConfig.ram} MB`}
              </span>
              <span className="text-[8px] text-[var(--ide-text-muted)]">
                ~{(config.machineConfig.cpu * 20).toFixed(0)} Compute Units/day
              </span>
            </div>
            <Slider
              value={[machinePresetIdx >= 0 ? machinePresetIdx : 1]}
              min={0}
              max={MACHINE_PRESETS.length - 1}
              step={1}
              onValueChange={([idx]) => {
                const preset = MACHINE_PRESETS[idx];
                setConfig(prev => ({ ...prev, machineConfig: { cpu: preset.cpu, ram: preset.ram } }));
              }}
              className="w-full"
              data-testid="slider-machine-power"
            />
            <div className="flex justify-between text-[7px] text-[var(--ide-text-muted)]">
              <span>0.25 vCPU</span>
              <span>8 vCPU</span>
            </div>
          </div>
          {deploymentType === "autoscale" && (
            <div className="space-y-1">
              <label className="text-[9px] text-[var(--ide-text-muted)]">Max Machines</label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[config.maxMachines]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={([v]) => setConfig(prev => ({ ...prev, maxMachines: v }))}
                  className="flex-1"
                  data-testid="slider-max-machines"
                />
                <span className="text-[10px] text-[var(--ide-text)] font-mono w-6 text-right">{config.maxMachines}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {(deploymentType === "static" || deploymentType === "autoscale" || deploymentType === "reserved-vm") && (
        <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)] space-y-2">
          <SectionHeader title="Build & Run" icon={Play} />
          <div className="space-y-1.5">
            <div>
              <label className="text-[9px] text-[var(--ide-text-muted)]">Build Command</label>
              <Input
                value={config.buildCommand}
                onChange={(e) => setConfig(prev => ({ ...prev, buildCommand: e.target.value }))}
                placeholder={deploymentType === "static" ? "npm run build" : "npm install && npm run build"}
                className="h-7 text-[10px] bg-[var(--ide-bg)] font-mono"
                data-testid="input-build-command"
              />
            </div>
            {(deploymentType === "autoscale" || deploymentType === "reserved-vm") && (
              <div>
                <label className="text-[9px] text-[var(--ide-text-muted)]">Run Command</label>
                <Input
                  value={config.runCommand}
                  onChange={(e) => setConfig(prev => ({ ...prev, runCommand: e.target.value }))}
                  placeholder="npm start"
                  className="h-7 text-[10px] bg-[var(--ide-bg)] font-mono"
                  data-testid="input-run-command"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {deploymentType === "static" && (
        <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)] space-y-2">
          <SectionHeader title="Static Settings" icon={FolderOpen} />
          <div>
            <label className="text-[9px] text-[var(--ide-text-muted)]">Public Directory</label>
            <Input
              value={config.publicDirectory}
              onChange={(e) => setConfig(prev => ({ ...prev, publicDirectory: e.target.value }))}
              placeholder="dist"
              className="h-7 text-[10px] bg-[var(--ide-bg)] font-mono"
              data-testid="input-public-directory"
            />
            <span className="text-[8px] text-[var(--ide-text-muted)]">Folder containing your built files</span>
          </div>
        </div>
      )}

      {deploymentType === "reserved-vm" && (
        <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)] space-y-2">
          <SectionHeader title="App Type" icon={Server} />
          <div className="flex gap-2">
            {[
              { id: "web_server", label: "Web Server", desc: "HTTP server on a port" },
              { id: "background_worker", label: "Background Worker", desc: "Long-running process" },
            ].map((at) => (
              <button
                key={at.id}
                className={`flex-1 p-2 rounded-lg border text-left transition-all ${
                  config.appType === at.id
                    ? "border-[var(--ide-accent)] bg-[var(--ide-accent)]/10"
                    : "border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-text-muted)]"
                }`}
                onClick={() => setConfig(prev => ({ ...prev, appType: at.id }))}
                data-testid={`app-type-${at.id}`}
              >
                <span className={`text-[10px] font-semibold ${config.appType === at.id ? "text-[var(--ide-accent)]" : "text-[var(--ide-text)]"}`}>{at.label}</span>
                <span className="text-[8px] text-[var(--ide-text-muted)] block">{at.desc}</span>
              </button>
            ))}
          </div>
          {config.appType === "web_server" && (
            <div>
              <label className="text-[9px] text-[var(--ide-text-muted)]">Port Mapping</label>
              <Input
                type="number"
                value={config.portMapping}
                onChange={(e) => setConfig(prev => ({ ...prev, portMapping: parseInt(e.target.value) || 3000 }))}
                className="h-7 text-[10px] bg-[var(--ide-bg)] font-mono"
                data-testid="input-port-mapping"
              />
            </div>
          )}
        </div>
      )}

      {deploymentType === "scheduled" && (
        <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)] space-y-2">
          <SectionHeader title="Schedule" icon={Calendar} />
          <div className="space-y-1.5">
            <div>
              <label className="text-[9px] text-[var(--ide-text-muted)]">Describe your schedule</label>
              <div className="flex gap-1.5">
                <Input
                  value={config.scheduleDescription}
                  onChange={(e) => setConfig(prev => ({ ...prev, scheduleDescription: e.target.value }))}
                  placeholder="Every day at 3am"
                  className="h-7 text-[10px] bg-[var(--ide-bg)] flex-1"
                  data-testid="input-schedule-description"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[9px] px-2"
                  onClick={() => {
                    if (config.scheduleDescription) {
                      setConvertingSchedule(true);
                      convertScheduleMutation.mutate(config.scheduleDescription, {
                        onSettled: () => setConvertingSchedule(false),
                      });
                    }
                  }}
                  disabled={convertingSchedule || !config.scheduleDescription}
                  data-testid="button-convert-schedule"
                >
                  {convertingSchedule ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                </Button>
              </div>
            </div>
            <div>
              <label className="text-[9px] text-[var(--ide-text-muted)]">Cron Expression</label>
              <Input
                value={config.cronExpression}
                onChange={(e) => setConfig(prev => ({ ...prev, cronExpression: e.target.value }))}
                placeholder="0 3 * * *"
                className="h-7 text-[10px] bg-[var(--ide-bg)] font-mono"
                data-testid="input-cron-expression"
              />
              <span className="text-[8px] text-[var(--ide-text-muted)]">minute hour day-of-month month day-of-week</span>
            </div>
            <div>
              <label className="text-[9px] text-[var(--ide-text-muted)]">Build Command</label>
              <Input
                value={config.buildCommand}
                onChange={(e) => setConfig(prev => ({ ...prev, buildCommand: e.target.value }))}
                placeholder="npm install"
                className="h-7 text-[10px] bg-[var(--ide-bg)] font-mono"
                data-testid="input-scheduled-build-command"
              />
            </div>
            <div>
              <label className="text-[9px] text-[var(--ide-text-muted)]">Run Command</label>
              <Input
                value={config.runCommand}
                onChange={(e) => setConfig(prev => ({ ...prev, runCommand: e.target.value }))}
                placeholder="node job.js"
                className="h-7 text-[10px] bg-[var(--ide-bg)] font-mono"
                data-testid="input-scheduled-run-command"
              />
            </div>
            <div>
              <label className="text-[9px] text-[var(--ide-text-muted)]">Job Timeout (seconds)</label>
              <Input
                type="number"
                value={config.jobTimeout}
                onChange={(e) => setConfig(prev => ({ ...prev, jobTimeout: parseInt(e.target.value) || 300 }))}
                className="h-7 text-[10px] bg-[var(--ide-bg)] font-mono"
                data-testid="input-job-timeout"
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)] space-y-2">
        <SectionHeader title="Deployment Secrets" icon={Key} collapsed={!showSecrets} onToggle={() => setShowSecrets(!showSecrets)} />
        {showSecrets && (
          <div className="space-y-1.5">
            {existingSecretKeys.filter(k => !(k in config.deploymentSecrets)).map((key) => (
              <div key={`existing-${key}`} className="flex items-center gap-1.5">
                <span className="text-[9px] text-[var(--ide-text)] font-mono flex-1 truncate">{key}</span>
                <span className="text-[9px] text-[var(--ide-text-muted)] font-mono">{"•".repeat(8)}</span>
                <span className="text-[7px] text-[var(--ide-text-muted)]">saved</span>
              </div>
            ))}
            {Object.entries(config.deploymentSecrets).map(([key, value]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className="text-[9px] text-[var(--ide-text)] font-mono flex-1 truncate">{key}</span>
                <span className="text-[9px] text-[var(--ide-text-muted)] font-mono truncate max-w-[80px]">{"•".repeat(Math.min(value.length, 12))}</span>
                <button
                  className="text-[var(--ide-text-muted)] hover:text-red-400"
                  onClick={() => removeSecret(key)}
                  data-testid={`button-remove-secret-${key}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-1">
              <Input
                value={newSecretKey}
                onChange={(e) => setNewSecretKey(e.target.value)}
                placeholder="KEY"
                className="h-6 text-[9px] bg-[var(--ide-bg)] font-mono flex-1"
                data-testid="input-secret-key"
              />
              <Input
                value={newSecretValue}
                onChange={(e) => setNewSecretValue(e.target.value)}
                placeholder="value"
                type="password"
                className="h-6 text-[9px] bg-[var(--ide-bg)] font-mono flex-1"
                data-testid="input-secret-value"
              />
              <Button variant="outline" size="icon" className="w-6 h-6" onClick={addSecret} data-testid="button-add-secret">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)] space-y-2">
        <SectionHeader title="Access & Settings" icon={Settings} />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-[var(--ide-text-muted)]" />
              <span className="text-[9px] text-[var(--ide-text)]">Private Deployment</span>
            </div>
            <Switch
              checked={config.isPrivate}
              onCheckedChange={(v) => setConfig(prev => ({ ...prev, isPrivate: v }))}
              className="scale-75"
              data-testid="toggle-private"
            />
          </div>
          {config.isPrivate && (
            <span className="text-[8px] text-yellow-400 block pl-5">Requires Teams plan</span>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Badge className="w-3 h-3 text-[var(--ide-text-muted)]" />
              <span className="text-[9px] text-[var(--ide-text)]">Show "Made with Vibe Companion" Badge</span>
            </div>
            <Switch
              checked={config.showBadge}
              onCheckedChange={(v) => setConfig(prev => ({ ...prev, showBadge: v }))}
              className="scale-75"
              data-testid="toggle-badge"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3 text-[var(--ide-text-muted)]" />
              <span className="text-[9px] text-[var(--ide-text)]">Feedback Widget</span>
            </div>
            <Switch
              checked={config.enableFeedback}
              onCheckedChange={(v) => setConfig(prev => ({ ...prev, enableFeedback: v }))}
              className="scale-75"
              data-testid="toggle-feedback"
            />
          </div>
        </div>
      </div>

      <Button
        className="w-full h-9 text-xs font-semibold"
        onClick={() => deployMutation.mutate()}
        disabled={deployMutation.isPending}
        data-testid="button-deploy"
      >
        {deployMutation.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
        ) : (
          <Rocket className="w-3.5 h-3.5 mr-1.5" />
        )}
        Deploy as {DEPLOYMENT_TYPES.find(t => t.id === deploymentType)?.label || "Static"}
      </Button>

      {deployMutation.isError && (
        <div className="flex items-start gap-1.5 p-2 bg-red-500/10 rounded-lg border border-red-500/30">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
          <span className="text-[9px] text-red-400">{(deployMutation.error as Error).message}</span>
        </div>
      )}
    </div>
  );
}

function OverviewTab({ projectId, overview }: { projectId: string; overview: OverviewData | undefined }) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const queryClient = useQueryClient();

  const republishMutation = useMutation({
    mutationFn: async () => {
      const cfg = overview?.config;
      const body: Record<string, any> = {
        deploymentType: overview?.deploymentType || "static",
      };
      if (cfg) {
        body.buildCommand = cfg.buildCommand;
        body.runCommand = cfg.runCommand;
        body.machineConfig = cfg.machineConfig;
        body.maxMachines = cfg.maxMachines;
        body.cronExpression = cfg.cronExpression;
        body.scheduleDescription = cfg.scheduleDescription;
        body.jobTimeout = cfg.jobTimeout;
        body.publicDirectory = cfg.publicDirectory;
        body.appType = cfg.appType;
        body.portMapping = cfg.portMapping;
        body.isPrivate = cfg.isPrivate;
        body.showBadge = cfg.showBadge;
        body.enableFeedback = cfg.enableFeedback;
      }
      await apiRequest("POST", `/api/projects/${projectId}/deploy`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "publishing"] });
    },
  });

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

      {overview?.history && overview.history.length > 0 && (
        <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]">
          <SectionHeader title="Deployment History" icon={History} />
          <div className="space-y-1 mt-1.5">
            {overview.history.map((h) => (
              <div key={h.id} className="flex items-center gap-2 text-[9px] py-0.5" data-testid={`history-entry-${h.version}`}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[h.status] || "#6B7280" }} />
                <span className="text-[var(--ide-text)] font-semibold">v{h.version}</span>
                <span className="text-[var(--ide-text-muted)] uppercase text-[8px]">{h.deploymentType}</span>
                <span className={`px-1 rounded text-[7px] uppercase font-semibold ${
                  h.status === "live" ? "bg-green-500/20 text-green-400" :
                  h.status === "failed" ? "bg-red-500/20 text-red-400" :
                  h.status === "building" ? "bg-yellow-500/20 text-yellow-400" :
                  "bg-gray-500/20 text-gray-400"
                }`}>{h.status}</span>
                <span className="text-[var(--ide-text-muted)] ml-auto">
                  {h.createdAt ? new Date(h.createdAt).toLocaleDateString() : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button
        className="w-full h-8 text-xs"
        onClick={() => republishMutation.mutate()}
        disabled={republishMutation.isPending}
        data-testid="button-republish"
      >
        {republishMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Rocket className="w-3.5 h-3.5 mr-1.5" />}
        {overview?.isPublished ? "Republish" : "Quick Publish"}
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

  const overviewQuery = useQuery<OverviewData>({
    queryKey: ["/api/projects", projectId, "publishing", "overview"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/publishing/overview`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load overview");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const overview = overviewQuery.data;

  const tabs: { id: TabId; label: string; icon: typeof Globe }[] = [
    { id: "overview", label: "Overview", icon: Globe },
    { id: "configure", label: "Configure", icon: Settings },
    { id: "logs", label: "Logs", icon: FileText },
    { id: "resources", label: "Resources", icon: Cpu },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  if (overviewQuery.isLoading) {
    return (
      <div className="flex flex-col h-full" data-testid="publishing-panel">
        <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
          <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Deployments</span>
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-publishing">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--ide-text-muted)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="publishing-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Deployments</span>
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
              className={`flex items-center gap-1 px-2 py-1.5 text-[9px] font-medium border-b-2 transition-colors ${
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
        {activeTab === "overview" && <OverviewTab projectId={projectId} overview={overview} />}
        {activeTab === "configure" && (
          <ConfigureTab
            projectId={projectId}
            initialConfig={overview?.config || null}
            initialType={(overview?.deploymentType as DeploymentType) || "static"}
            onDeploy={() => {
              overviewQuery.refetch();
              setActiveTab("overview");
            }}
          />
        )}
        {activeTab === "logs" && <LogsTab projectId={projectId} />}
        {activeTab === "resources" && <ResourcesTab projectId={projectId} />}
        {activeTab === "analytics" && <AnalyticsTab projectId={projectId} />}
      </div>
    </div>
  );
}
