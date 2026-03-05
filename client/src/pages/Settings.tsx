import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Moon, Sun, User, Lock, AlertTriangle, Mail, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

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
  const [isDark, setIsDark] = useState(true);

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

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) { root.classList.add("dark"); localStorage.setItem("theme", "dark"); }
    else { root.classList.remove("dark"); localStorage.setItem("theme", "light"); }
  }, [isDark]);

  useEffect(() => { setIsDark(document.documentElement.classList.contains("dark")); }, []);

  const initials = user?.displayName?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "??";

  const handleSaveProfile = () => {
    toast({ title: "Profile updated", description: "Your display name has been saved." });
    setIsEditingProfile(false);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "New password and confirmation must match.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    toast({ title: "Password changed", description: "Your password has been updated successfully." });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleDeleteAccount = () => {
    if (deleteConfirm !== "DELETE") {
      toast({ title: "Confirmation required", description: "Type DELETE to confirm account deletion.", variant: "destructive" });
      return;
    }
    toast({ title: "Account deleted", description: "Your account has been permanently deleted.", variant: "destructive" });
    logout.mutate();
  };

  return (
    <div className="h-screen flex flex-col bg-[#0E1525] text-[#F5F9FC]">
      <div className="flex items-center gap-3 px-4 sm:px-8 py-4 bg-[#1C2333] border-b border-[#2B3245] shrink-0">
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245]" onClick={() => setLocation("/dashboard")} data-testid="button-back-settings">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold text-[#F5F9FC]" data-testid="text-settings-title">Account Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-xl mx-auto space-y-8">

          <div className="space-y-3" data-testid="section-profile">
            <h2 className="text-[11px] font-semibold text-[#9DA2B0] uppercase tracking-wider px-1">Profile</h2>
            <div className="rounded-xl bg-[#1C2333] border border-[#2B3245] p-6">
              <div className="flex items-start gap-5">
                <UserAvatar initials={initials} size="lg" />
                <div className="flex-1 min-w-0 pt-1">
                  {isEditingProfile ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-[#9DA2B0]">Display Name</Label>
                        <Input
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="bg-[#0E1525] border-[#2B3245] h-9 rounded-lg text-[#F5F9FC] text-sm focus-visible:ring-[#0079F2]/40"
                          data-testid="input-display-name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-[#9DA2B0]">Email</Label>
                        <Input
                          value={email}
                          disabled
                          className="bg-[#0E1525] border-[#2B3245] h-9 rounded-lg text-[#676D7E] text-sm cursor-not-allowed"
                          data-testid="input-email"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Button size="sm" className="h-8 px-4 bg-[#0079F2] hover:bg-[#0066CC] text-white text-[12px] rounded-lg" onClick={handleSaveProfile} data-testid="button-save-profile">
                          Save Changes
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-4 text-[#9DA2B0] hover:text-[#F5F9FC] text-[12px] rounded-lg" onClick={() => { setIsEditingProfile(false); setDisplayName(user?.displayName || ""); }} data-testid="button-cancel-profile">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-[#F5F9FC]" data-testid="text-display-name">{user?.displayName || "User"}</h3>
                        <button
                          className="w-6 h-6 rounded-md flex items-center justify-center text-[#676D7E] hover:text-[#0079F2] hover:bg-[#0079F2]/10 transition-colors"
                          onClick={() => setIsEditingProfile(true)}
                          data-testid="button-edit-profile"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Mail className="w-3 h-3 text-[#676D7E]" />
                        <p className="text-[12px] text-[#9DA2B0]" data-testid="text-email">{user?.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <User className="w-3 h-3 text-[#676D7E]" />
                        <p className="text-[12px] text-[#676D7E]">Member since {new Date().getFullYear()}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-[#2B3245]/60" />

          <div className="space-y-3" data-testid="section-appearance">
            <h2 className="text-[11px] font-semibold text-[#9DA2B0] uppercase tracking-wider px-1">Appearance</h2>
            <div className="rounded-xl bg-[#1C2333] border border-[#2B3245]">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#2B3245] flex items-center justify-center">
                    {isDark ? <Moon className="w-4 h-4 text-[#0079F2]" /> : <Sun className="w-4 h-4 text-orange-400" />}
                  </div>
                  <div>
                    <span className="text-sm text-[#F5F9FC] font-medium">Dark Mode</span>
                    <p className="text-[11px] text-[#676D7E]">Toggle between light and dark theme</p>
                  </div>
                </div>
                <Switch checked={isDark} onCheckedChange={setIsDark} data-testid="switch-dark-mode" />
              </div>
            </div>
          </div>

          <div className="h-px bg-[#2B3245]/60" />

          <div className="space-y-3" data-testid="section-password">
            <h2 className="text-[11px] font-semibold text-[#9DA2B0] uppercase tracking-wider px-1 flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Change Password
            </h2>
            <div className="rounded-xl bg-[#1C2333] border border-[#2B3245] p-5">
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-[#9DA2B0]">Current Password</Label>
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="bg-[#0E1525] border-[#2B3245] h-10 rounded-lg text-[#F5F9FC] text-sm placeholder:text-[#676D7E] focus-visible:ring-[#0079F2]/40 pr-10"
                      required
                      data-testid="input-current-password"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#676D7E] hover:text-[#9DA2B0]" onClick={() => setShowCurrentPassword(!showCurrentPassword)} data-testid="button-toggle-current-password">
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-[#9DA2B0]">New Password</Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="bg-[#0E1525] border-[#2B3245] h-10 rounded-lg text-[#F5F9FC] text-sm placeholder:text-[#676D7E] focus-visible:ring-[#0079F2]/40 pr-10"
                      required
                      data-testid="input-new-password"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#676D7E] hover:text-[#9DA2B0]" onClick={() => setShowNewPassword(!showNewPassword)} data-testid="button-toggle-new-password">
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-[#9DA2B0]">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="bg-[#0E1525] border-[#2B3245] h-10 rounded-lg text-[#F5F9FC] text-sm placeholder:text-[#676D7E] focus-visible:ring-[#0079F2]/40 pr-10"
                      required
                      data-testid="input-confirm-password"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#676D7E] hover:text-[#9DA2B0]" onClick={() => setShowConfirmPassword(!showConfirmPassword)} data-testid="button-toggle-confirm-password">
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

          <div className="h-px bg-[#2B3245]/60" />

          <div className="space-y-3" data-testid="section-signout">
            <h2 className="text-[11px] font-semibold text-[#9DA2B0] uppercase tracking-wider px-1">Session</h2>
            <div className="rounded-xl bg-[#1C2333] border border-[#2B3245]">
              <div className="flex items-center justify-between p-4">
                <div>
                  <span className="text-sm text-[#F5F9FC] font-medium">Sign Out</span>
                  <p className="text-[11px] text-[#676D7E]">Sign out of your account on this device</p>
                </div>
                <Button variant="outline" size="sm" className="h-8 px-4 border-[#2B3245] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] text-[12px] rounded-lg" onClick={() => logout.mutate()} data-testid="button-signout">
                  Sign Out
                </Button>
              </div>
            </div>
          </div>

          <div className="h-px bg-[#2B3245]/60" />

          <div className="space-y-3" data-testid="section-danger-zone">
            <h2 className="text-[11px] font-semibold text-red-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" /> Danger Zone
            </h2>
            <div className="rounded-xl bg-[#1C2333] border border-red-500/20 p-5">
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-[#F5F9FC]">Delete Account</h3>
                  <p className="text-[12px] text-[#676D7E] mt-1 leading-relaxed">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-[#9DA2B0]">Type <span className="text-red-400 font-mono font-bold">DELETE</span> to confirm</Label>
                  <Input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    className="bg-[#0E1525] border-[#2B3245] h-9 rounded-lg text-[#F5F9FC] text-sm placeholder:text-[#676D7E] focus-visible:ring-red-500/40 max-w-[200px] font-mono"
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
            <p className="text-[11px] text-[#676D7E]" data-testid="text-version">Replit v1.0.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
