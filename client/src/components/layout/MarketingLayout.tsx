import { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";
import { PublicNavbar } from "./PublicNavbar";
import { PublicFooter } from "./PublicFooter";

interface MarketingLayoutProps extends PropsWithChildren {
  className?: string;
}

export function MarketingLayout({ children, className }: MarketingLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-marketing-surface text-foreground overscroll-none">
      <div className="relative">
        <div className="marketing-backdrop" aria-hidden />
        <PublicNavbar />
      </div>
      <main className={cn("flex-1 relative z-10", className)}>
        <div className="marketing-gradient" aria-hidden />
        <div className="relative z-10 pb-16">{children}</div>
      </main>
      <PublicFooter />
    </div>
  );
}
