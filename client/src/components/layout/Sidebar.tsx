import { Fragment, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import {
  isActiveNavigationItem,
  primaryNavigation,
  secondaryNavigation,
  type NavigationItem,
} from "@/constants/navigation";
import { Badge } from "@/components/ui/badge";

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const navigationGroups = useMemo(
    () => [
      {
        key: "workspace",
        label: "Workspace",
        items: primaryNavigation,
      },
      {
        key: "account",
        label: "People & support",
        items: secondaryNavigation,
      },
    ],
    []
  );

  return (
    <aside
      role="navigation"
      aria-label="Sidebar navigation"
      className={cn(
        "flex h-full flex-col border-r bg-background",
        isCollapsed ? "w-14" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-3">
        {!isCollapsed && <h1 className="text-[15px] font-bold tracking-tight">PLOT</h1>}
        <button
          onClick={toggleSidebar}
          className={cn(
            "ml-auto rounded-md p-1.5 hover:bg-accent",
            isCollapsed && "mx-auto"
          )}
          aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation items */}
      <nav aria-label="Main workspace navigation" className="flex-1 space-y-4 px-1.5 py-4">
        {navigationGroups.map((group) => (
          <Fragment key={group.key}>
            {!isCollapsed && (
              <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" id={`nav-group-${group.key}`}>
                {group.label}
              </div>
            )}
            <ul role="menu" aria-labelledby={!isCollapsed ? `nav-group-${group.key}` : undefined} className="space-y-1">
              {group.items.map((item) => (
                <li key={item.key} role="none">
                  <NavigationItemRow
                    item={item}
                    isCollapsed={isCollapsed}
                    isActive={isActiveNavigationItem(location, item)}
                  />
                </li>
              ))}
            </ul>
          </Fragment>
        ))}
      </nav>

      {/* User profile */}
      <div
        className={cn(
          "border-t p-3",
          isCollapsed ? "flex justify-center" : "flex items-center space-x-3"
        )}
      >
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={`https://avatar.vercel.sh/${user?.username || "user"}.png`} />
                  <AvatarFallback>
                    {user?.username?.substring(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <div className="text-[13px]">{user?.username || "User"}</div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <>
            <Avatar className="h-8 w-8">
              <AvatarImage src={`https://avatar.vercel.sh/${user?.username || "user"}.png`} />
              <AvatarFallback>
                {user?.username?.substring(0, 2).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{user?.username || "User"}</p>
              <button
                onClick={() => logoutMutation.mutate?.()}
                className="text-[11px] text-muted-foreground hover:text-foreground"
                aria-label="Sign out of your account"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

interface NavigationItemProps {
  item: NavigationItem;
  isActive: boolean;
  isCollapsed: boolean;
}

function NavigationItemRow({ item, isActive, isCollapsed }: NavigationItemProps) {
  const [, navigate] = useLocation();

  return (
    <div onClick={() => navigate(item.path)}>
      {isCollapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              role="menuitem"
              className={cn(
                "flex w-full justify-center rounded-md p-2 transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              aria-label={item.ctaLabel || item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <div className="text-[13px] font-medium">{item.label}</div>
            {item.description && (
              <p className="max-w-[180px] text-[11px] text-muted-foreground">
                {item.description}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      ) : (
        <button
          role="menuitem"
          className={cn(
            "flex w-full items-center justify-between rounded-md p-2 transition-colors",
            isActive
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
          aria-label={item.ctaLabel || item.label}
          aria-current={isActive ? "page" : undefined}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-primary">
              <item.icon className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[13px] font-medium leading-5">{item.label}</span>
              {item.description && (
                <span className="text-[11px] text-muted-foreground">{item.description}</span>
              )}
            </div>
          </div>
          {item.badge && (
            <Badge variant="secondary" className="ml-2">
              {item.badge}
            </Badge>
          )}
        </button>
      )}
    </div>
  );
}
