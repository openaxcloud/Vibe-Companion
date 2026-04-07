import React, { FC, ReactNode, useMemo } from "react";
import classNames from "classnames";

export type SkeletonVariant = "text" | "circle" | "rect" | "card";

export type SkeletonAnimation = "pulse" | "wave" | "none";

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number | string;
  /**
   * Applies a border radius. Ignored for `circle` variant.
   */
  borderRadius?: number | string;
  /**
   * Number of skeleton lines (only for text variant).
   */
  lines?: number;
  /**
   * Width of each text line as percentage or explicit value.
   * - If a single value is provided, it's used for all lines.
   * - If array, values are applied per line, last value reused if fewer than lines.
   */
  lineWidths?: number | string | Array<number | string>;
  /**
   * When true, hides skeleton and shows children instead.
   */
  loading?: boolean;
  /**
   * Optional content to render once loading is false.
   */
  children?: ReactNode;
  /**
   * Visual animation style.
   */
  animation?: SkeletonAnimation;
  /**
   * Additional className for root element.
   */
  className?: string;
  /**
   * Additional style overrides.
   */
  style?: React.CSSProperties;
  /**
   * Optional ARIA label when used standalone as a loading indicator.
   */
  "aria-label"?: string;
}

/**
 * Utility to normalize CSS length values.
 */
const toCssSize = (value?: number | string): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") {
    return `undefinedpx`;
  }
  return value;
};

const getLineWidth = (
  index: number,
  lines: number,
  lineWidths?: number | string | Array<number | string>
): string | undefined => {
  if (lineWidths === undefined) return index === lines - 1 ? "60%" : "100%";

  if (typeof lineWidths === "number" || typeof lineWidths === "string") {
    return toCssSize(lineWidths) ?? undefined;
  }

  if (Array.isArray(lineWidths) && lineWidths.length > 0) {
    const widthValue =
      lineWidths[index] !== undefined
        ? lineWidths[index]
        : lineWidths[lineWidths.length - 1];
    return toCssSize(widthValue) ?? undefined;
  }

  return index === lines - 1 ? "60%" : "100%";
};

const baseSkeletonClass =
  "skeleton-root inline-block bg-neutral-200 dark:bg-neutral-800 relative overflow-hidden";

const animationClasses: Record<SkeletonAnimation, string> = {
  pulse:
    "skeleton-anim-pulse animate-pulse motion-reduce:animate-none transition-colors",
  wave:
    "skeleton-anim-wave relative overflow-hidden before:content-[''] before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-[skeleton-wave_1.6s_ease-in-out_infinite] motion-reduce:before:animate-none",
  none: "",
};

const Skeleton: FC<SkeletonProps> = ({
  variant = "text",
  width,
  height,
  borderRadius,
  lines = 1,
  lineWidths,
  loading = true,
  children,
  animation = "wave",
  className,
  style,
  "aria-label": ariaLabel,
}) => {
  const isTextVariant = variant === "text";

  const skeletonStyle: React.CSSProperties = useMemo(() => {
    const base: React.CSSProperties = {
      width: toCssSize(width),
      height: toCssSize(height),
      borderRadius:
        variant === "circle" ? "9999px" : borderRadius ? toCssSize(borderRadius) : undefined,
      ...style,
    };

    if (variant === "text") {
      // Height is driven by line height and count, so avoid forcing explicit height
      delete base.height;
    }

    return base;
  }, [width, height, borderRadius, style, variant]);

  if (!loading && children !== undefined) {
    return <>{children}</>;
  }

  const commonProps = {
    className: classNames(
      baseSkeletonClass,
      animationClasses[animation],
      {
        "rounded-md": variant !== "circle",
        "rounded-xl": variant === "card",
      },
      className
    ),
    style: skeletonStyle,
    "aria-busy": true,
    "aria-live": "polite" as const,
    "aria-label": ariaLabel || "Loading content",
    role: "status" as const,
  };

  if (isTextVariant) {
    const safeLines = Math.max(1, lines);

    return (
      <span {...commonProps}>
        <span className="flex flex-col gap-2">
          {Array.from({ length: safeLines }).map((_, index) => (
            <span
              key={index}
              className="block h-[0.9em] bg-current/0 rounded-sm"
              style={{
                width: getLineWidth(index, safeLines, lineWidths),
              }}
            >
              <span className="block h-full w-full bg-neutral-200 dark:bg-neutral-800 rounded-sm" />
            </span>
          ))}
        </span>
      </span>
    );
  }

  if (variant === "card") {
    return (
      <div {...commonProps}>
        <div className="flex flex-col h-full">
          <div className="w-full h-32 bg-neutral-200 dark:bg-neutral-800" />
          <div className="flex-1 p-4 space-y-3">
            <div className="h-4 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-3 w-full bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-3 w-5/6 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="flex gap-2 pt-2">
              <div className="h-8 w-20 bg-neutral-200 dark:bg-neutral-800 rounded-full" />
              <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-800 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <span {...commonProps} />;
};

export default Skeleton;

// Inject keyframes for wave animation if not using a global stylesheet.
// This is optional; uses a safe, idempotent injection on first import.
declare const document: Document | undefined;

const WAVE_ANIMATION_ID = "__skeleton_wave_keyframes__";

const ensureWaveKeyframes = () => {
  if (typeof document === "undefined") return;
  if (document.getElementById(WAVE_ANIMATION_ID)) return;

  const styleEl = document.createElement("style");
  styleEl.id = WAVE_ANIMATION_ID;
  styleEl.textContent = `
@keyframes skeleton-wave {
  0% {
    transform: translateX(-100%);
  }
  60% {
    transform: translateX(100%);
  }
  100% {
    transform: translateX(100%);
  }
}
`;
  document.head.appendChild(styleEl);
};

ensureWaveKeyframes();