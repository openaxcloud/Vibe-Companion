import { useState } from "react";
import { useLocation } from "wouter";
import { 
  Home, 
  Code, 
  Settings,
  Users,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };
  
  return (
    <div className={cn(
      "flex flex-col h-full bg-background border-r",
      isCollapsed ? "w-14" : "w-52"
    )}>
      {/* Logo */}
      <div className="flex items-center h-14 px-3 border-b">
        {!isCollapsed && (
          <h1 className="text-lg font-bold">PLOT</h1>
        )}
        <button
          onClick={toggleSidebar}
          className={cn(
            "rounded-md p-1.5 hover:bg-accent ml-auto",
            isCollapsed && "mx-auto"
          )}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      
      {/* Navigation items */}
      <div className="flex-1 py-4 space-y-1 px-1.5">
        <NavigationItem
          icon={<Home size={20} />}
          href="/"
          label="Home"
          isActive={location === "/"}
          isCollapsed={isCollapsed}
        />
        <NavigationItem
          icon={<Code size={20} />}
          href="/projects"
          label="Projects"
          isActive={location.startsWith("/project")}
          isCollapsed={isCollapsed}
        />
        <NavigationItem
          icon={<Users size={20} />}
          href="/teams"
          label="Teams"
          isActive={location.startsWith("/teams")}
          isCollapsed={isCollapsed}
        />
        <NavigationItem
          icon={<Settings size={20} />}
          href="/settings"
          label="Settings"
          isActive={location.startsWith("/settings")}
          isCollapsed={isCollapsed}
        />
        <NavigationItem
          icon={<HelpCircle size={20} />}
          href="/help"
          label="Help & Support"
          isActive={location.startsWith("/help")}
          isCollapsed={isCollapsed}
        />
      </div>
      
      {/* User profile */}
      <div className={cn(
        "border-t p-3",
        isCollapsed ? "flex justify-center" : "flex items-center space-x-3"
      )}>
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={`https://avatar.vercel.sh/${user?.username || 'user'}.png`} />
                  <AvatarFallback>{user?.username?.substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
                </Avatar>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <div className="text-sm">{user?.username || 'User'}</div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <>
            <Avatar className="h-8 w-8">
              <AvatarImage src={`https://avatar.vercel.sh/${user?.username || 'user'}.png`} />
              <AvatarFallback>{user?.username?.substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.username || 'User'}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface NavigationItemProps {
  icon: React.ReactNode;
  href: string;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
}

function NavigationItem({ icon, href, label, isActive, isCollapsed }: NavigationItemProps) {
  const [, navigate] = useLocation();
  
  return (
    <div onClick={() => navigate(href)}>
      {isCollapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(
                "w-full p-2 flex justify-center rounded-md transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {icon}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <div className="text-sm">{label}</div>
          </TooltipContent>
        </Tooltip>
      ) : (
        <button
          className={cn(
            "w-full p-2 flex items-center space-x-3 rounded-md transition-colors",
            isActive 
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          {icon}
          <span className="text-sm">{label}</span>
        </button>
      )}
    </div>
  );
}