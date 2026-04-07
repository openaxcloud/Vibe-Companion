import React, { memo } from "react";

export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";
export type SpinnerVariant = "primary" | "secondary" | "accent" | "neutral" | "inverted";

export interface SpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  /**
   * If true, spinner is rendered in a full overlay that covers its container.
   */
  overlay?: boolean;
  /**
   * If true, overlay has a semi-transparent background.
   */
  backdrop?: boolean;
  /**
   * Optional accessible label. Defaults to "Loading".
   */
  label?: string;
  /**
   * If true, hides the textual label and shows only the visual spinner (still accessible to screen readers).
   */
  hideLabel?: boolean;
  /**
   * Additional className for the root element.
   */
  className?: string;
  /**
   * Optional inline style overrides.
   */
  style?: React.CSSProperties;
  /**
   * Data-testid for testing.
   */
  "data-testid"?: string;
}

const sizeClassMap: Record<SpinnerSize, string> = {
  xs: "w-3 h-3 border-2",
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-3",
  xl: "w-10 h-10 border-4",
};

const variantClassMap: Record<SpinnerVariant, { spinner: string; track: string }> = {
  primary: {
    spinner: "border-primary-500",
    track: "border-primary-100",
  },
  secondary: {
    spinner: "border-secondary-500",
    track: "border-secondary-100",
  },
  accent: {
    spinner: "border-accent-500",
    track: "border-accent-100",
  },
  neutral: {
    spinner: "border-slate-600",
    track: "border-slate-200",
  },
  inverted: {
    spinner: "border-white",
    track: "border-white/20",
  },
};

const baseSpinnerClass =
  "inline-block animate-spin rounded-full border-solid border-t-transparent";

const overlayBaseClass =
  "absolute inset-0 flex items-center justify-center pointer-events-none";
const overlayBackdropClass = "bg-slate-950/40 backdrop-blur-[1px]";

const srOnlyClass =
  "sr-only absolute w-px h-px p-0 m-0 overflow-hidden border-0 clip-[rect(0,0,0,0)] whitespace-nowrap";

const Spinner: React.FC<SpinnerProps> = memo(
  ({
    size = "md",
    variant = "primary",
    overlay = false,
    backdrop = false,
    label = "Loading",
    hideLabel = false,
    className = "",
    style,
    "data-testid": dataTestId = "spinner",
  }) => {
    const sizeClass = sizeClassMap[size];
    const variantClass = variantClassMap[variant];

    const spinnerElement = (
      <div
        className={[
          "inline-flex items-center gap-2",
          hideLabel ? "" : "min-h-[1.5rem]",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={style}
        data-testid={dataTestId}
      >
        <div
          className={[
            baseSpinnerClass,
            sizeClass,
            variantClass.spinner,
            variantClass.track,
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            borderLeftColor: variantClass.track.split(" ")[0]?.includes("border-")
              ? undefined
              : undefined,
          }}
          aria-hidden="true"
        />
        <span className={hideLabel ? srOnlyClass : "text-sm text-slate-600 dark:text-slate-300"}>
          {label}
        </span>
      </div>
    );

    if (!overlay) {
      return (
        <div aria-busy="true" aria-live="polite">
          {spinnerElement}
        </div>
      );
    }

    return (
      <div
        className={[
          overlayBaseClass,
          backdrop ? overlayBackdropClass : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={style}
        data-testid={dataTestId}
        aria-busy="true"
        aria-live="polite"
      >
        {spinnerElement}
      </div>
    );
  }
);

Spinner.displayName = "Spinner";

export default Spinner;