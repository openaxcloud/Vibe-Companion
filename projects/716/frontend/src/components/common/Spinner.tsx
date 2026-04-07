import React from "react";

export type SpinnerSize = "xs" | "sm" | "md" | "lg";

export interface SpinnerProps {
  /**
   * Optional accessible label for screen readers.
   * If not provided, defaults to "Loading".
   */
  label?: string;
  /**
   * Visual size of the spinner.
   */
  size?: SpinnerSize;
  /**
   * Additional class names for custom styling.
   */
  className?: string;
  /**
   * Whether to render only the spinner without the default wrapper layout.
   * Useful when composing inside other components.
   */
  bare?: boolean;
}

const sizeClassMap: Record<SpinnerSize, string> = {
  xs: "h-3 w-3 border-2",
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-3",
  lg: "h-8 w-8 border-4",
};

const Spinner: React.FC<SpinnerProps> = ({
  label = "Loading",
  size = "md",
  className = "",
  bare = false,
}) => {
  const spinnerElement = (
    <span
      className={`inline-block animate-spin rounded-full border-t-transparent border-solid border-primary/80 border-r-primary/80 border-b-primary/40 border-l-primary/40 undefined undefined`}
      role="status"
      aria-live="polite"
      aria-label={label}
    />
  );

  if (bare) {
    return spinnerElement;
  }

  return (
    <div className="flex items-center justify-center gap-2" aria-busy="true">
      {spinnerElement}
      <span className="sr-only">{label}</span>
    </div>
  );
};

export default Spinner;