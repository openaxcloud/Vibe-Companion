import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Puzzle, Loader2, Plus, X, Check, Search, ChevronDown, ChevronRight,
  Database, Sparkles, CreditCard, Cloud, Mail, Phone, Flame, Zap, Github, Plug,
  MessageSquare, MessageCircle, Send, Smartphone, BookOpen, Table2, Calendar,
  Users, Music, Layout, ClipboardList, RefreshCw, CheckCircle2, XCircle, AlertCircle,
  Warehouse, BarChart, GitBranch, Hexagon, Shield, Globe, Link2, ExternalLink, Figma, UserCheck,
} from "lucide-react";
import type { McpServer, McpTool } from "@shared/schema";

interface CatalogEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  envVarKeys: string[];
  connectorType: "oauth" | "apikey" | "managed";
  connectionLevel: "account" | "project";
  oauthConfig?: { authUrl: string; tokenUrl: string; scopes: string[] } | null;
  providerUrl?: string | null;
}

interface ProjectIntegration {
  id: string;
  projectId: string;
  integrationId: string;
  status: string;
  config: Record<string, string>;
  connectedAt: string;
  integration: CatalogEntry;
}

interface IntegrationLog {
  id: string;
  level: string;
  message: string;
  createdAt: string;
}

const iconMap: Record<string, typeof Plug> = {
  database: Database,
  sparkles: Sparkles,
  "credit-card": CreditCard,
  cloud: Cloud,
  mail: Mail,
  phone: Phone,
  flame: Flame,
  zap: Zap,
  github: Github,
  plug: Plug,
  "message-square": MessageSquare,
  "message-circle": MessageCircle,
  send: Send,
  smartphone: Smartphone,
  "book-open": BookOpen,
  table: Table2,
  calendar: Calendar,
  users: Users,
  music: Music,
  layout: Layout,
  clipboard: ClipboardList,
  warehouse: Warehouse,
  "bar-chart": BarChart,
  "git-branch": GitBranch,
  hexagon: Hexagon,
  figma: Figma,
  "user-check": UserCheck,
};

function IntegrationIcon({ icon, className, style }: { icon: string; className?: string; style?: React.CSSProperties }) {
  const Icon = iconMap[icon] || Plug;
  return <Icon className={className} style={style} />;
}

const categoryColors: Record<string, string> = {
  "Google Workspace": "#4285F4",
  "Microsoft 365": "#00A4EF",
  "Developer Tools": "#F26522",
  "Cloud Storage": "#F5A623",
  "Communication": "#E84D8A",
  "CRM & Sales": "#EC4899",
  "Payments": "#0CCE6B",
  "AI & Media": "#7C65CB",
  "Productivity": "#10B981",
  "CRM & Marketing": "#EC4899",
  "Media": "#8B5CF6",
  "Data Warehouse": "#3B82F6",
  "Project Management": "#F97316",
  "Analytics": "#06B6D4",
  "Data": "#6366F1",
  "Design": "#A259FF",
  "Authentication": "#14B8A6",
  "Database": "#0079F2",
  "Backend Services": "#00B4D8",
};

