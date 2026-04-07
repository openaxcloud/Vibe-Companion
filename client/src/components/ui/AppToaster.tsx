/**
 * AppToaster - Wrapper pour Sonner Toaster compatible avec notre ThemeProvider
 */

import type { CSSProperties } from "react";
import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "../ThemeProvider";

export function AppToaster({ position = "bottom-right" }: { position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center" }) {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      position={position}
      theme={resolvedTheme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as CSSProperties
      }
    />
  );
}
