import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Moon, Sun, User, Lock, AlertTriangle, Mail, Pencil, Trash2, Eye, EyeOff, Github, Download, CheckCircle, Loader2, Shield, Sparkles, Zap, Gauge, Keyboard, Palette, Plus, ExternalLink, Bell } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getCsrfToken } from "@/lib/queryClient";
import { useTheme, BUILTIN_DARK, BUILTIN_LIGHT } from "@/components/ThemeProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import KeyboardShortcutsSettings from "@/components/KeyboardShortcutsSettings";
import { DEFAULT_DARK_GLOBAL_COLORS, DEFAULT_LIGHT_GLOBAL_COLORS, DEFAULT_DARK_SYNTAX_COLORS, DEFAULT_LIGHT_SYNTAX_COLORS } from "@shared/schema";

function UserAvatar({ initials, size = "lg" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "w-8 h-8 text-[10px]",
    md: "w-11 h-11 text-sm",
    lg: "w-20 h-20 text-2xl",
  };
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-[#0079F2] to-[#7C65CB] flex items-center justify-center shrink-0 shadow-lg shadow-[#0079F2]/20`} data-testid="img-avatar">
      <span className="font-bold text-white">{initials}</span>
    </div>
  );
}

function ThemeCard({ name, scheme, isActive, colors, onClick, onEdit, onDelete }: {
  name: string;
  scheme: "dark" | "light";
  isActive: boolean;
  colors: string[];
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={`relative rounded-lg border p-2.5 cursor-pointer transition-all ${isActive ? "border-[#0079F2] bg-[#0079F2]/5" : "border-[var(--ide-border)] hover:border-[var(--ide-text-muted)]"}`}
      onClick={onClick}
      data-testid={`card-theme-${name.toLowerCase().replace(/\s/g, "-")}`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        {colors.slice(0, 6).map((c, i) => (
          <div key={i} className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ background: c }} />
        ))}
      </div>
      <p className="text-[11px] font-medium text-[var(--ide-text)] truncate">{name}</p>
      <div className="flex items-center gap-1 mt-0.5">
        {scheme === "dark" ? <Moon className="w-2.5 h-2.5 text-[var(--ide-text-muted)]" /> : <Sun className="w-2.5 h-2.5 text-[var(--ide-text-muted)]" />}
        <span className="text-[9px] text-[var(--ide-text-muted)]">{scheme}</span>
        {isActive && <span className="text-[9px] text-[#0079F2] ml-auto font-medium">Active</span>}
      </div>
      {(onEdit || onDelete) && (
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100" style={{ opacity: 1 }}>
          {onEdit && (
            <button onClick={e => { e.stopPropagation(); onEdit(); }} className="w-5 h-5 rounded bg-[var(--ide-surface)] flex items-center justify-center hover:bg-[var(--ide-hover)]" data-testid={`button-edit-theme-${name}`}>
              <Pencil className="w-2.5 h-2.5 text-[var(--ide-text-secondary)]" />
            </button>
          )}
          {onDelete && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }} className="w-5 h-5 rounded bg-[var(--ide-surface)] flex items-center justify-center hover:bg-red-500/20" data-testid={`button-delete-theme-${name}`}>
              <Trash2 className="w-2.5 h-2.5 text-red-400" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface NotificationPrefs {
  id: string;
  userId: string;
  agent: boolean;
  billing: boolean;
  deployment: boolean;
  security: boolean;
  team: boolean;
  system: boolean;
}

function KeyboardSettingsSection() {
  const { toast } = useToast();
  const [keyboardMode, setKeyboardModeLocal] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/user/preferences", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(prefs => {
        if (prefs) {
          setKeyboardModeLocal(!!prefs.keyboardMode);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const toggleKeyboardMode = async (enabled: boolean) => {
    setKeyboardModeLocal(enabled);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ keyboardMode: enabled }),
      });
      if (!res.ok) throw new Error("Server error");
      toast({ title: enabled ? "Keyboard Mode enabled" : "Keyboard Mode disabled" });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
      setKeyboardModeLocal(!enabled);
    }
  };

  return (
    <div className="space-y-3" data-testid="section-keyboard-settings">
      <h2 className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider px-1 flex items-center gap-1.5">
        <Keyboard className="w-3 h-3" /> Keyboard Settings
      </h2>
      <div className="rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)]">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--ide-surface)] flex items-center justify-center">
                <Keyboard className="w-4 h-4 text-[#0079F2]" />
              </div>
              <div>
                <span className="text-sm text-[var(--ide-text)] font-medium">Keyboard Mode</span>
                <p className="text-[11px] text-[var(--ide-text-muted)]">
                  Desktop-like layout when an external keyboard is connected to your tablet
                </p>
              </div>
            </div>
            <Switch
              checked={keyboardMode}
              onCheckedChange={toggleKeyboardMode}
              disabled={!loaded}
              data-testid="switch-keyboard-mode"
            />
          </div>
          <div className="mt-3 p-3 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)]">
            <p className="text-[11px] text-[var(--ide-text-muted)] leading-relaxed">
              When enabled and an external keyboard is detected on a tablet, the workspace switches to a desktop-like layout with wider sidebar panels, full toolbar, and keyboard shortcut hints visible in the status bar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#7C65CB",
  openai: "#0CCE6B",
  google: "#4285F4",
  openrouter: "#F59E0B",
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  openrouter: "OpenRouter",
};