export default function IntegrationsPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const catalogQuery = useQuery<CatalogEntry[]>({
    queryKey: ["/api/integrations/catalog"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/catalog", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load catalog");
      return res.json();
    },
  });

  const integrationsQuery = useQuery<ProjectIntegration[]>({
    queryKey: ["/api/projects", projectId, "integrations"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/integrations`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load integrations");
      return res.json();
    },
  });

  const userConnectionsQuery = useQuery<{ id: string; userId: string; integrationId: string; status: string; connectedAt: string; integration: CatalogEntry }[]>({
    queryKey: ["/api/user/connections"],
    queryFn: async () => {
      const res = await fetch("/api/user/connections", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load connections");
      return res.json();
    },
  });

  const logsQuery = useQuery<IntegrationLog[]>({
    queryKey: ["/api/projects", projectId, "integrations", expandedLogId, "logs"],
    queryFn: async () => {
      if (!expandedLogId) return [];
      const res = await fetch(`/api/projects/${projectId}/integrations/${expandedLogId}/logs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load logs");
      return res.json();
    },
    enabled: !!expandedLogId,
  });

  const connectMutation = useMutation({
    mutationFn: async ({ integrationId, config }: { integrationId: string; config: Record<string, string> }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/integrations`, { integrationId, config });
      return res.json();
    },
    onSuccess: (data: ProjectIntegration) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "integrations"] });
      setConnectingId(null);
      setConfigValues({});
      if (data?.status === "error") {
        toast({ title: "Connection failed", description: "Credentials saved but connection test failed", variant: "destructive" });
      } else if (data?.status === "unverified") {
        toast({ title: "Credentials saved", description: "Live verification unavailable for this service — credentials will be injected into your code" });
      } else {
        toast({ title: "Integration connected", description: "Connection verified successfully" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Failed to connect", description: err.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/integrations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "integrations"] });
      toast({ title: "Integration disconnected" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to disconnect", description: err.message, variant: "destructive" });
    },
  });

  const oauthStartMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/integrations/oauth/start`, { integrationId });
      return res.json();
    },
    onSuccess: (data: { authUrl: string; state: string }) => {
      window.open(data.authUrl, "_blank", "width=600,height=700,popup=yes");
      setConnectingId(null);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/user/connections"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "integrations"] });
      }, 3000);
      toast({ title: "OAuth flow started", description: "Complete authorization in the popup window" });
    },
    onError: (err: any) => {
      toast({ title: "OAuth flow failed", description: err.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      setTestingId(integrationId);
      const res = await apiRequest("POST", `/api/projects/${projectId}/integrations/${integrationId}/test`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "integrations"] });
      if (expandedLogId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "integrations", expandedLogId, "logs"] });
      }
      toast({
        title: data.success ? "Connection verified" : "Connection test failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
      setTestingId(null);
    },
    onError: (err: any) => {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
      setTestingId(null);
    },
  });

  const catalog = catalogQuery.data || [];
  const connected = integrationsQuery.data || [];
  const accountConnections = userConnectionsQuery.data || [];
  const connectedIds = new Set([...connected.map(c => c.integrationId), ...accountConnections.map(c => c.integrationId)]);
  const logs = logsQuery.data || [];

  const filteredCatalog = catalog.filter(c =>
    !connectedIds.has(c.id) &&
    (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.category.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (!selectedCategory || c.category === selectedCategory)
  );

  const groupedCatalog = filteredCatalog.reduce<Record<string, CatalogEntry[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const allCategories = [...new Set(catalog.map(c => c.category))].sort();

  return (
    <div className="flex flex-col h-full" data-testid="integrations-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Puzzle className="w-3.5 h-3.5 text-[#0079F2]" />
          <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Integrations</span>
          <span className="text-[9px] text-[var(--ide-text-muted)] ml-1">({catalog.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[#0CCE6B] hover:bg-[var(--ide-surface)]"
            onClick={() => setShowCatalog(!showCatalog)}
            data-testid="button-toggle-catalog"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
            onClick={onClose}
            data-testid="button-close-integrations"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {connected.length > 0 && (
          <div className="border-b border-[var(--ide-border)]">
            <div className="px-3 py-2">
              <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Connected ({connected.length})</span>
            </div>
            <div className="space-y-0.5 pb-2">
              {connected.map((pi) => (
                <div key={pi.id} data-testid={`integration-connected-${pi.id}`}>
                  <div className="px-3 py-2 hover:bg-[var(--ide-surface)]/30 transition-colors group">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${categoryColors[pi.integration.category] || "#0079F2"}15` }}>
                        <IntegrationIcon icon={pi.integration.icon} className="w-3.5 h-3.5" style={{ color: categoryColors[pi.integration.category] || "#0079F2" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[11px] text-[var(--ide-text)] font-medium truncate">{pi.integration.name}</p>
                          <span className={`text-[7px] px-1 py-0.5 rounded font-medium uppercase tracking-wider ${
                            pi.integration.connectorType === "oauth"
                              ? "bg-[#4285F4]/15 text-[#4285F4]"
                              : pi.integration.connectorType === "managed"
                              ? "bg-[#0CCE6B]/15 text-[#0CCE6B]"
                              : "bg-[var(--ide-surface)] text-[var(--ide-text-muted)]"
                          }`}>
                            {pi.integration.connectorType === "oauth" ? "OAuth" : pi.integration.connectorType === "managed" ? "Managed" : "API Key"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full ${
                            pi.status === "connected"
                              ? "bg-[#0CCE6B]/15 text-[#0CCE6B]"
                              : pi.status === "error"
                              ? "bg-red-500/15 text-red-400"
                              : pi.status === "unverified"
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-[var(--ide-surface)] text-[var(--ide-text-muted)]"
                          }`} data-testid={`status-integration-${pi.id}`}>
                            {pi.status === "connected" ? (
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            ) : pi.status === "error" ? (
                              <XCircle className="w-2.5 h-2.5" />
                            ) : pi.status === "unverified" ? (
                              <AlertCircle className="w-2.5 h-2.5" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--ide-text-muted)]" />
                            )}
                            {pi.status}
                          </span>
                          <span className="text-[8px] text-[var(--ide-text-muted)]" style={{ color: categoryColors[pi.integration.category] || "#9DA2B0" }}>
                            {pi.integration.category}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          className="p-1 text-[var(--ide-text-muted)] hover:text-[#0079F2]"
                          onClick={() => testMutation.mutate(pi.id)}
                          title="Test connection"
                          disabled={testingId === pi.id}
                          data-testid={`button-test-${pi.id}`}
                        >
                          {testingId === pi.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        </button>
                        <button
                          className="p-1 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                          onClick={() => setExpandedLogId(expandedLogId === pi.id ? null : pi.id)}
                          title="View logs"
                          data-testid={`button-view-logs-${pi.id}`}
                        >
                          {expandedLogId === pi.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </button>
                        <button
                          className="p-1 text-[var(--ide-text-muted)] hover:text-red-400"
                          onClick={() => disconnectMutation.mutate(pi.id)}
                          title="Disconnect"
                          data-testid={`button-disconnect-${pi.id}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {pi.integration.envVarKeys.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1 pl-9">
                        {pi.integration.envVarKeys.map(key => (
                          <span key={key} className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text-muted)] font-mono">{key}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {expandedLogId === pi.id && (
                    <div className="px-3 pb-2">
                      <div className="rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)] p-2 max-h-[120px] overflow-y-auto">
                        {logsQuery.isLoading ? (
                          <div className="flex items-center justify-center py-2">
                            <Loader2 className="w-3 h-3 animate-spin text-[var(--ide-text-muted)]" />
                          </div>
                        ) : logs.length === 0 ? (
                          <p className="text-[9px] text-[var(--ide-text-muted)] text-center py-1">No logs yet</p>
                        ) : (
                          <div className="space-y-0.5">
                            {logs.map(log => (
                              <div key={log.id} className="flex items-start gap-1.5 text-[9px]">
                                <span className={`shrink-0 font-mono ${log.level === "error" ? "text-red-400" : log.level === "warn" ? "text-yellow-400" : "text-[var(--ide-text-muted)]"}`}>[{log.level}]</span>
                                <span className="text-[var(--ide-text-secondary)]">{log.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {accountConnections.length > 0 && (
          <div className="border-b border-[var(--ide-border)]">
            <div className="px-3 py-2">
              <span className="text-[10px] font-bold text-[#7C65CB] uppercase tracking-widest">Account Connections ({accountConnections.length})</span>
            </div>
            <div className="space-y-0.5 pb-2">
              {accountConnections.filter(ac => !connected.some(c => c.integrationId === ac.integrationId)).map((ac) => (
                <div key={ac.id} className="px-3 py-2 hover:bg-[var(--ide-surface)]/30 transition-colors" data-testid={`account-connection-${ac.id}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${categoryColors[ac.integration.category] || "#7C65CB"}15` }}>
                      <IntegrationIcon icon={ac.integration.icon} className="w-3.5 h-3.5" style={{ color: categoryColors[ac.integration.category] || "#7C65CB" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[11px] text-[var(--ide-text)] font-medium truncate">{ac.integration.name}</p>
                        <span className="text-[7px] px-1 py-0.5 rounded bg-[#7C65CB]/15 text-[#7C65CB] font-medium uppercase tracking-wider">Account</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-[#0CCE6B]/15 text-[#0CCE6B]" data-testid={`status-account-${ac.id}`}>
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {ac.status}
                        </span>
                        <span className="text-[8px] text-[var(--ide-text-muted)]" style={{ color: categoryColors[ac.integration.category] || "#9DA2B0" }}>
                          {ac.integration.category}
                        </span>
                      </div>
                    </div>
                    <span className="text-[7px] text-[var(--ide-text-muted)]">All projects</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(showCatalog || connected.length === 0) && (
          <div>
            <div className="px-3 py-2">
              <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Available Integrations</span>
            </div>

            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--ide-text-muted)]" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search integrations..."
                  className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-7 text-[11px] text-[var(--ide-text)] rounded pl-7"
                  data-testid="input-search-integrations"
                />
              </div>
            </div>

            <div className="px-3 pb-2 flex flex-wrap gap-1" data-testid="category-filter-bar">
              <button
                className={`text-[8px] px-2 py-0.5 rounded-full border transition-colors ${
                  !selectedCategory
                    ? "border-[#0079F2] bg-[#0079F2]/15 text-[#0079F2]"
                    : "border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                }`}
                onClick={() => setSelectedCategory(null)}
                data-testid="button-filter-all"
              >
                All
              </button>
              {allCategories.map(cat => (
                <button
                  key={cat}
                  className={`text-[8px] px-2 py-0.5 rounded-full border transition-colors ${
                    selectedCategory === cat
                      ? "bg-opacity-15 border-current"
                      : "border-[var(--ide-border)] hover:text-[var(--ide-text)]"
                  }`}
                  style={{ color: selectedCategory === cat ? (categoryColors[cat] || "#9DA2B0") : undefined }}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  data-testid={`button-filter-${cat.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {catalogQuery.isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" />
              </div>
            ) : Object.keys(groupedCatalog).length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-[10px] text-[var(--ide-text-muted)]">{connectedIds.size > 0 && !searchTerm ? "All integrations connected" : "No matching integrations"}</p>
              </div>
            ) : (
              Object.entries(groupedCatalog).sort(([a], [b]) => {
                const order = ["Google Workspace", "Microsoft 365", "Developer Tools", "Cloud Storage", "Communication", "CRM & Sales", "Payments", "AI & Media", "Productivity", "Database", "Backend Services"];
                const ai = order.indexOf(a);
                const bi = order.indexOf(b);
                return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
              }).map(([category, items]) => (
                <div key={category} className="mb-1">
                  <div className="px-3 py-1 flex items-center gap-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: categoryColors[category] || "#9DA2B0" }}>{category}</span>
                    <span className="text-[8px] text-[var(--ide-text-muted)]">({items.length})</span>
                  </div>
                  {items.map(item => (
                    <div key={item.id}>
                      <button
                        className="w-full px-3 py-2 hover:bg-[var(--ide-surface)]/30 transition-colors text-left flex items-center gap-2"
                        onClick={() => {
                          if (connectingId === item.id) {
                            setConnectingId(null);
                            setConfigValues({});
                          } else {
                            setConnectingId(item.id);
                            setConfigValues({});
                          }
                        }}
                        data-testid={`button-catalog-item-${item.id}`}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${categoryColors[category] || "#0079F2"}15` }}>
                          <IntegrationIcon icon={item.icon} className="w-3.5 h-3.5" style={{ color: categoryColors[category] || "#0079F2" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[11px] text-[var(--ide-text)] font-medium">{item.name}</p>
                            <span className={`text-[7px] px-1 py-0.5 rounded font-medium uppercase tracking-wider ${
                              item.connectorType === "oauth"
                                ? "bg-[#4285F4]/15 text-[#4285F4]"
                                : item.connectorType === "managed"
                                ? "bg-[#0CCE6B]/15 text-[#0CCE6B]"
                                : "bg-[var(--ide-surface)] text-[var(--ide-text-muted)]"
                            }`} data-testid={`badge-type-${item.id}`}>
                              {item.connectorType === "oauth" ? "OAuth" : item.connectorType === "managed" ? "Managed" : "API Key"}
                            </span>
                            {item.connectionLevel === "account" && (
                              <span className="text-[7px] px-1 py-0.5 rounded bg-[#7C65CB]/15 text-[#7C65CB] font-medium uppercase tracking-wider" data-testid={`badge-level-${item.id}`}>
                                Account
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-[var(--ide-text-muted)] truncate">{item.description}</p>
                        </div>
                        {item.connectorType === "oauth" ? (
                          <ExternalLink className="w-3.5 h-3.5 text-[var(--ide-text-muted)] shrink-0" />
                        ) : (
                          <Plus className="w-3.5 h-3.5 text-[var(--ide-text-muted)] shrink-0" />
                        )}
                      </button>

                      {connectingId === item.id && (
                        <div className="px-3 pb-2" data-testid={`connect-form-${item.id}`}>
                          <div className="rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)] p-2.5 space-y-2">
                            {item.connectorType === "oauth" ? (
                              <>
                                <div className="flex items-center gap-2 text-[10px] text-[var(--ide-text-secondary)]">
                                  <Shield className="w-3.5 h-3.5 text-[#4285F4]" />
                                  <span>Sign in with {item.name} to grant access</span>
                                </div>
                                {item.oauthConfig && item.oauthConfig.scopes.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pl-5">
                                    {item.oauthConfig.scopes.map(scope => (
                                      <span key={scope} className="text-[7px] px-1.5 py-0.5 rounded bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[var(--ide-text-muted)] font-mono truncate max-w-[180px]">{scope.split("/").pop() || scope}</span>
                                    ))}
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5 pt-1">
                                  <Button
                                    className="flex-1 h-7 text-[10px] bg-[#4285F4] hover:bg-[#4285F4]/80 text-white rounded font-medium gap-1"
                                    onClick={() => {
                                      oauthStartMutation.mutate(item.id);
                                    }}
                                    disabled={oauthStartMutation.isPending}
                                    data-testid={`button-connect-${item.id}`}
                                  >
                                    {oauthStartMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                                    Connect with OAuth
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="h-7 px-2 text-[10px] text-[var(--ide-text-muted)]"
                                    onClick={() => { setConnectingId(null); setConfigValues({}); }}
                                    data-testid={`button-cancel-connect-${item.id}`}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <>
                                {item.envVarKeys.map(key => (
                                  <div key={key}>
                                    <label className="text-[9px] text-[var(--ide-text-muted)] font-mono block mb-0.5">{key}</label>
                                    <Input
                                      value={configValues[key] || ""}
                                      onChange={(e) => setConfigValues(prev => ({ ...prev, [key]: e.target.value }))}
                                      type="password"
                                      placeholder={`Enter ${key}`}
                                      className="bg-[var(--ide-surface)] border-[var(--ide-border)] h-7 text-[10px] text-[var(--ide-text)] font-mono rounded"
                                      data-testid={`input-config-${key}`}
                                    />
                                  </div>
                                ))}
                                <div className="flex items-center gap-1.5 pt-1">
                                  <Button
                                    className="flex-1 h-7 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/80 text-white rounded font-medium gap-1"
                                    onClick={() => connectMutation.mutate({ integrationId: item.id, config: configValues })}
                                    disabled={connectMutation.isPending}
                                    data-testid={`button-connect-${item.id}`}
                                  >
                                    {connectMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                    Connect & Test
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="h-7 px-2 text-[10px] text-[var(--ide-text-muted)]"
                                    onClick={() => { setConnectingId(null); setConfigValues({}); }}
                                    data-testid={`button-cancel-connect-${item.id}`}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {connected.length === 0 && catalog.length === 0 && !catalogQuery.isLoading && (
          <div className="px-3 py-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] flex items-center justify-center mx-auto mb-3">
              <Puzzle className="w-6 h-6 text-[var(--ide-text-muted)] opacity-40" />
            </div>
            <p className="text-[11px] text-[var(--ide-text-secondary)] font-medium">No Integrations Available</p>
            <p className="text-[10px] text-[var(--ide-text-muted)] mt-1">Integration catalog is being loaded</p>
          </div>
        )}

        <McpServersSection projectId={projectId} />
      </div>
    </div>
  );
}

function McpServersSection({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [mcpName, setMcpName] = useState("");
  const [mcpBaseUrl, setMcpBaseUrl] = useState("");
  const [mcpHeaderKey, setMcpHeaderKey] = useState("");
  const [mcpHeaderValue, setMcpHeaderValue] = useState("");
  const [mcpHeaders, setMcpHeaders] = useState<{ key: string; value: string }[]>([]);
  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [expandedToolsId, setExpandedToolsId] = useState<string | null>(null);
  const [pendingChecked, setPendingChecked] = useState(false);

  React.useEffect(() => {
    if (pendingChecked) return;
    const pending = sessionStorage.getItem("pending_mcp_server");
    if (pending) {
      try {
        const data = JSON.parse(pending);
        if (data.displayName) setMcpName(data.displayName);
        if (data.baseUrl) setMcpBaseUrl(data.baseUrl);
        if (data.headers) {
          const headerEntries = Object.entries(data.headers).map(([key, value]) => ({ key, value: String(value) }));
          setMcpHeaders(headerEntries);
        }
        setShowAddForm(true);
        sessionStorage.removeItem("pending_mcp_server");
      } catch {}
    }
    setPendingChecked(true);
  }, [pendingChecked]);

  const mcpServersQuery = useQuery<McpServer[]>({
    queryKey: ["/api/projects", projectId, "mcp", "servers"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/mcp/servers`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load MCP servers");
      return res.json();
    },
  });

  const mcpToolsQuery = useQuery<McpTool[]>({
    queryKey: ["/api/projects", projectId, "mcp", "servers", expandedToolsId, "tools"],
    queryFn: async () => {
      if (!expandedToolsId) return [];
      const res = await fetch(`/api/projects/${projectId}/mcp/servers/${expandedToolsId}/tools`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load tools");
      return res.json();
    },
    enabled: !!expandedToolsId,
  });

  const [testPassed, setTestPassed] = useState(false);

  const addMcpServer = useMutation({
    mutationFn: async () => {
      if (!testPassed) {
        const headersObj = Object.fromEntries(mcpHeaders.map(h => [h.key, h.value]));
        const testRes = await apiRequest("POST", `/api/projects/${projectId}/mcp/servers/test-remote`, {
          baseUrl: mcpBaseUrl,
          headers: headersObj,
        });
        const testData = await testRes.json();
        if (!testData.success) {
          throw new Error(testData.message || "Connection test failed. Fix the URL or headers and try again.");
        }
      }
      const headersObj = Object.fromEntries(mcpHeaders.map(h => [h.key, h.value]));
      const res = await apiRequest("POST", `/api/projects/${projectId}/mcp/servers`, {
        name: mcpName,
        baseUrl: mcpBaseUrl,
        headers: headersObj,
        serverType: "remote",
      });
      return res.json();
    },
    onSuccess: async (server: McpServer) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "mcp", "servers"] });
      setShowAddForm(false);
      setMcpName("");
      setMcpBaseUrl("");
      setMcpHeaders([]);
      setTestPassed(false);

      try {
        await apiRequest("POST", `/api/projects/${projectId}/mcp/servers/${server.id}/connect`);
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "mcp", "servers"] });
        toast({ title: "MCP server connected", description: "Tools discovered and available" });
      } catch {
        toast({ title: "Server saved but tool discovery failed", description: "You can retry connection later", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Failed to add server", description: err.message, variant: "destructive" });
    },
  });

  const testMcpServer = useMutation({
    mutationFn: async (serverId: string) => {
      setTestingServerId(serverId);
      const res = await apiRequest("POST", `/api/projects/${projectId}/mcp/servers/${serverId}/test`);
      return res.json();
    },
    onSuccess: (data: { success: boolean; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "mcp", "servers"] });
      toast({
        title: data.success ? "Connection verified" : "Connection test failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
      setTestingServerId(null);
    },
    onError: (err: any) => {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
      setTestingServerId(null);
    },
  });

  const testRemoteMcpServer = useMutation({
    mutationFn: async () => {
      setIsTesting(true);
      const headersObj = Object.fromEntries(mcpHeaders.map(h => [h.key, h.value]));
      const res = await apiRequest("POST", `/api/projects/${projectId}/mcp/servers/test-remote`, {
        baseUrl: mcpBaseUrl,
        headers: headersObj,
      });
      return res.json();
    },
    onSuccess: (data: { success: boolean; message: string }) => {
      if (data.success) setTestPassed(true);
      toast({
        title: data.success ? "Connection test passed" : "Connection test failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
      setIsTesting(false);
    },
    onError: (err: any) => {
      setTestPassed(false);
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
      setIsTesting(false);
    },
  });

  const disconnectMcp = useMutation({
    mutationFn: async (serverId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/mcp/servers/${serverId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "mcp", "servers"] });
      toast({ title: "MCP server removed" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to remove", description: err.message, variant: "destructive" });
    },
  });

  const mcpServers = (mcpServersQuery.data || []).filter(s => s.serverType === "remote");
  const mcpTools = mcpToolsQuery.data || [];

  const addMcpHeader = () => {
    if (mcpHeaderKey && mcpHeaderValue) {
      setMcpHeaders(prev => [...prev, { key: mcpHeaderKey, value: mcpHeaderValue }]);
      setMcpHeaderKey("");
      setMcpHeaderValue("");
    }
  };

  return (
    <div className="border-t border-[var(--ide-border)]">
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[#7C65CB]" />
          <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">MCP Servers</span>
          {mcpServers.length > 0 && (
            <span className="text-[8px] text-[var(--ide-text-muted)]">({mcpServers.length})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <a
            href="/mcp-directory"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-[var(--ide-text-muted)] hover:text-[#0079F2]"
            title="Browse MCP Directory"
            data-testid="link-mcp-directory"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            className="p-1 text-[var(--ide-text-muted)] hover:text-[#0CCE6B]"
            onClick={() => setShowAddForm(!showAddForm)}
            title="Add MCP Server"
            data-testid="button-add-mcp-server"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="px-3 pb-2" data-testid="mcp-add-form">
          <div className="rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)] p-2.5 space-y-2">
            <div>
              <label className="text-[9px] text-[var(--ide-text-muted)] block mb-0.5">Display Name</label>
              <Input
                value={mcpName}
                onChange={(e) => setMcpName(e.target.value)}
                placeholder="My MCP Server"
                className="bg-[var(--ide-surface)] border-[var(--ide-border)] h-7 text-[10px] text-[var(--ide-text)] rounded"
                data-testid="input-mcp-name"
              />
            </div>
            <div>
              <label className="text-[9px] text-[var(--ide-text-muted)] block mb-0.5">Base URL (HTTPS)</label>
              <Input
                value={mcpBaseUrl}
                onChange={(e) => { setMcpBaseUrl(e.target.value); setTestPassed(false); }}
                placeholder="https://mcp.example.com/v1/sse"
                className="bg-[var(--ide-surface)] border-[var(--ide-border)] h-7 text-[10px] text-[var(--ide-text)] font-mono rounded"
                data-testid="input-mcp-url"
              />
            </div>
            <div>
              <label className="text-[9px] text-[var(--ide-text-muted)] block mb-0.5">Headers (Optional)</label>
              {mcpHeaders.map((h, i) => (
                <div key={i} className="flex items-center gap-1 mb-1">
                  <span className="text-[8px] font-mono bg-[var(--ide-surface)] border border-[var(--ide-border)] px-1.5 py-0.5 rounded flex-1 truncate">
                    {h.key}
                  </span>
                  <button onClick={() => setMcpHeaders(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-1">
                <Input
                  value={mcpHeaderKey}
                  onChange={(e) => setMcpHeaderKey(e.target.value)}
                  placeholder="X-API-Key"
                  className="bg-[var(--ide-surface)] border-[var(--ide-border)] h-6 text-[9px] rounded flex-1"
                  data-testid="input-mcp-header-key"
                />
                <Input
                  value={mcpHeaderValue}
                  onChange={(e) => setMcpHeaderValue(e.target.value)}
                  placeholder="value"
                  type="password"
                  className="bg-[var(--ide-surface)] border-[var(--ide-border)] h-6 text-[9px] rounded flex-1"
                  data-testid="input-mcp-header-value"
                />
                <button
                  onClick={addMcpHeader}
                  disabled={!mcpHeaderKey || !mcpHeaderValue}
                  className="text-[9px] text-[#0079F2] hover:text-[#0079F2]/80 disabled:opacity-40 px-1"
                  data-testid="button-mcp-add-header"
                >
                  Add
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <Button
                className="h-7 text-[10px] bg-[var(--ide-surface)] hover:bg-[var(--ide-surface)]/80 text-[var(--ide-text)] border border-[var(--ide-border)] rounded font-medium gap-1 px-2"
                onClick={() => testRemoteMcpServer.mutate()}
                disabled={!mcpBaseUrl || !mcpBaseUrl.startsWith("https://") || isTesting}
                data-testid="button-mcp-test"
              >
                {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Test
              </Button>
              <Button
                className="flex-1 h-7 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/80 text-white rounded font-medium gap-1"
                onClick={() => addMcpServer.mutate()}
                disabled={!mcpName || !mcpBaseUrl || !mcpBaseUrl.startsWith("https://") || addMcpServer.isPending}
                data-testid="button-mcp-save"
              >
                {addMcpServer.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Test & Save
              </Button>
              <Button
                variant="ghost"
                className="h-7 px-2 text-[10px] text-[var(--ide-text-muted)]"
                onClick={() => { setShowAddForm(false); setMcpName(""); setMcpBaseUrl(""); setMcpHeaders([]); }}
                data-testid="button-mcp-cancel"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {mcpServers.length > 0 && (
        <div className="space-y-0.5 pb-2">
          {mcpServers.map(server => (
            <div key={server.id} data-testid={`mcp-server-${server.id}`}>
              <div className="px-3 py-2 hover:bg-[var(--ide-surface)]/30 transition-colors group">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[#7C65CB]/15">
                    <Globe className="w-3.5 h-3.5 text-[#7C65CB]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[var(--ide-text)] font-medium truncate" data-testid={`text-mcp-name-${server.id}`}>{server.name}</p>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full ${
                        server.status === "connected"
                          ? "bg-[#0CCE6B]/15 text-[#0CCE6B]"
                          : server.status === "error"
                          ? "bg-red-500/15 text-red-400"
                          : "bg-[var(--ide-surface)] text-[var(--ide-text-muted)]"
                      }`} data-testid={`status-mcp-${server.id}`}>
                        {server.status === "connected" ? (
                          <CheckCircle2 className="w-2.5 h-2.5" />
                        ) : server.status === "error" ? (
                          <XCircle className="w-2.5 h-2.5" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--ide-text-muted)]" />
                        )}
                        {server.status}
                      </span>
                      <span className="text-[8px] text-[var(--ide-text-muted)] font-mono truncate max-w-[120px]">{server.baseUrl}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      className="p-1 text-[var(--ide-text-muted)] hover:text-[#0079F2]"
                      onClick={() => testMcpServer.mutate(server.id)}
                      title="Test connection"
                      disabled={testingServerId === server.id}
                      data-testid={`button-test-mcp-${server.id}`}
                    >
                      {testingServerId === server.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    </button>
                    <button
                      className="p-1 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                      onClick={() => setExpandedToolsId(expandedToolsId === server.id ? null : server.id)}
                      title="View tools"
                      data-testid={`button-tools-mcp-${server.id}`}
                    >
                      {expandedToolsId === server.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                    <button
                      className="p-1 text-[var(--ide-text-muted)] hover:text-red-400"
                      onClick={() => disconnectMcp.mutate(server.id)}
                      title="Disconnect"
                      data-testid={`button-disconnect-mcp-${server.id}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
              {expandedToolsId === server.id && (
                <div className="px-3 pb-2">
                  <div className="rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)] p-2 max-h-[150px] overflow-y-auto">
                    {mcpToolsQuery.isLoading ? (
                      <div className="flex items-center justify-center py-2">
                        <Loader2 className="w-3 h-3 animate-spin text-[var(--ide-text-muted)]" />
                      </div>
                    ) : mcpTools.length === 0 ? (
                      <p className="text-[9px] text-[var(--ide-text-muted)] text-center py-1">No tools discovered yet</p>
                    ) : (
                      <div className="space-y-1">
                        {mcpTools.map(tool => (
                          <div key={tool.id} className="flex items-start gap-1.5 text-[9px]">
                            <Zap className="w-2.5 h-2.5 text-[#7C65CB] shrink-0 mt-0.5" />
                            <div>
                              <span className="font-mono text-[var(--ide-text)]">{tool.name}</span>
                              {tool.description && (
                                <p className="text-[var(--ide-text-muted)] leading-snug">{tool.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {mcpServers.length === 0 && !showAddForm && (
        <div className="px-3 pb-3">
          <div className="rounded-md bg-[var(--ide-bg)]/50 border border-dashed border-[var(--ide-border)] p-3 text-center">
            <Globe className="w-4 h-4 text-[var(--ide-text-muted)] opacity-40 mx-auto mb-1" />
            <p className="text-[9px] text-[var(--ide-text-muted)]">No MCP servers connected</p>
            <button
              className="text-[9px] text-[#0079F2] hover:underline mt-1"
              onClick={() => setShowAddForm(true)}
              data-testid="button-mcp-add-first"
            >
              Add a remote MCP server
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
