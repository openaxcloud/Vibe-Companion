import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Moon, Sun, Bell, Shield, Smartphone, User } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export default function Settings() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const initials = user?.displayName?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-[#c9d1d9]">
      <div className="flex items-center gap-3 px-4 pt-10 pb-3 bg-[#161b22] border-b border-[#30363d]">
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setLocation("/dashboard")} data-testid="button-back-settings">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold text-white">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Account */}
        <div className="space-y-2">
          <h2 className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider px-1">Account</h2>
          <div className="rounded-xl bg-[#161b22] border border-[#30363d] overflow-hidden p-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-[#58a6ff]/20 flex items-center justify-center border border-[#58a6ff]/30">
                <span className="font-bold text-[#58a6ff] text-sm">{initials}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">{user?.displayName || "User"}</p>
                <p className="text-[11px] text-[#8b949e] mt-0.5">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="space-y-2">
          <h2 className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider px-1">Appearance</h2>
          <div className="rounded-xl bg-[#161b22] border border-[#30363d] overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#30363d] flex items-center justify-center">
                  {isDark ? <Moon className="w-4 h-4 text-[#58a6ff]" /> : <Sun className="w-4 h-4 text-orange-400" />}
                </div>
                <span className="text-sm text-white">Dark Mode</span>
              </div>
              <Switch checked={isDark} onCheckedChange={setIsDark} data-testid="switch-dark-mode" />
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="space-y-2">
          <h2 className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider px-1">Preferences</h2>
          <div className="rounded-xl bg-[#161b22] border border-[#30363d] overflow-hidden divide-y divide-[#30363d]">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#30363d] flex items-center justify-center">
                  <Bell className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-sm text-white">Notifications</span>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#30363d] flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-sm text-white">Haptic Feedback</span>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="space-y-2">
          <div className="rounded-xl bg-[#161b22] border border-[#30363d] overflow-hidden divide-y divide-[#30363d]">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#1c2128] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#30363d] flex items-center justify-center">
                  <Shield className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-sm text-white">Privacy & Security</span>
              </div>
              <ChevronLeft className="w-4 h-4 rotate-180 text-[#484f58]" />
            </div>
            <div
              className="p-4 cursor-pointer hover:bg-red-500/5 transition-colors text-red-400 font-medium text-sm text-center"
              onClick={() => logout.mutate()}
              data-testid="button-signout"
            >
              Sign Out
            </div>
          </div>
        </div>

        <div className="text-center pt-4 pb-8">
          <p className="text-[11px] text-[#484f58]">Vibe Platform v1.0.0</p>
        </div>
      </div>
    </div>
  );
}
