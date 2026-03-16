import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, Loader2, Plus, Trash2, X, Check, Users, Mail, Clock, Globe, ChevronDown, ChevronRight,
  Image, Type, Ban, Activity,
} from "lucide-react";

interface AuthConfig {
  id?: string;
  projectId?: string;
  enabled: boolean;
  providers: string[];
  requireEmailVerification: boolean;
  sessionDurationHours: number;
  allowedDomains: string[];
  appName: string | null;
  appIconUrl: string | null;
}

interface AuthUser {
  id: string;
  projectId: string;
  email: string;
  provider: string;
  verified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

function GithubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIconSmall() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.51-3.23 0-1.44.62-2.2.44-3.06-.4C3.79 16.17 4.36 9.02 8.93 8.75c1.26.07 2.13.72 2.91.77.99-.2 1.95-.78 3.01-.71 1.28.1 2.24.6 2.87 1.5-2.63 1.57-2.01 5.01.33 5.97-.39 1.05-.9 2.09-1.01 4zm-4.72-15.27c.05 2.07-1.59 3.72-3.55 3.53-.22-1.89 1.64-3.73 3.55-3.53z" />
    </svg>
  );
}

function XIconSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function AuthPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addUserMode, setAddUserMode] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [brandingOpen, setBrandingOpen] = useState(false);
  const [sessionHours, setSessionHours] = useState("24");
  const [domainInput, setDomainInput] = useState("");
  const [appNameInput, setAppNameInput] = useState("");
  const [appIconInput, setAppIconInput] = useState("");

  const configQuery = useQuery<AuthConfig>({
    queryKey: ["/api/projects", projectId, "auth", "config"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/auth/config`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load auth config");
      return res.json();
    },
  });

  const usersQuery = useQuery<AuthUser[]>({
    queryKey: ["/api/projects", projectId, "auth", "users"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/auth/users`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load auth users");
      return res.json();
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (data: Partial<AuthConfig>) => {
      const res = await apiRequest("PUT", `/api/projects/${projectId}/auth/config`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "auth", "config"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update auth config", description: err.message, variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      await apiRequest("POST", `/api/projects/${projectId}/auth/users`, { email, password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "auth", "users"] });
      setNewEmail("");
      setNewPassword("");
      setAddUserMode(false);
      toast({ title: "Auth user added" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add user", description: err.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/auth/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "auth", "users"] });
      toast({ title: "Auth user removed" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to remove user", description: err.message, variant: "destructive" });
    },
  });

  const config = configQuery.data || { enabled: false, providers: ["email"], requireEmailVerification: false, sessionDurationHours: 24, allowedDomains: [], appName: null, appIconUrl: null };
  const authUsers = usersQuery.data || [];

  const toggleProvider = (provider: string) => {
    const current = config.providers || [];
    const updated = current.includes(provider)
      ? current.filter(p => p !== provider)
      : [...current, provider];
    if (updated.length === 0) return;
    updateConfigMutation.mutate({ providers: updated });
  };

  const allProviders = [
    { id: "email", label: "Email / Password", icon: Mail },
    { id: "github", label: "GitHub OAuth", iconComponent: GithubIcon },
    { id: "google", label: "Google OAuth", iconComponent: GoogleIcon },
    { id: "apple", label: "Apple Sign-In", iconComponent: AppleIconSmall },
    { id: "twitter", label: "X (Twitter) OAuth", iconComponent: XIconSmall },
  ];

  return (
    <div className="flex flex-col h-full" data-testid="auth-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0CCE6B]" />
          <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Authentication</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
          onClick={onClose}
          data-testid="button-close-auth"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-3 border-b border-[var(--ide-border)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-[var(--ide-text)]">Enable Authentication</p>
              <p className="text-[9px] text-[var(--ide-text-muted)] mt-0.5">Require login for your deployed app</p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(enabled) => updateConfigMutation.mutate({ enabled })}
              disabled={updateConfigMutation.isPending}
              data-testid="switch-auth-enabled"
            />
          </div>
        </div>

        {config.enabled && (
          <>
            <div className="px-3 py-3 border-b border-[var(--ide-border)]">
              <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Providers</span>
              <div className="mt-2 space-y-1.5">
                {allProviders.map(({ id, label, icon: Icon, iconComponent: IconComponent }) => (
                  <button
                    key={id}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md border transition-colors text-left ${
                      config.providers?.includes(id)
                        ? "border-[#0CCE6B]/40 bg-[#0CCE6B]/5 text-[var(--ide-text)]"
                        : "border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                    }`}
                    onClick={() => toggleProvider(id)}
                    data-testid={`button-toggle-provider-${id}`}
                  >
                    {Icon ? <Icon className="w-3.5 h-3.5 shrink-0" /> : IconComponent ? <IconComponent /> : null}
                    <span className="text-[11px] flex-1">{label}</span>
                    {config.providers?.includes(id) && (
                      <Check className="w-3 h-3 text-[#0CCE6B]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-3 py-3 border-b border-[var(--ide-border)]">
              <button
                className="w-full flex items-center gap-1.5 text-left"
                onClick={() => setBrandingOpen(!brandingOpen)}
                data-testid="button-toggle-branding"
              >
                {brandingOpen ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" />}
                <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Login Page Branding</span>
              </button>

              {brandingOpen && (
                <div className="mt-2 space-y-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Type className="w-3 h-3 text-[var(--ide-text-muted)]" />
                      <span className="text-[11px] text-[var(--ide-text-secondary)]">App Name</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={appNameInput || config.appName || ""}
                        onChange={(e) => setAppNameInput(e.target.value)}
                        placeholder="My App"
                        className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-7 text-[11px] text-[var(--ide-text)] rounded flex-1"
                        data-testid="input-app-name"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] text-[#0079F2] hover:bg-[#0079F2]/10"
                        onClick={() => {
                          updateConfigMutation.mutate({ appName: appNameInput || null });
                        }}
                        data-testid="button-save-app-name"
                      >
                        Save
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Image className="w-3 h-3 text-[var(--ide-text-muted)]" />
                      <span className="text-[11px] text-[var(--ide-text-secondary)]">App Icon URL</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={appIconInput || config.appIconUrl || ""}
                        onChange={(e) => setAppIconInput(e.target.value)}
                        placeholder="https://example.com/icon.png"
                        className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-7 text-[11px] text-[var(--ide-text)] font-mono rounded flex-1"
                        data-testid="input-app-icon-url"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] text-[#0079F2] hover:bg-[#0079F2]/10"
                        onClick={() => {
                          updateConfigMutation.mutate({ appIconUrl: appIconInput || null });
                        }}
                        data-testid="button-save-app-icon"
                      >
                        Save
                      </Button>
                    </div>
                    {(appIconInput || config.appIconUrl) && (
                      <div className="mt-2 flex items-center gap-2">
                        <img
                          src={appIconInput || config.appIconUrl || ""}
                          alt="App icon preview"
                          className="w-8 h-8 rounded object-cover border border-[var(--ide-border)]"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          data-testid="img-app-icon-preview"
                        />
                        <span className="text-[9px] text-[var(--ide-text-muted)]">Preview</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-3 py-3 border-b border-[var(--ide-border)]">
              <button
                className="w-full flex items-center gap-1.5 text-left"
                onClick={() => setSettingsOpen(!settingsOpen)}
                data-testid="button-toggle-auth-settings"
              >
                {settingsOpen ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" />}
                <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Settings</span>
              </button>

              {settingsOpen && (
                <div className="mt-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-[var(--ide-text-muted)]" />
                      <span className="text-[11px] text-[var(--ide-text-secondary)]">Require Email Verification</span>
                    </div>
                    <Switch
                      checked={config.requireEmailVerification}
                      onCheckedChange={(val) => updateConfigMutation.mutate({ requireEmailVerification: val })}
                      data-testid="switch-require-email-verification"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3 h-3 text-[var(--ide-text-muted)]" />
                      <span className="text-[11px] text-[var(--ide-text-secondary)]">Session Duration (hours)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        value={sessionHours}
                        onChange={(e) => setSessionHours(e.target.value)}
                        className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-7 text-[11px] text-[var(--ide-text)] font-mono rounded w-20"
                        min={1}
                        max={720}
                        data-testid="input-session-duration"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] text-[#0079F2] hover:bg-[#0079F2]/10"
                        onClick={() => {
                          const hours = parseInt(sessionHours);
                          if (hours >= 1 && hours <= 720) updateConfigMutation.mutate({ sessionDurationHours: hours });
                        }}
                        data-testid="button-save-session-duration"
                      >
                        Save
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Globe className="w-3 h-3 text-[var(--ide-text-muted)]" />
                      <span className="text-[11px] text-[var(--ide-text-secondary)]">Allowed Domains</span>
                    </div>
                    <div className="space-y-1">
                      {(config.allowedDomains || []).map((domain, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                          <span className="text-[10px] text-[var(--ide-text)] font-mono flex-1">{domain}</span>
                          <button
                            className="text-[var(--ide-text-muted)] hover:text-red-400"
                            onClick={() => updateConfigMutation.mutate({ allowedDomains: config.allowedDomains?.filter((_, idx) => idx !== i) })}
                            data-testid={`button-remove-domain-${i}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center gap-1">
                        <Input
                          value={domainInput}
                          onChange={(e) => setDomainInput(e.target.value)}
                          placeholder="example.com"
                          className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-7 text-[10px] text-[var(--ide-text)] font-mono rounded flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && domainInput.trim()) {
                              updateConfigMutation.mutate({ allowedDomains: [...(config.allowedDomains || []), domainInput.trim()] });
                              setDomainInput("");
                            }
                          }}
                          data-testid="input-allowed-domain"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[10px] text-[#0CCE6B] hover:bg-[#0CCE6B]/10 shrink-0"
                          onClick={() => {
                            if (domainInput.trim()) {
                              updateConfigMutation.mutate({ allowedDomains: [...(config.allowedDomains || []), domainInput.trim()] });
                              setDomainInput("");
                            }
                          }}
                          data-testid="button-add-allowed-domain"
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-3 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                  <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Registered Users</span>
                  <span className="text-[9px] text-[var(--ide-text-muted)] ml-1">({authUsers.length})</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[#0CCE6B] hover:bg-[var(--ide-surface)]"
                  onClick={() => setAddUserMode(true)}
                  data-testid="button-add-auth-user"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>

              {addUserMode && (
                <div className="mb-2 p-2.5 rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)] space-y-2" data-testid="auth-user-add-form">
                  <Input
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@example.com"
                    type="email"
                    className="bg-[var(--ide-surface)] border-[var(--ide-border)] h-7 text-[11px] text-[var(--ide-text)] rounded"
                    autoFocus
                    data-testid="input-auth-user-email"
                  />
                  <Input
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Password (min 6 chars)"
                    type="password"
                    className="bg-[var(--ide-surface)] border-[var(--ide-border)] h-7 text-[11px] text-[var(--ide-text)] rounded"
                    data-testid="input-auth-user-password"
                  />
                  <div className="flex items-center gap-1.5">
                    <Button
                      className="flex-1 h-7 text-[10px] bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] rounded font-medium gap-1"
                      onClick={() => {
                        if (newEmail.trim() && newPassword.trim()) {
                          createUserMutation.mutate({ email: newEmail.trim(), password: newPassword });
                        }
                      }}
                      disabled={!newEmail.trim() || newPassword.length < 6 || createUserMutation.isPending}
                      data-testid="button-save-auth-user"
                    >
                      {createUserMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Add User
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-7 px-2 text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                      onClick={() => { setAddUserMode(false); setNewEmail(""); setNewPassword(""); }}
                      data-testid="button-cancel-auth-user"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {usersQuery.isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" />
                </div>
              ) : authUsers.length === 0 && !addUserMode ? (
                <div className="py-6 text-center">
                  <Users className="w-6 h-6 text-[var(--ide-text-muted)] mx-auto mb-1.5 opacity-40" />
                  <p className="text-[10px] text-[var(--ide-text-muted)]">No registered users yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {authUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--ide-surface)]/40 group" data-testid={`auth-user-${user.id}`}>
                      <div className="w-6 h-6 rounded-full bg-[var(--ide-surface)] flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-[var(--ide-text-muted)]">{user.email[0].toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-[var(--ide-text)] truncate">{user.email}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-[var(--ide-text-muted)]">{user.provider}</span>
                          {user.verified && <span className="text-[8px] px-1 py-0.5 rounded-full bg-[#0CCE6B]/15 text-[#0CCE6B]">verified</span>}
                          {user.lastLoginAt && (
                            <span className="text-[8px] text-[var(--ide-text-muted)] flex items-center gap-0.5">
                              <Activity className="w-2.5 h-2.5" />
                              {new Date(user.lastLoginAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        className="p-1 text-[var(--ide-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteUserMutation.mutate(user.id)}
                        data-testid={`button-delete-auth-user-${user.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {!config.enabled && (
          <div className="px-3 py-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="w-6 h-6 text-[var(--ide-text-muted)] opacity-40" />
            </div>
            <p className="text-[11px] text-[var(--ide-text-secondary)] font-medium">Authentication Disabled</p>
            <p className="text-[10px] text-[var(--ide-text-muted)] mt-1 leading-relaxed max-w-[200px] mx-auto">
              Enable authentication to require users to log in before accessing your deployed application.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
