// @ts-nocheck
import { useState } from "react";
import { User, Settings, Moon, Sun, LogOut, ChevronRight, Code, Users, Flame, Edit2, Shield, Bell, CreditCard, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface ProfileStat {
  label: string;
  value: string | number;
  icon: React.ElementType;
}

interface SettingItem {
  label: string;
  icon: React.ElementType;
  action?: () => void;
  href?: string;
  hasToggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
}

export function MobileProfile() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  // Use authenticated user data with fallbacks
  const user = {
    name: authUser?.username || authUser?.email?.split('@')[0] || 'User',
    username: authUser?.username ? `@${authUser.username}` : '',
    email: authUser?.email || '',
    avatar: authUser?.avatarUrl || `https://ui-avatars.com/api/?background=F26207&color=fff&size=100&name=${encodeURIComponent(authUser?.username || 'User')}`,
    coverImage: null,
    bio: "Full-stack developer passionate about creating amazing web experiences",
    joinedDate: authUser?.createdAt ? new Date(authUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '',
  };

  const stats: ProfileStat[] = [
    { label: "Projects", value: 24, icon: Code },
    { label: "Followers", value: "1.2k", icon: Users },
    { label: "Streak", value: 15, icon: Flame },
  ];

  const settings: SettingItem[] = [
    {
      label: "Edit Profile",
      icon: Edit2,
      action: () => {
        setIsEditing(true);
        if ('vibrate' in navigator) navigator.vibrate(10);
      },
    },
    {
      label: "Account Settings",
      icon: Settings,
      href: "/settings/account",
    },
    {
      label: "Privacy & Security",
      icon: Shield,
      href: "/settings/privacy",
    },
    {
      label: "Notifications",
      icon: Bell,
      hasToggle: true,
      toggleValue: notificationsEnabled,
      onToggle: (value) => {
        setNotificationsEnabled(value);
        toast({
          title: value ? "Notifications enabled" : "Notifications disabled",
          description: value ? "You'll receive notifications" : "You won't receive notifications",
        });
        if ('vibrate' in navigator) navigator.vibrate(10);
      },
    },
    {
      label: "Billing & Usage",
      icon: CreditCard,
      href: "/usage",
    },
    {
      label: "Help & Support",
      icon: HelpCircle,
      href: "/help",
    },
  ];

  const handleSignOut = () => {
    if ('vibrate' in navigator) navigator.vibrate([10, 10, 10]);
    
    toast({
      title: "Signing out...",
      description: "You'll be redirected to the login page",
    });
    
    setTimeout(() => {
      window.location.href = '/login';
    }, 1000);
  };

  return (
    <div className="min-h-screen pb-20 bg-background">
      <div className="relative">
        <div className="h-32 bg-gradient-to-br from-primary to-secondary relative">
          <div className="absolute inset-0">
            <div className="absolute inset-0" style={{
              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, var(--ecode-surface-hover) 35px, var(--ecode-surface-hover) 70px)`,
            }} />
          </div>
        </div>
        
        <div className="relative -mt-12 px-4">
          <div className="flex items-end gap-4">
            <Avatar className="h-24 w-24 border-4 border-background">
              <AvatarImage src={user.avatar} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {user.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="ml-auto mb-2 px-4 py-2 bg-secondary rounded-full text-[13px] font-medium active:scale-95 transition-transform"
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 mt-4">
        <h1 className="text-[15px] font-bold">{user.name}</h1>
        <p className="text-[13px] text-muted-foreground">{user.username}</p>
        <p className="text-[13px] text-muted-foreground mt-2">{user.bio}</p>
        <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
          <span>Joined {user.joinedDate}</span>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 px-4 mt-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={cn(
                "animate-slideInUp",
                `animate-stagger-${index + 1}`
              )}
            >
              <Card className="p-4 text-center hover:shadow-md transition-shadow">
                <Icon className="h-5 w-5 text-primary mx-auto mb-2" />
                <div className="text-[15px] font-bold">{stat.value}</div>
                <div className="text-[11px] text-muted-foreground">{stat.label}</div>
              </Card>
            </div>
          );
        })}
      </div>

      <div className="mt-6 px-4">
        <h2 className="text-[13px] font-medium text-muted-foreground mb-3 px-1">
          Settings
        </h2>
        
        <div className="space-y-1">
          {settings.map((setting, index) => {
            const Icon = setting.icon;
            return (
              <button
                key={setting.label}
                onClick={() => {
                  if (setting.action) {
                    setting.action();
                  } else if (setting.href) {
                    window.location.href = setting.href;
                  }
                  if ('vibrate' in navigator) navigator.vibrate(5);
                }}
                className={cn(
                  "w-full flex items-center justify-between p-4 hover:bg-surface-tertiary-solid rounded-lg transition-colors group",
                  "animate-fade-in active:scale-98 transition-transform",
                  `animate-stagger-${Math.min(index + 1, 5)}`
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary rounded-lg group-hover:bg-primary/10 transition-colors">
                    <Icon className="h-4 w-4 group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-[13px] font-medium">{setting.label}</span>
                </div>
                
                {setting.hasToggle ? (
                  <Switch
                    size="sm"
                    checked={setting.toggleValue}
                    onCheckedChange={setting.onToggle}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 px-4">
        <h2 className="text-[13px] font-medium text-muted-foreground mb-3 px-1">
          Appearance
        </h2>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? (
                <Moon className="h-5 w-5 text-primary" />
              ) : (
                <Sun className="h-5 w-5 text-primary" />
              )}
              <div>
                <div className="text-[13px] font-medium">Theme</div>
                <div className="text-[11px] text-muted-foreground">
                  {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setTheme('light');
                  if ('vibrate' in navigator) navigator.vibrate(5);
                }}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200 active:scale-95",
                  theme === 'light' 
                    ? "bg-primary/10 text-primary" 
                    : "bg-secondary text-muted-foreground"
                )}
              >
                <Sun className="h-4 w-4" />
              </button>
              
              <button
                onClick={() => {
                  setTheme('dark');
                  if ('vibrate' in navigator) navigator.vibrate(5);
                }}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200 active:scale-95",
                  theme === 'dark' 
                    ? "bg-primary/10 text-primary" 
                    : "bg-secondary text-muted-foreground"
                )}
              >
                <Moon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-8 px-4 pb-8">
        <Button
          variant="outline"
          className="w-full justify-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
