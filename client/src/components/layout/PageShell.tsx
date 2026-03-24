import type { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ECodeLoading } from "@/components/ECodeLoading";

interface PageShellProps {
  children: ReactNode;
  padded?: boolean;
  className?: string;
  tone?: "default" | "plain";
  fullHeight?: boolean;
}

const DEFAULT_BACKGROUND = "none";

export function PageShell({
  children,
  padded = true,
  className,
  tone = "default",
  fullHeight = true,
}: PageShellProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-auto px-4 py-6 sm:px-6 lg:px-12",
        fullHeight && "min-h-full",
        tone === "plain" ? "bg-[var(--ecode-background)]" : "bg-[var(--ecode-background)]",
        className
      )}
      style={tone === "plain" ? undefined : { backgroundImage: DEFAULT_BACKGROUND }}
    >
      <div
        className={cn(
          "mx-auto flex w-full flex-col",
          padded ? "max-w-7xl gap-8" : "max-w-none",
          padded && "gap-8"
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  icon?: LucideIcon;
  eyebrow?: string;
  alignment?: "left" | "center";
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  children,
  icon: Icon,
  eyebrow,
  alignment = "left",
  className,
}: PageHeaderProps) {
  const alignCenter = alignment === "center";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border bg-surface-solid p-6 shadow-sm transition-all",
        "sm:p-8",
        "",
        className
      )}
    >
      <div className={cn("flex flex-col gap-6", alignCenter && "items-center text-center")}
      >
        <div className={cn("flex w-full flex-col gap-4", alignCenter && "items-center")}
        >
          {eyebrow && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ecode-text-muted)]">
              {eyebrow}
            </span>
          )}
          <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start", alignCenter && "sm:items-center sm:justify-center")}
          >
            {Icon && (
              <div className="mr-0 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-tertiary-solid text-[var(--ecode-accent)] shadow-inner sm:mr-4">
                <Icon className="h-6 w-6" />
              </div>
            )}
            <div className={cn("space-y-3", alignCenter && "sm:text-center")}
            >
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--ecode-text)] sm:text-3xl">
                {title}
              </h1>
              {description && (
                <p className="max-w-3xl text-base text-[var(--ecode-text-muted)] sm:text-[15px]">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>

        {actions && (
          <div
            className={cn(
              "flex flex-col gap-3 sm:flex-row sm:items-center",
              alignCenter ? "sm:justify-center" : "sm:justify-end"
            )}
          >
            {actions}
          </div>
        )}

        {children && <div className="w-full">{children}</div>}
      </div>
    </section>
  );
}

interface PageShellLoadingProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function PageShellLoading({ text = "Loading...", size = "lg" }: PageShellLoadingProps) {
  return (
    <PageShell>
      <div className="relative h-full min-h-[calc(100vh-200px)]">
        <div className="absolute inset-0 flex items-center justify-center">
          <ECodeLoading size={size} text={text} />
        </div>
      </div>
    </PageShell>
  );
}
