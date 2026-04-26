import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Settings2, CheckCircle2, XCircle, Loader2, Globe, Zap, Server,
  ChevronDown, ChevronRight, RefreshCw
} from "lucide-react";
import { getCsrfToken } from "@/lib/queryClient";

export type AgentProvider = "builtin" | "openhands" | "goose";

interface ProviderStatus {
  configured: boolean;
  healthy: boolean | null;
  version?: string;
  error?: string;
  checking: boolean;
}

interface AgentProviderSettingsProps {
  currentProvider: AgentProvider;
  onProviderChange: (provider: AgentProvider) => void;
  compact?: boolean;
}

const PROVIDER_INFO: Record<AgentProvider, { name: string; description: string; icon: typeof Zap }> = {
  builtin: {
    name: "E-Code AI",
    description: "Built-in GPT-4 / Claude agent with MCP tools",
    icon: Zap,
  },
  openhands: {
    name: "OpenHands",
    description: "Autonomous AI engineer (MIT, 70k+ stars)",
    icon: Globe,
  },
  goose: {
    name: "Goose",
    description: "AI agent by Block / Linux Foundation (Apache 2.0)",
    icon: Server,
  },
};

export default function AgentProviderSettings({
  currentProvider,
  onProviderChange,
  compact = false,
}: AgentProviderSettingsProps) {
  const [expanded, setExpanded] = useState(false);
  const [statuses, setStatuses] = useState<Record<AgentProvider, ProviderStatus>>({
    builtin: { configured: true, healthy: true, checking: false },
    openhands: { configured: false, healthy: null, checking: false },
    goose: { configured: false, healthy: null, checking: false },
  });
  const [configuring, setConfiguring] = useState<AgentProvider | null>(null);
  const [configForm, setConfigForm] = useState({ serverUrl: "", apiKey: "", model: "" });

  const checkHealth = useCallback(async (provider: AgentProvider) => {
    if (provider === "builtin") return;

    setStatuses((s) => ({
      ...s,
      [provider]: { ...s[provider], checking: true },
    }));

    try {
      const endpoint = provider === "openhands" ? "/api/openhands" : "/api/goose";
      const [configRes, healthRes] = await Promise.all([
        fetch(`${endpoint}/config`, { credentials: "include" }),
        fetch(`${endpoint}/health`, { credentials: "include" }),
      ]);

      const config = await configRes.json().catch(() => ({}));
      const health = await healthRes.json().catch(() => ({ ok: false }));

      setStatuses((s) => ({
        ...s,
        [provider]: {
          configured: config.configured || false,
          healthy: health.ok || false,
          version: health.version,
          error: health.error,
          checking: false,
        },
      }));
    } catch (err: any) {
      setStatuses((s) => ({
        ...s,
        [provider]: { configured: false, healthy: false, error: err.message, checking: false },
      }));
    }
  }, []);

  useEffect(() => {
    checkHealth("openhands");
    checkHealth("goose");
  }, [checkHealth]);

  const saveConfig = async (provider: AgentProvider) => {
    const endpoint = provider === "openhands" ? "/api/openhands" : "/api/goose";
    try {
      const res = await fetch(`${endpoint}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify(configForm),
      });
      if (res.ok) {
        setConfiguring(null);
        await checkHealth(provider);
      }
    } catch {}
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5" data-testid="agent-provider-compact">
        {(Object.keys(PROVIDER_INFO) as AgentProvider[]).map((p) => {
          const info = PROVIDER_INFO[p];
          const Icon = info.icon;
          const status = statuses[p];
          const isActive = currentProvider === p;
          const isAvailable = p === "builtin" || (status.configured && status.healthy);

          return (
            <button
              key={p}
              onClick={() => isAvailable && onProviderChange(p)}
              disabled={!isAvailable}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : isAvailable
                    ? "bg-[var(--ide-bg-secondary)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text-primary)]"
                    : "bg-[var(--ide-bg-secondary)] text-[var(--ide-text-muted)] opacity-50 cursor-not-allowed"
              }`}
              data-testid={`agent-provider-btn-${p}`}
            >
              <Icon size={12} />
              <span>{info.name}</span>
              {p !== "builtin" && status.healthy === true && (
                <CheckCircle2 size={10} className="text-green-400" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="border border-[var(--ide-border)] rounded-lg bg-[var(--ide-bg-secondary)]" data-testid="agent-provider-settings">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--ide-text-primary)] hover:bg-[var(--ide-bg-tertiary)] transition-colors"
        data-testid="agent-provider-toggle"
      >
        <Settings2 size={14} />
        <span>AI Agent Provider</span>
        <span className="ml-auto text-[var(--ide-text-muted)]">{PROVIDER_INFO[currentProvider].name}</span>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {(Object.keys(PROVIDER_INFO) as AgentProvider[]).map((p) => {
            const info = PROVIDER_INFO[p];
            const Icon = info.icon;
            const status = statuses[p];
            const isActive = currentProvider === p;

            return (
              <div key={p} className={`rounded-md border p-2 ${isActive ? "border-blue-500 bg-blue-500/10" : "border-[var(--ide-border)]"}`}>
                <div className="flex items-center gap-2">
                  <Icon size={16} className={isActive ? "text-blue-400" : "text-[var(--ide-text-muted)]"} />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-[var(--ide-text-primary)]">{info.name}</div>
                    <div className="text-[10px] text-[var(--ide-text-muted)]">{info.description}</div>
                  </div>

                  {p !== "builtin" && (
                    <div className="flex items-center gap-1">
                      {status.checking ? (
                        <Loader2 size={12} className="animate-spin text-[var(--ide-text-muted)]" />
                      ) : status.healthy === true ? (
                        <CheckCircle2 size={12} className="text-green-400" />
                      ) : status.healthy === false ? (
                        <XCircle size={12} className="text-red-400" />
                      ) : null}
                      <button
                        onClick={() => checkHealth(p)}
                        className="p-0.5 hover:bg-[var(--ide-bg-tertiary)] rounded"
                        data-testid={`agent-health-check-${p}`}
                      >
                        <RefreshCw size={10} className="text-[var(--ide-text-muted)]" />
                      </button>
                    </div>
                  )}

                  {p === "builtin" || (status.configured && status.healthy) ? (
                    <Button
                      size="sm"
                      variant={isActive ? "default" : "outline"}
                      onClick={() => onProviderChange(p)}
                      className="text-[10px] h-6 px-2"
                      data-testid={`agent-select-${p}`}
                    >
                      {isActive ? "Active" : "Use"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setConfiguring(p);
                        setConfigForm({ serverUrl: "", apiKey: "", model: "" });
                      }}
                      className="text-[10px] h-6 px-2"
                      data-testid={`agent-configure-${p}`}
                    >
                      Configure
                    </Button>
                  )}
                </div>

                {status.version && (
                  <div className="text-[10px] text-[var(--ide-text-muted)] mt-1 ml-6">v{status.version}</div>
                )}
                {status.error && (
                  <div className="text-[10px] text-red-400 mt-1 ml-6">{status.error}</div>
                )}

                {configuring === p && (
                  <div className="mt-2 space-y-1.5 ml-6">
                    <input
                      type="url"
                      placeholder={p === "openhands" ? "https://your-openhands-server:3000" : "https://your-goose-server:8080"}
                      value={configForm.serverUrl}
                      onChange={(e) => setConfigForm({ ...configForm, serverUrl: e.target.value })}
                      className="w-full bg-[var(--ide-bg-primary)] border border-[var(--ide-border)] rounded px-2 py-1 text-xs text-[var(--ide-text-primary)]"
                      data-testid={`agent-config-url-${p}`}
                    />
                    <input
                      type="password"
                      placeholder="API Key (optional)"
                      value={configForm.apiKey}
                      onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                      className="w-full bg-[var(--ide-bg-primary)] border border-[var(--ide-border)] rounded px-2 py-1 text-xs text-[var(--ide-text-primary)]"
                      data-testid={`agent-config-key-${p}`}
                    />
                    <input
                      type="text"
                      placeholder="Model (default: claude-sonnet-4-6)"
                      value={configForm.model}
                      onChange={(e) => setConfigForm({ ...configForm, model: e.target.value })}
                      className="w-full bg-[var(--ide-bg-primary)] border border-[var(--ide-border)] rounded px-2 py-1 text-xs text-[var(--ide-text-primary)]"
                      data-testid={`agent-config-model-${p}`}
                    />
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => saveConfig(p)} className="text-[10px] h-6 px-2" data-testid={`agent-config-save-${p}`}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setConfiguring(null)} className="text-[10px] h-6 px-2">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
