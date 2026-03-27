import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Code2,
  Home,
  LifeBuoy,
  Settings2,
  Sparkles,
  User,
  Users,
} from "lucide-react";

export interface NavigationItem {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  description?: string;
  badge?: string;
  ctaLabel?: string;
  activePaths?: string[];
  exact?: boolean;
}

export const primaryNavigation: NavigationItem[] = [
  {
    key: "dashboard",
    label: "Home",
    path: "/dashboard",
    icon: Home,
    description: "Overview of your workspaces and activity",
    ctaLabel: "Open dashboard",
    activePaths: ["/dashboard", "/home"],
    exact: false,
  },
  {
    key: "projects",
    label: "Projects",
    path: "/projects",
    icon: Code2,
    description: "Browse, create, and manage projects",
    ctaLabel: "Browse your projects",
    activePaths: ["/projects", "/project", "/u/"],
  },
  {
    key: "teams",
    label: "Teams",
    path: "/teams",
    icon: Users,
    description: "Collaborate with teammates and manage groups",
    ctaLabel: "Manage your teams",
    activePaths: ["/teams"],
  },
  {
    key: "usage",
    label: "Usage",
    path: "/usage",
    icon: BarChart3,
    description: "Track your resource usage and allocations",
    ctaLabel: "Check usage analytics",
    activePaths: ["/usage"],
  },
  {
    key: "settings",
    label: "Settings",
    path: "/settings",
    icon: Settings2,
    description: "Update your preferences and configuration",
    ctaLabel: "Open settings",
    activePaths: ["/settings"],
  },
  {
    key: "support",
    label: "Support",
    path: "/support",
    icon: LifeBuoy,
    description: "Get help, resources, and contact support",
    ctaLabel: "Contact support",
    activePaths: ["/support", "/help"],
  },
];

export const secondaryNavigation: NavigationItem[] = [
  {
    key: "community",
    label: "Community",
    path: "/community",
    icon: Sparkles,
    description: "Discover what's new across the community",
    ctaLabel: "Open community",
    activePaths: ["/community", "/forum"],
  },
  {
    key: "account",
    label: "Account",
    path: "/account",
    icon: User,
    description: "Manage billing, security, and account data",
    ctaLabel: "Open account settings",
    activePaths: ["/account", "/profile"],
  },
];

export const mobileNavigation: NavigationItem[] = [
  primaryNavigation[0],
  primaryNavigation[1],
  secondaryNavigation[0],
  secondaryNavigation[1],
];

export function isActiveNavigationItem(pathname: string, item: NavigationItem): boolean {
  if (item.exact) {
    return pathname === item.path;
  }

  const candidates = new Set<string>();
  candidates.add(item.path);
  item.activePaths?.forEach((candidate) => {
    candidates.add(candidate);
  });

  for (const candidate of candidates) {
    if (candidate === "/") {
      if (pathname === "/") return true;
      continue;
    }

    if (pathname.startsWith(candidate)) {
      return true;
    }
  }

  return false;
}
