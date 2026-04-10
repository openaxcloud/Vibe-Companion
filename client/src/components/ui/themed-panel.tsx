/**
 * Themed Panel Components - Fortune 500 Design Token System
 * Enforces consistent theming across IDE panels
 * 
 * @see client/src/styles/replit-theme.css for design tokens
 */

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ThemedPanelProps {
  children: ReactNode;
  className?: string;
}

/**
 * Main panel container with theme-aware background
 * Replaces: bg-white → bg-background
 */
export function ThemedPanel({ children, className }: ThemedPanelProps) {
  return (
    <div className={cn("h-full flex flex-col bg-background", className)}>
      {children}
    </div>
  );
}

/**
 * Panel header with theme-aware border
 * Replaces: bg-white border-gray-200 → bg-background border-border
 */
export function ThemedPanelHeader({ children, className }: ThemedPanelProps) {
  return (
    <div className={cn("flex items-center justify-between px-4 py-2 border-b border-border bg-background", className)}>
      {children}
    </div>
  );
}

/**
 * Panel content area with theme-aware background
 */
export function ThemedPanelContent({ children, className }: ThemedPanelProps) {
  return (
    <div className={cn("flex-1 overflow-auto bg-background", className)}>
      {children}
    </div>
  );
}

/**
 * Panel footer with theme-aware styling
 */
export function ThemedPanelFooter({ children, className }: ThemedPanelProps) {
  return (
    <div className={cn("flex items-center gap-2 px-4 py-2 border-t border-border bg-background", className)}>
      {children}
    </div>
  );
}

/**
 * Sidebar panel with elevated surface
 * Replaces: bg-white → bg-surface
 */
export function ThemedSidebar({ children, className }: ThemedPanelProps) {
  return (
    <div className={cn("h-full flex flex-col bg-sidebar-background border-sidebar-border", className)}>
      {children}
    </div>
  );
}
