import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Moon, Sun, Bell, Shield, Smartphone } from "lucide-react";
import { useState, useEffect } from "react";

export default function Settings() {
  const [, setLocation] = useLocation();
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

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center gap-3 p-4 pt-12 border-b border-white/5">
        <Button variant="ghost" size="icon" className="rounded-full w-8 h-8 hover:bg-white/5" onClick={() => setLocation("/dashboard")}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-2">Appearance</h2>
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                  {isDark ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-orange-400" />}
                </div>
                <span className="font-medium text-sm">Dark Mode</span>
              </div>
              <Switch checked={isDark} onCheckedChange={setIsDark} className="data-[state=checked]:bg-primary" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-2">Preferences</h2>
          <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-blue-400" />
                </div>
                <span className="font-medium text-sm">Push Notifications</span>
              </div>
              <Switch defaultChecked className="data-[state=checked]:bg-primary" />
            </div>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-green-400" />
                </div>
                <span className="font-medium text-sm">Haptic Feedback</span>
              </div>
              <Switch defaultChecked className="data-[state=checked]:bg-primary" />
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-2">Account</h2>
          <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-purple-400" />
                </div>
                <span className="font-medium text-sm">Privacy & Security</span>
              </div>
              <ChevronLeft className="w-4 h-4 rotate-180 text-muted-foreground" />
            </div>
            <div 
              className="p-4 cursor-pointer hover:bg-red-500/10 transition-colors text-red-400 font-medium text-sm text-center"
              onClick={() => {
                localStorage.removeItem("mock_token");
                setLocation("/");
              }}
            >
              Sign Out
            </div>
          </div>
        </div>

        <div className="text-center pt-8">
          <p className="text-xs text-muted-foreground">Vibe Mobile App v1.0.0</p>
        </div>
      </div>
    </div>
  );
}