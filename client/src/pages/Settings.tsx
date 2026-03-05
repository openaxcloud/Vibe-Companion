import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Moon, Sun, Bell, Shield, Smartphone } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export default function Settings() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) { root.classList.add("dark"); localStorage.setItem("theme", "dark"); }
    else { root.classList.remove("dark"); localStorage.setItem("theme", "light"); }
  }, [isDark]);

  useEffect(() => { setIsDark(document.documentElement.classList.contains("dark")); }, []);

  const initials = user?.displayName?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <div className="h-screen flex flex-col bg-[#0E1525] text-[#F5F9FC]">
      <div className="flex items-center gap-3 px-4 sm:px-8 py-4 bg-[#1C2333] border-b border-[#2B3245] shrink-0">
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245]" onClick={() => setLocation("/dashboard")} data-testid="button-back-settings">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold text-[#F5F9FC]">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="space-y-2">
            <h2 className="text-[11px] font-semibold text-[#9DA2B0] uppercase tracking-wider px-1">Account</h2>
            <div className="rounded-xl bg-[#1C2333] border border-[#2B3245] p-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-[#0079F2]/20 flex items-center justify-center border border-[#0079F2]/30">
                  <span className="font-bold text-[#0079F2] text-sm">{initials}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#F5F9FC]">{user?.displayName || "User"}</p>
                  <p className="text-[11px] text-[#9DA2B0] mt-0.5">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-[11px] font-semibold text-[#9DA2B0] uppercase tracking-wider px-1">Appearance</h2>
            <div className="rounded-xl bg-[#1C2333] border border-[#2B3245]">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#2B3245] flex items-center justify-center">
                    {isDark ? <Moon className="w-4 h-4 text-[#0079F2]" /> : <Sun className="w-4 h-4 text-orange-400" />}
                  </div>
                  <span className="text-sm text-[#F5F9FC]">Dark Mode</span>
                </div>
                <Switch checked={isDark} onCheckedChange={setIsDark} data-testid="switch-dark-mode" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-[11px] font-semibold text-[#9DA2B0] uppercase tracking-wider px-1">Preferences</h2>
            <div className="rounded-xl bg-[#1C2333] border border-[#2B3245] divide-y divide-[#2B3245]">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#2B3245] flex items-center justify-center"><Bell className="w-4 h-4 text-blue-400" /></div>
                  <span className="text-sm text-[#F5F9FC]">Notifications</span>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#2B3245] flex items-center justify-center"><Smartphone className="w-4 h-4 text-[#0CCE6B]" /></div>
                  <span className="text-sm text-[#F5F9FC]">Haptic Feedback</span>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="rounded-xl bg-[#1C2333] border border-[#2B3245] divide-y divide-[#2B3245]">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#2B3245]/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#2B3245] flex items-center justify-center"><Shield className="w-4 h-4 text-[#7C65CB]" /></div>
                  <span className="text-sm text-[#F5F9FC]">Privacy & Security</span>
                </div>
                <ChevronLeft className="w-4 h-4 rotate-180 text-[#676D7E]" />
              </div>
              <div className="p-4 cursor-pointer hover:bg-red-500/5 transition-colors text-red-400 font-medium text-sm text-center" onClick={() => logout.mutate()} data-testid="button-signout">
                Sign Out
              </div>
            </div>
          </div>

          <div className="text-center pt-4 pb-8">
            <p className="text-[11px] text-[#676D7E]">Replit v1.0.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
