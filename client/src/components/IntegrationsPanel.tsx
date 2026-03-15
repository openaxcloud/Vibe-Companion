import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Puzzle, Loader2, Plus, X, Check, Search, ChevronDown, ChevronRight,
  Database, Sparkles, CreditCard, Cloud, Mail, Phone, Flame, Zap, Github, Plug,
} from "lucide-react";

interface CatalogEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  envVarKeys: string[];
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
};

function IntegrationIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = iconMap[icon] || Plug;
  return <Icon className={className} />;
}

const categoryColors: Record<string, string> = {
  "Database": "#0079F2",
  "AI & ML": "#7C65CB",
  "Payments": "#0CCE6B",
  "Developer Tools": "#F26522",
  "Cloud Storage": "#F5A623",
  "Communication": "#E84D8A",
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
      await apiRequest("POST", `/api/projects/${projectId}/integrations`, { integrationId, config });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "integrations"] });
      setConnectingId(null);
      setConfigValues({});
      toast({ title: "Integration connected" });
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

  const catalog = catalogQuery.data || [];
  const connected = integrationsQuery.data || [];
  const connectedIds = new Set(connected.map(c => c.integrationId));
  const logs = logsQuery.data || [];

  const filteredCatalog = catalog.filter(c =>
    !connectedIds.has(c.id) &&
    (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const groupedCatalog = filteredCatalog.reduce<Record<string, CatalogEntry[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full" data-testid="integrations-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Puzzle className="w-3.5 h-3.5 text-[#0079F2]" />
          <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Integrations</span>
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
                        <IntegrationIcon icon={pi.integration.icon} className="w-3.5 h-3.5" style={{ color: categoryColors[pi.integration.category] || "#0079F2" } as any} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-[var(--ide-text)] font-medium truncate">{pi.integration.name}</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full ${
                            pi.status === "connected"
                              ? "bg-[#0CCE6B]/15 text-[#0CCE6B]"
                              : pi.status === "error"
                              ? "bg-red-500/15 text-red-400"
                              : "bg-[var(--ide-surface)] text-[var(--ide-text-muted)]"
                          }`} data-testid={`status-integration-${pi.id}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${pi.status === "connected" ? "bg-[#0CCE6B]" : pi.status === "error" ? "bg-red-400" : "bg-[var(--ide-text-muted)]"}`} />
                            {pi.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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

            {catalogQuery.isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" />
              </div>
            ) : Object.keys(groupedCatalog).length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-[10px] text-[var(--ide-text-muted)]">{connectedIds.size > 0 && !searchTerm ? "All integrations connected" : "No matching integrations"}</p>
              </div>
            ) : (
              Object.entries(groupedCatalog).map(([category, items]) => (
                <div key={category} className="mb-1">
                  <div className="px-3 py-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: categoryColors[category] || "#9DA2B0" }}>{category}</span>
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
                          <IntegrationIcon icon={item.icon} className="w-3.5 h-3.5" style={{ color: categoryColors[category] || "#0079F2" } as any} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-[var(--ide-text)] font-medium">{item.name}</p>
                          <p className="text-[9px] text-[var(--ide-text-muted)] truncate">{item.description}</p>
                        </div>
                        <Plus className="w-3.5 h-3.5 text-[var(--ide-text-muted)] shrink-0" />
                      </button>

                      {connectingId === item.id && (
                        <div className="px-3 pb-2" data-testid={`connect-form-${item.id}`}>
                          <div className="rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)] p-2.5 space-y-2">
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
                                Connect
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
      </div>
    </div>
  );
}
