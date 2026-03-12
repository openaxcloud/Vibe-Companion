import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Moon, Sun, User, Lock, AlertTriangle, Mail, Pencil, Trash2, Eye, EyeOff, Github, Download, CheckCircle, Loader2, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/components/ThemeProvider";

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

export default function Settings() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
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
      a.href = url; a.download = "replit-data-export.json"; a.click();
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
            <h2 className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider px-1">Appearance</h2>
            <div className="rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)]">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--ide-surface)] flex items-center justify-center">
                    {isDark ? <Moon className="w-4 h-4 text-[#0079F2]" /> : <Sun className="w-4 h-4 text-orange-400" />}
                  </div>
                  <div>
                    <span className="text-sm text-[var(--ide-text)] font-medium">Dark Mode</span>
                    <p className="text-[11px] text-[var(--ide-text-muted)]">Toggle between light and dark theme</p>
                  </div>
                </div>
                <Switch checked={isDark} onCheckedChange={setIsDark} data-testid="switch-dark-mode" />
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

          <div className="space-y-3" data-testid="section-billing">
            <h2 className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider px-1">Billing & Plan</h2>
            <div className="rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] divide-y divide-[var(--ide-border)]">
              <div className="flex items-center justify-between p-4">
                <div>
                  <span className="text-sm text-[var(--ide-text)] font-medium">Current Plan</span>
                  <p className="text-[11px] text-[var(--ide-text-muted)]">Free tier</p>
                </div>
                <Link href="/pricing" className="text-xs text-[#0079F2] hover:text-[#0079F2]/80 transition-colors" data-testid="link-upgrade-plan">
                  Upgrade
                </Link>
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