function AiUsageSection() {
  const [usageData, setUsageData] = useState<{
    summary: { provider: string; totalInputTokens: number; totalOutputTokens: number; totalCost: number; callCount: number }[];
    byProject: { projectId: string; provider: string; totalCost: number; callCount: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ai/usage?days=30", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setUsageData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const totalCost = usageData?.summary.reduce((sum, s) => sum + s.totalCost, 0) || 0;
  const totalCalls = usageData?.summary.reduce((sum, s) => sum + s.callCount, 0) || 0;

  return (
    <div className="space-y-3" data-testid="section-ai-usage">
      <h2 className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider px-1 flex items-center gap-1.5">
        <Sparkles className="w-3 h-3" /> AI Usage & Costs
      </h2>
      <div className="rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)]">
        {loading ? (
          <div className="p-6 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" />
          </div>
        ) : (
          <div className="divide-y divide-[var(--ide-border)]">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[var(--ide-text)] font-medium">Last 30 Days</span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-[var(--ide-text-muted)]" data-testid="text-ai-total-calls">{totalCalls.toLocaleString()} calls</span>
                  <span className="text-[11px] font-medium text-[var(--ide-text)]" data-testid="text-ai-total-cost">{(totalCost / 100).toFixed(2)} credits</span>
                </div>
              </div>
              {usageData?.summary && usageData.summary.length > 0 ? (
                <div className="space-y-2">
                  {usageData.summary.map(s => {
                    const color = PROVIDER_COLORS[s.provider] || "#888";
                    const pct = totalCost > 0 ? (s.totalCost / totalCost) * 100 : 0;
                    return (
                      <div key={s.provider} data-testid={`ai-usage-provider-${s.provider}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-[11px] text-[var(--ide-text)]">{PROVIDER_LABELS[s.provider] || s.provider}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-[var(--ide-text-muted)]">{s.callCount} calls</span>
                            <span className="text-[10px] text-[var(--ide-text-muted)]">
                              {s.totalInputTokens.toLocaleString()} in / {s.totalOutputTokens.toLocaleString()} out
                            </span>
                            <span className="text-[10px] font-medium text-[var(--ide-text)]">{(s.totalCost / 100).toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--ide-surface)] overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-[var(--ide-text-muted)] text-center py-3">No AI usage recorded yet</p>
              )}
            </div>
            {usageData?.byProject && usageData.byProject.filter(bp => bp.projectId).length > 0 && (
              <div className="p-4">
                <span className="text-[11px] font-medium text-[var(--ide-text-secondary)] mb-2 block">By Project</span>
                <div className="space-y-1.5">
                  {usageData.byProject.filter(bp => bp.projectId).slice(0, 10).map((bp, i) => (
                    <div key={`${bp.projectId}-${bp.provider}-${i}`} className="flex items-center justify-between" data-testid={`ai-usage-project-${bp.projectId}`}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PROVIDER_COLORS[bp.provider] || "#888" }} />
                        <span className="text-[10px] text-[var(--ide-text)] truncate max-w-[120px]">{bp.projectId?.slice(0, 8) || "Unknown"}...</span>
                        <span className="text-[9px] text-[var(--ide-text-muted)]">{PROVIDER_LABELS[bp.provider] || bp.provider}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--ide-text-muted)]">{bp.callCount} calls</span>
                        <span className="text-[10px] font-medium text-[var(--ide-text)]">{(bp.totalCost / 100).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="p-4">
              <span className="text-[11px] font-medium text-[var(--ide-text-secondary)] mb-2 block">Cost per Provider (Public API Prices)</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: "Anthropic (Claude)", rate: "~$3/M input, ~$15/M output" },
                  { name: "OpenAI (GPT-4o)", rate: "~$2.50/M input, ~$10/M output" },
                  { name: "Google (Gemini)", rate: "~$0.075/M input, ~$0.30/M output" },
                  { name: "OpenRouter", rate: "Varies by model" },
                ].map(p => (
                  <div key={p.name} className="p-2 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                    <span className="text-[10px] font-medium text-[var(--ide-text)]">{p.name}</span>
                    <p className="text-[9px] text-[var(--ide-text-muted)]">{p.rate}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const BYOK_SECRET_KEY_MAP: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

function AiCredentialsSection() {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [configs, setConfigs] = useState<{ provider: string; mode: string; hasApiKey: boolean; configured: boolean }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/projects", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const p = Array.isArray(data) ? data : [];
        setProjects(p);
        if (p.length > 0) setSelectedProject(p[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    fetch(`/api/projects/${selectedProject}/ai-credentials`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setConfigs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedProject]);

  const toggleMode = async (provider: string, currentMode: string) => {
    const newMode = currentMode === "managed" ? "byok" : "managed";
    setSaving(provider);
    try {
      const ct = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (ct) headers["X-CSRF-Token"] = ct;
      const res = await fetch(`/api/projects/${selectedProject}/ai-credentials/${provider}`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({ mode: newMode }),
      });
      if (res.ok) {
        setConfigs(prev => prev.map(c => c.provider === provider ? { ...c, mode: newMode } : c));
        toast({ title: `${PROVIDER_LABELS[provider] || provider} switched to ${newMode === "byok" ? "BYOK" : "Managed"}` });
      }
    } catch {}
    setSaving(null);
  };

  const saveByokKey = async (provider: string) => {
    const key = keyInputs[provider]?.trim();
    if (!key || !selectedProject) return;
    setSavingKey(provider);
    try {
      const ct = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (ct) headers["X-CSRF-Token"] = ct;
      const secretKey = BYOK_SECRET_KEY_MAP[provider];
      if (secretKey) {
        await fetch(`/api/projects/${selectedProject}/env-vars`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ key: secretKey, value: key }),
        });
      }
      setConfigs(prev => prev.map(c => c.provider === provider ? { ...c, hasApiKey: true } : c));
      setKeyInputs(prev => ({ ...prev, [provider]: "" }));
      toast({ title: `API key saved for ${PROVIDER_LABELS[provider] || provider}` });
    } catch {}
    setSavingKey(null);
  };

  return (
    <div className="space-y-3" data-testid="section-ai-credentials">
      <h2 className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider px-1 flex items-center gap-1.5">
        <Shield className="w-3 h-3" /> AI Credentials per Project
      </h2>
      <div className="rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)]">
        <div className="p-4">
          <div className="mb-3">
            <Label className="text-[11px] text-[var(--ide-text-muted)] mb-1 block">Select Project</Label>
            <select
              className="w-full text-xs rounded-md border border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text)] px-2 py-1.5"
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              data-testid="select-ai-project"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" />
            </div>
          ) : configs.length === 0 ? (
            <p className="text-[11px] text-[var(--ide-text-muted)] text-center py-3">No credential configs found for this project</p>
          ) : (
            <div className="space-y-2">
              {configs.map(c => (
                <div key={c.provider} className="p-2.5 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)]" data-testid={`ai-cred-${c.provider}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PROVIDER_COLORS[c.provider] || "#888" }} />
                      <span className="text-[11px] font-medium text-[var(--ide-text)]">{PROVIDER_LABELS[c.provider] || c.provider}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${c.mode === "byok" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"}`}>
                        {c.mode === "byok" ? "BYOK" : "Managed"}
                      </span>
                      {c.mode === "byok" && !c.hasApiKey && (
                        <span className="text-[9px] text-red-400">No key set</span>
                      )}
                      {c.mode === "byok" && c.hasApiKey && (
                        <span className="text-[9px] text-green-400">Key configured</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] px-2"
                      disabled={saving === c.provider}
                      onClick={() => toggleMode(c.provider, c.mode)}
                      data-testid={`btn-toggle-${c.provider}`}
                    >
                      {saving === c.provider ? <Loader2 className="w-3 h-3 animate-spin" /> : `Switch to ${c.mode === "managed" ? "BYOK" : "Managed"}`}
                    </Button>
                  </div>
                  {c.mode === "byok" && (
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        type="password"
                        placeholder={`Enter ${PROVIDER_LABELS[c.provider] || c.provider} API key`}
                        className="h-7 text-[11px] flex-1"
                        value={keyInputs[c.provider] || ""}
                        onChange={e => setKeyInputs(prev => ({ ...prev, [c.provider]: e.target.value }))}
                        data-testid={`input-key-${c.provider}`}
                      />
                      <Button
                        size="sm"
                        className="h-7 text-[10px] px-3"
                        disabled={!keyInputs[c.provider]?.trim() || savingKey === c.provider}
                        onClick={() => saveByokKey(c.provider)}
                        data-testid={`btn-save-key-${c.provider}`}
                      >
                        {savingKey === c.provider ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Key"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 p-3 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)]">
            <p className="text-[10px] text-[var(--ide-text-muted)] leading-relaxed">
              <strong>Managed:</strong> Uses platform credits at public API prices. <strong>BYOK:</strong> Bring Your Own Key — set API keys in the AI panel approval dialog or project Secrets. BYOK calls don't use platform credits.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { theme, setTheme, activeTheme, setActiveTheme, toggleTheme, installedThemes, userThemes, refreshThemes } = useTheme();
  const isDark = theme === "dark";
  const setIsDark = (v: boolean) => setTheme(v ? "dark" : "light");

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [email] = useState(user?.email || "");
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState("");

  const initials = user?.displayName?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "??";

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [creditAlertThreshold, setCreditAlertThreshold] = useState(80);

  const usageQuery = useQuery<any>({ queryKey: ["/api/user/usage"], staleTime: 60000 });
  const creditHistoryQuery = useQuery<any>({ queryKey: ["/api/user/credits/history"], staleTime: 60000 });

  const notifPrefsQuery = useQuery<NotificationPrefs>({
    queryKey: ["/api/notification-preferences"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/notification-preferences");
      return res.json();
    },
    staleTime: 60000,
  });

  const updateNotifPrefsMutation = useMutation({
    mutationFn: async (data: Partial<NotificationPrefs>) => {
      await apiRequest("PUT", "/api/notification-preferences", data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notification-preferences"] }),
  });

  useEffect(() => {
    if (usageQuery.data?.creditAlertThreshold) {
      setCreditAlertThreshold(usageQuery.data.creditAlertThreshold);
    }
  }, [usageQuery.data]);

  const saveCreditAlert = async (val: number) => {
    setCreditAlertThreshold(val);
    try {
      await apiRequest("PUT", "/api/user/agent-preferences", { creditAlertThreshold: val });
    } catch {}
  };

  const [billingStatus, setBillingStatus] = useState<{
    plan: string;
    status: string;
    subscription?: {
      productName?: string;
      amount?: number;
      currency?: string;
      interval?: string;
      currentPeriodEnd?: string;
      cancelAtPeriodEnd?: boolean;
    } | null;
    credits?: {
      monthlyIncluded: number;
      monthlyUsed: number;
      remaining: number;
      overageEnabled: boolean;
      overageUsed: number;
      billingCycleStart: string;
    } | null;
  } | null>(null);

  const [billingUsage, setBillingUsage] = useState<{
    breakdown: Record<string, number>;
    monthlyCreditsIncluded: number;
    monthlyCreditsUsed: number;
    remaining: number;
    percentUsed: number;
    overageEnabled: boolean;
    overageCreditsUsed: number;
  } | null>(null);

  const [billingHistory, setBillingHistory] = useState<{
    cycleStart: string;
    cycleEnd: string;
    totalCredits: number;
    breakdown: Record<string, number>;
  }[]>([]);

  const [addingPaymentMethod, setAddingPaymentMethod] = useState(false);

  useEffect(() => {
    fetch("/api/billing/status", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setBillingStatus(data); })
      .catch(() => {});
    fetch("/api/billing/usage", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setBillingUsage(data); })
      .catch(() => {});
    fetch("/api/billing/history", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.history) setBillingHistory(data.history); })
      .catch(() => {});
  }, []);

  const handleAddPaymentMethod = async () => {
    setAddingPaymentMethod(true);
    try {
      const res = await apiRequest("POST", "/api/billing/add-payment-method");
      const data = await res.json();
      if (data.clientSecret) {
        toast({ title: "Payment method setup initiated. Overage billing is now enabled." });
        setBillingStatus(prev => prev ? { ...prev, credits: prev.credits ? { ...prev.credits, overageEnabled: true } : prev.credits } : prev);
      } else {
        toast({ title: data.message || "Unable to set up payment method", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to add payment method", variant: "destructive" });
    } finally {
      setAddingPaymentMethod(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await apiRequest("PUT", "/api/user/profile", { displayName });
      toast({ title: "Profile updated" });
      setIsEditingProfile(false);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setSavingProfile(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    setSavingPassword(true);
    try {
      await apiRequest("PUT", "/api/user/password", { currentPassword, newPassword });
      toast({ title: "Password updated" });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setSavingPassword(false); }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") { toast({ title: "Type DELETE to confirm", variant: "destructive" }); return; }
    setDeletingAccount(true);
    try {
      await apiRequest("DELETE", "/api/user/account", { confirmation: "DELETE MY ACCOUNT" });
      toast({ title: "Account deleted" });
      logout.mutate();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setDeletingAccount(false); }
  };

  const handleExportData = async () => {
    setExportingData(true);
    try {
      const res = await apiRequest("GET", "/api/user/export");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "ecode-data-export.json"; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Data exported" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally { setExportingData(false); }
  };

  const handleSendVerification = async () => {
    setSendingVerification(true);
    try {
      await apiRequest("POST", "/api/auth/send-verification");
      toast({ title: "Verification email sent", description: "Check your inbox to verify your email." });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setSendingVerification(false); }
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)]">
      <div className="flex items-center gap-3 px-4 sm:px-8 py-4 bg-[var(--ide-panel)] border-b border-[var(--ide-border)] shrink-0">
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" onClick={() => setLocation("/dashboard")} data-testid="button-back-settings">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold text-[var(--ide-text)]" data-testid="text-settings-title">Account Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-xl mx-auto space-y-8">

          <div className="space-y-3" data-testid="section-profile">
            <h2 className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider px-1">Profile</h2>
            <div className="rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] p-6">
              <div className="flex items-start gap-5">
                <UserAvatar initials={initials} size="lg" />
                <div className="flex-1 min-w-0 pt-1">
                  {isEditingProfile ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-[var(--ide-text-secondary)]">Display Name</Label>
                        <Input
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 rounded-lg text-[var(--ide-text)] text-sm focus-visible:ring-[#0079F2]/40"
                          data-testid="input-display-name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-[var(--ide-text-secondary)]">Email</Label>
                        <Input
                          value={email}
                          disabled
                          className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 rounded-lg text-[var(--ide-text-muted)] text-sm cursor-not-allowed"
                          data-testid="input-email"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Button size="sm" className="h-8 px-4 bg-[#0079F2] hover:bg-[#0066CC] text-white text-[12px] rounded-lg" onClick={handleSaveProfile} data-testid="button-save-profile">
                          Save Changes
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-4 text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] text-[12px] rounded-lg" onClick={() => { setIsEditingProfile(false); setDisplayName(user?.displayName || ""); }} data-testid="button-cancel-profile">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-[var(--ide-text)]" data-testid="text-display-name">{user?.displayName || "User"}</h3>
                        <button
                          className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[#0079F2] hover:bg-[#0079F2]/10 transition-colors"
                          onClick={() => setIsEditingProfile(true)}
                          data-testid="button-edit-profile"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Mail className="w-3 h-3 text-[var(--ide-text-muted)]" />
                        <p className="text-[12px] text-[var(--ide-text-secondary)]" data-testid="text-email">{user?.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <User className="w-3 h-3 text-[var(--ide-text-muted)]" />
                        <p className="text-[12px] text-[var(--ide-text-muted)]">Member since {new Date().getFullYear()}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-[var(--ide-surface)]/60" />

          <div className="space-y-3" data-testid="section-appearance">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider">Appearance</h2>
              <div className="flex items-center gap-2">
                <Link href="/themes">
                  <button className="flex items-center gap-1 text-[11px] text-[#0079F2] hover:underline" data-testid="link-explore-themes">
                    <ExternalLink className="w-3 h-3" /> Explore
                  </button>
                </Link>
                <Link href="/themes/editor">
                  <button className="flex items-center gap-1 text-[11px] text-[#0079F2] hover:underline" data-testid="link-create-theme">
                    <Plus className="w-3 h-3" /> Create
                  </button>
                </Link>
              </div>
            </div>
            <div className="rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)]">
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[var(--ide-surface)] flex items-center justify-center">
                      <Palette className="w-4 h-4 text-[#0079F2]" />
                    </div>
                    <div>
                      <span className="text-sm text-[var(--ide-text)] font-medium">Active Theme</span>
                      <p className="text-[11px] text-[var(--ide-text-muted)]">{activeTheme.title}</p>
                    </div>
                  </div>
                  <Switch checked={isDark} onCheckedChange={setIsDark} data-testid="switch-dark-mode" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <ThemeCard
                    name="E-Code Dark"
                    scheme="dark"
                    isActive={!activeTheme.id && activeTheme.baseScheme === "dark"}
                    colors={["#0E1525", "#F5F9FC", "#0079F2", "#0CCE6B", "#F44747", "#2B3245"]}
                    onClick={() => setActiveTheme(BUILTIN_DARK)}
                  />
                  <ThemeCard
                    name="E-Code Light"
                    scheme="light"
                    isActive={!activeTheme.id && activeTheme.baseScheme === "light"}
                    colors={["#FFFFFF", "#0F172A", "#0079F2", "#16A34A", "#DC2626", "#D1D5DB"]}
                    onClick={() => setActiveTheme(BUILTIN_LIGHT)}
                  />
                </div>

                {(userThemes.length > 0 || installedThemes.length > 0) && (
                  <div className="border-t border-[var(--ide-border)] pt-3 space-y-2">
                    <p className="text-[11px] text-[var(--ide-text-muted)] font-medium">Your Themes</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[...userThemes, ...installedThemes.filter(it => !userThemes.find(ut => ut.id === it.id))].map(t => (
                        <ThemeCard
                          key={t.id}
                          name={t.title}
                          scheme={t.baseScheme as "dark" | "light"}
                          isActive={activeTheme.id === t.id}
                          colors={[t.globalColors.background, t.globalColors.foreground, t.globalColors.primary, t.globalColors.positive, t.globalColors.negative, t.globalColors.outline]}
                          onClick={() => setActiveTheme({ id: t.id, title: t.title, baseScheme: t.baseScheme as "dark" | "light", globalColors: t.globalColors, syntaxColors: t.syntaxColors })}
                          onEdit={t.userId === user?.id ? () => setLocation(`/themes/editor/${t.id}`) : undefined}
                          onDelete={t.userId === user?.id ? async () => {
                            try {
                              await apiRequest("DELETE", `/api/themes/${t.id}`);
                              refreshThemes();
                              if (activeTheme.id === t.id) {
                                setActiveTheme(BUILTIN_DARK);
                              }
                              toast({ title: "Theme deleted" });
                            } catch (err: any) {
                              toast({ title: "Delete failed", description: err.message, variant: "destructive" });
                            }
                          } : undefined}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="h-px bg-[var(--ide-surface)]/60" />

          <div className="space-y-3" data-testid="section-password">
            <h2 className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider px-1 flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Change Password
            </h2>
            <div className="rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] p-5">
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-[var(--ide-text-secondary)]">Current Password</Label>
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-10 rounded-lg text-[var(--ide-text)] text-sm placeholder:text-[var(--ide-text-muted)] focus-visible:ring-[#0079F2]/40 pr-10"
                      required
                      data-testid="input-current-password"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)]" onClick={() => setShowCurrentPassword(!showCurrentPassword)} data-testid="button-toggle-current-password">
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-[var(--ide-text-secondary)]">New Password</Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-10 rounded-lg text-[var(--ide-text)] text-sm placeholder:text-[var(--ide-text-muted)] focus-visible:ring-[#0079F2]/40 pr-10"
                      required
                      data-testid="input-new-password"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)]" onClick={() => setShowNewPassword(!showNewPassword)} data-testid="button-toggle-new-password">
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-[var(--ide-text-secondary)]">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-10 rounded-lg text-[var(--ide-text)] text-sm placeholder:text-[var(--ide-text-muted)] focus-visible:ring-[#0079F2]/40 pr-10"
                      required
                      data-testid="input-confirm-password"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)]" onClick={() => setShowConfirmPassword(!showConfirmPassword)} data-testid="button-toggle-confirm-password">
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="h-9 px-5 bg-[#0079F2] hover:bg-[#0066CC] text-white text-[12px] rounded-lg font-medium" data-testid="button-change-password">
                  Update Password
                </Button>
              </form>
            </div>
          </div>

          <div className="h-px bg-[var(--ide-surface)]/60" />

          <div className="space-y-3" data-testid="section-connected">
            <h2 className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider px-1 flex items-center gap-1.5">
              <Shield className="w-3 h-3" /> Connected Accounts & Data
            </h2>
            <div className="rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] divide-y divide-[var(--ide-border)]">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--ide-surface)] flex items-center justify-center">
                    <Mail className="w-4 h-4 text-[#0079F2]" />
                  </div>
                  <div>
                    <span className="text-sm text-[var(--ide-text)] font-medium">Email Verification</span>
                    <p className="text-[11px] text-[var(--ide-text-muted)]">
                      {(user as any)?.emailVerified ? "Your email is verified" : "Verify your email address"}
                    </p>
                  </div>
                </div>
                {(user as any)?.emailVerified ? (
                  <span className="flex items-center gap-1 text-xs text-[#0CCE6B]" data-testid="text-email-verified"><CheckCircle className="w-3.5 h-3.5" /> Verified</span>
                ) : (
                  <Button size="sm" onClick={handleSendVerification} disabled={sendingVerification}
                    className="h-8 px-4 bg-[#0079F2] hover:bg-[#0066CC] text-white text-[12px] rounded-lg" data-testid="button-verify-email">
                    {sendingVerification ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Send Verification"}
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--ide-surface)] flex items-center justify-center">
                    <Github className="w-4 h-4 text-[var(--ide-text)]" />
                  </div>
                  <div>
                    <span className="text-sm text-[var(--ide-text)] font-medium">GitHub</span>
                    <p className="text-[11px] text-[var(--ide-text-muted)]">
                      {(user as any)?.githubId ? "Connected" : "Connect your GitHub account"}
                    </p>
                  </div>
                </div>
                {(user as any)?.githubId ? (
                  <span className="flex items-center gap-1 text-xs text-[#0CCE6B]" data-testid="text-github-connected"><CheckCircle className="w-3.5 h-3.5" /> Connected</span>
                ) : (
                  <span className="text-xs text-[var(--ide-text-muted)]" data-testid="text-github-not-connected">Not connected</span>
                )}
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--ide-surface)] flex items-center justify-center">
                    <Download className="w-4 h-4 text-[#0CCE6B]" />
                  </div>
                  <div>
                    <span className="text-sm text-[var(--ide-text)] font-medium">Export Your Data</span>
                    <p className="text-[11px] text-[var(--ide-text-muted)]">Download all your projects and data (GDPR)</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={handleExportData} disabled={exportingData}
                  className="h-8 px-4 border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] text-[12px] rounded-lg" data-testid="button-export-data">
                  {exportingData ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Export JSON"}
                </Button>
              </div>
            </div>
          </div>

          <div className="h-px bg-[var(--ide-surface)]/60" />

          <div className="space-y-3" data-testid="section-credits">
            <h2 className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider px-1 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Credits & Usage
            </h2>
            <div className="rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] divide-y divide-[var(--ide-border)]">
              {usageQuery.data && (
                <>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-[var(--ide-text)] font-medium">Daily Credits</span>
                      <span className="text-sm font-semibold text-[#0079F2]" data-testid="text-credits-balance">
                        {usageQuery.data.daily?.credits?.used || 0} / {usageQuery.data.daily?.credits?.limit || 100}
                      </span>
                    </div>
                    <div className="relative w-full h-3 rounded-full bg-[var(--ide-surface)] overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#0CCE6B] via-[#0079F2] to-[#7C65CB] transition-all"
                        style={{ width: `${Math.min(100, ((usageQuery.data.daily?.credits?.used || 0) / (usageQuery.data.daily?.credits?.limit || 100)) * 100)}%` }}
                        data-testid="progress-credits"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[var(--ide-text-muted)]">
                      <span>Resets {usageQuery.data.resetsAt ? new Date(usageQuery.data.resetsAt).toLocaleTimeString() : "daily"}</span>
                      <span className="capitalize">{usageQuery.data.plan} plan</span>
                    </div>
                  </div>

                  <div className="p-4">
                    <span className="text-[11px] font-medium text-[var(--ide-text-secondary)] mb-3 block">7-Day Usage</span>
                    {creditHistoryQuery.data?.days && (
                      <div className="flex items-end gap-1.5 h-20" data-testid="chart-credit-history">
                        {creditHistoryQuery.data.days.map((day: any, i: number) => {
                          const maxVal = Math.max(...creditHistoryQuery.data.days.map((d: any) => d.total), 1);
                          const h = Math.max(4, (day.total / maxVal) * 100);
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <div className="w-full flex flex-col justify-end" style={{ height: "60px" }}>
                                {day.turbo > 0 && (
                                  <div className="w-full rounded-t bg-[#F59E0B]" style={{ height: `${(day.turbo / maxVal) * 60}px` }} />
                                )}
                                {day.power > 0 && (
                                  <div className={`w-full bg-[#0079F2] ${day.turbo === 0 ? "rounded-t" : ""}`} style={{ height: `${(day.power / maxVal) * 60}px` }} />
                                )}
                                {day.economy > 0 && (
                                  <div className={`w-full bg-[#0CCE6B] ${day.power === 0 && day.turbo === 0 ? "rounded-t" : ""} rounded-b`} style={{ height: `${(day.economy / maxVal) * 60}px` }} />
                                )}
                                {day.total === 0 && (
                                  <div className="w-full rounded bg-[var(--ide-surface)]" style={{ height: "4px" }} />
                                )}
                              </div>
                              <span className="text-[8px] text-[var(--ide-text-muted)]">
                                {new Date(day.date).toLocaleDateString("en", { weekday: "short" }).slice(0, 2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[9px] text-[var(--ide-text-muted)]">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#0CCE6B]" /> Economy</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#0079F2]" /> Power</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> Turbo</span>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium text-[var(--ide-text-secondary)]">Credit Alert Threshold</span>
                      <span className="text-[11px] text-[var(--ide-text-muted)]">{creditAlertThreshold}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      value={creditAlertThreshold}
                      onChange={(e) => saveCreditAlert(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none bg-[var(--ide-surface)] cursor-pointer accent-[#0079F2]"
                      data-testid="slider-credit-alert"
                    />
                    <p className="text-[9px] text-[var(--ide-text-muted)] mt-1">Alert when credit usage reaches this percentage</p>
                  </div>

                  <div className="p-4">
                    <span className="text-[11px] font-medium text-[var(--ide-text-secondary)] mb-2 block">Cost per Mode</span>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#0CCE6B] flex items-center gap-1"><Gauge className="w-3 h-3" /> Economy</span>
                        <span className="text-[var(--ide-text-muted)]">1 credit / call</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#0079F2] flex items-center gap-1"><Zap className="w-3 h-3" /> Power</span>
                        <span className="text-[var(--ide-text-muted)]">3 credits / call</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#F59E0B] flex items-center gap-1"><Sparkles className="w-3 h-3" /> Turbo</span>
                        <span className="text-[var(--ide-text-muted)]">6 credits / call</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="h-px bg-[var(--ide-surface)]/60" />

          <AiUsageSection />

          <div className="h-px bg-[var(--ide-surface)]/60" />

          <AiCredentialsSection />

          <div className="h-px bg-[var(--ide-surface)]/60" />

          <div className="space-y-3" data-testid="section-billing">
            <h2 className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider px-1">Billing & Plan</h2>
            <div className="rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] divide-y divide-[var(--ide-border)]">
              <div className="flex items-center justify-between p-4">
                <div>
                  <span className="text-sm text-[var(--ide-text)] font-medium" data-testid="text-current-plan">Current Plan</span>
                  <p className="text-[11px] text-[var(--ide-text-muted)]" data-testid="text-plan-name">
                    {billingStatus?.subscription?.productName || (billingStatus?.plan ? billingStatus.plan.charAt(0).toUpperCase() + billingStatus.plan.slice(1) : "Free")} tier
                  </p>
                  {billingStatus?.subscription && (
                    <div className="mt-1 space-y-0.5">
                      {billingStatus.subscription.amount && (
                        <p className="text-[11px] text-[var(--ide-text-muted)]" data-testid="text-plan-amount">
                          ${(billingStatus.subscription.amount / 100).toFixed(2)}/{billingStatus.subscription.interval || "month"}
                        </p>
                      )}
                      {billingStatus.subscription.currentPeriodEnd && (
                        <p className="text-[11px] text-[var(--ide-text-muted)]" data-testid="text-plan-renewal">
                          {billingStatus.subscription.cancelAtPeriodEnd ? "Expires" : "Renews"}: {new Date(billingStatus.subscription.currentPeriodEnd).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <Link href="/pricing" className="text-xs text-[#0079F2] hover:text-[#0079F2]/80 transition-colors" data-testid="link-upgrade-plan">
                  {billingStatus?.status === "active" ? "Change Plan" : "Upgrade"}
                </Link>
              </div>

              {billingStatus?.credits && billingStatus.credits.monthlyIncluded > 0 && (
                <div className="p-4" data-testid="section-monthly-credits">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-[var(--ide-text)] font-medium">Monthly Credits</span>
                    <span className="text-sm font-semibold text-[#0079F2]" data-testid="text-monthly-credits-balance">
                      {billingStatus.credits.remaining} / {billingStatus.credits.monthlyIncluded}
                    </span>
                  </div>
                  <div className="relative w-full h-3 rounded-full bg-[var(--ide-surface)] overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all ${
                        billingStatus.credits.remaining <= billingStatus.credits.monthlyIncluded * 0.2
                          ? "bg-gradient-to-r from-red-500 to-orange-500"
                          : "bg-gradient-to-r from-[#0CCE6B] via-[#0079F2] to-[#7C65CB]"
                      }`}
                      style={{ width: `${Math.min(100, (billingStatus.credits.monthlyUsed / billingStatus.credits.monthlyIncluded) * 100)}%` }}
                      data-testid="progress-monthly-credits"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[var(--ide-text-muted)]">
                    <span>Cycle started {new Date(billingStatus.credits.billingCycleStart).toLocaleDateString()}</span>
                    {billingStatus.credits.overageEnabled && (
                      <span className="text-[#0CCE6B]">Overage enabled</span>
                    )}
                  </div>
                  {billingStatus.credits.overageUsed > 0 && (
                    <div className="mt-2 text-[10px] text-orange-400">
                      Overage: {billingStatus.credits.overageUsed} credits used beyond included allowance
                    </div>
                  )}
                </div>
              )}

              {billingUsage && (
                <div className="p-4" data-testid="section-usage-breakdown">
                  <span className="text-[11px] font-medium text-[var(--ide-text-secondary)] mb-3 block">Usage Breakdown (This Cycle)</span>
                  <div className="space-y-2">
                    {Object.entries(billingUsage.breakdown).length > 0 ? (
                      Object.entries(billingUsage.breakdown).map(([type, amount]) => (
                        <div key={type} className="flex items-center justify-between text-[11px]">
                          <span className="text-[var(--ide-text-secondary)] capitalize flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${
                              type === "ai_call" ? "bg-[#7C65CB]" :
                              type === "code_execution" ? "bg-[#0079F2]" :
                              type === "deployment" ? "bg-[#0CCE6B]" :
                              "bg-[var(--ide-text-muted)]"
                            }`} />
                            {type.replace(/_/g, " ")}
                          </span>
                          <span className="text-[var(--ide-text-muted)] font-medium">{amount} credits</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-[var(--ide-text-muted)]">No usage recorded this cycle</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-4">
                <div>
                  <span className="text-sm text-[var(--ide-text)] font-medium">Overage Billing</span>
                  <p className="text-[11px] text-[var(--ide-text-muted)]">
                    {billingStatus?.credits?.overageEnabled
                      ? "Payment method on file — overage charges apply"
                      : "Add a payment method to continue using credits beyond your allowance"}
                  </p>
                </div>
                {!billingStatus?.credits?.overageEnabled && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-4 border-[var(--ide-border)] text-[#0079F2] hover:text-[#0079F2]/80 text-[12px] rounded-lg"
                    onClick={handleAddPaymentMethod}
                    disabled={addingPaymentMethod}
                    data-testid="button-add-payment-method"
                  >
                    {addingPaymentMethod ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add Payment Method"}
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between p-4">
                <div>
                  <span className="text-sm text-[var(--ide-text)] font-medium">Manage Billing</span>
                  <p className="text-[11px] text-[var(--ide-text-muted)]">View invoices and update payment method</p>
                </div>
                <Button size="sm" variant="outline" className="h-8 px-4 border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] text-[12px] rounded-lg"
                  onClick={async () => {
                    try {
                      const res = await apiRequest("POST", "/api/billing/portal");
                      const data = await res.json();
                      if (data.url) window.location.href = data.url;
                      else toast({ title: data.message || "Billing portal unavailable" });
                    } catch { toast({ title: "Failed to open billing portal", variant: "destructive" }); }
                  }}
                  data-testid="button-manage-billing"
                >
                  Open Portal
                </Button>
              </div>

              {billingHistory.length > 0 && (
                <div className="p-4" data-testid="section-billing-history">
                  <span className="text-[11px] font-medium text-[var(--ide-text-secondary)] mb-3 block">Billing History</span>
                  <div className="space-y-2">
                    {billingHistory.map((cycle, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] py-1.5 border-b border-[var(--ide-border)]/40 last:border-0">
                        <div>
                          <span className="text-[var(--ide-text-secondary)]">
                            {new Date(cycle.cycleStart).toLocaleDateString()} — {new Date(cycle.cycleEnd).toLocaleDateString()}
                          </span>
                          <div className="flex gap-2 mt-0.5">
                            {Object.entries(cycle.breakdown).map(([type, amount]) => (
                              <span key={type} className="text-[9px] text-[var(--ide-text-muted)] capitalize">
                                {type.replace(/_/g, " ")}: {amount}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className="text-[var(--ide-text)] font-medium">{cycle.totalCredits} credits</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-[var(--ide-surface)]/60" />

          <div className="space-y-3" data-testid="section-signout">
            <h2 className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider px-1">Session</h2>
            <div className="rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)]">
              <div className="flex items-center justify-between p-4">
                <div>
                  <span className="text-sm text-[var(--ide-text)] font-medium">Sign Out</span>
                  <p className="text-[11px] text-[var(--ide-text-muted)]">Sign out of your account on this device</p>
                </div>
                <Button variant="outline" size="sm" className="h-8 px-4 border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] text-[12px] rounded-lg" onClick={() => logout.mutate()} data-testid="button-signout">
                  Sign Out
                </Button>
              </div>
            </div>
          </div>

          <div className="h-px bg-[var(--ide-surface)]/60" />

          <KeyboardSettingsSection />

          <div className="h-px bg-[var(--ide-surface)]/60" />

          <KeyboardShortcutsSettings />

          <div className="h-px bg-[var(--ide-surface)]/60" />

          <div className="space-y-3" data-testid="section-notifications">
            <h2 className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider px-1 flex items-center gap-1.5">
              <Bell className="w-3 h-3" /> Notification Preferences
            </h2>
            <div className="rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] divide-y divide-[var(--ide-border)]">
              {([
                { key: "agent" as const, label: "Agent", desc: "Agent needs help or finished working" },
                { key: "billing" as const, label: "Billing", desc: "Plan changes, quota warnings, payment updates" },
                { key: "deployment" as const, label: "Deployments", desc: "Deployment status changes" },
                { key: "security" as const, label: "Security", desc: "Security scan results and alerts" },
                { key: "team" as const, label: "Team", desc: "Team invitations and member changes" },
                { key: "system" as const, label: "System", desc: "System updates and maintenance notices" },
              ]).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-4">
                  <div>
                    <span className="text-sm text-[var(--ide-text)] font-medium">{label}</span>
                    <p className="text-[11px] text-[var(--ide-text-muted)]">{desc}</p>
                  </div>
                  <Switch
                    checked={notifPrefsQuery.data?.[key] ?? true}
                    onCheckedChange={(checked) => updateNotifPrefsMutation.mutate({ [key]: checked })}
                    data-testid={`switch-notif-${key}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-[var(--ide-surface)]/60" />

          <div className="space-y-3" data-testid="section-danger-zone">
            <h2 className="text-[11px] font-semibold text-red-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" /> Danger Zone
            </h2>
            <div className="rounded-xl bg-[var(--ide-panel)] border border-red-500/20 p-5">
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-[var(--ide-text)]">Delete Account</h3>
                  <p className="text-[12px] text-[var(--ide-text-muted)] mt-1 leading-relaxed">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-[var(--ide-text-secondary)]">Type <span className="text-red-400 font-mono font-bold">DELETE</span> to confirm</Label>
                  <Input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 rounded-lg text-[var(--ide-text)] text-sm placeholder:text-[var(--ide-text-muted)] focus-visible:ring-red-500/40 max-w-[200px] font-mono"
                    data-testid="input-delete-confirm"
                  />
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-9 px-5 bg-red-600 hover:bg-red-700 text-white text-[12px] rounded-lg font-medium gap-1.5"
                  disabled={deleteConfirm !== "DELETE"}
                  onClick={handleDeleteAccount}
                  data-testid="button-delete-account"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Account
                </Button>
              </div>
            </div>
          </div>

          <div className="text-center pt-4 pb-8">
            <p className="text-[11px] text-[var(--ide-text-muted)]" data-testid="text-version">E-Code v1.0.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
